<?php

namespace App\Services;

use App\Models\AppNotification;
use App\Models\Watchlist;
use Carbon\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class WatchlistMonitoringService
{
    private string $baseUrl = 'https://api.gbif.org/v1';

    /**
     * Check all watchlist rows, create notifications for meaningful GBIF changes,
     * and update the stored baseline snapshot.
     */
    public function monitorAll(?int $limit = null): array
    {
        $stats = [
            'checked' => 0,
            'baselined' => 0,
            'notifications' => 0,
            'failed' => 0,
        ];

        $query = Watchlist::query()
            ->with('user')
            ->orderByRaw('monitored_at IS NULL DESC')
            ->orderBy('monitored_at');

        if ($limit) {
            $query->limit($limit);
        }

        $query->get()->each(function (Watchlist $watchlist) use (&$stats) {
            $stats['checked']++;

            try {
                $result = $this->monitorWatchlistItem($watchlist);
                $stats['notifications'] += $result['notifications'];
                if ($result['baselined']) {
                    $stats['baselined']++;
                }
            } catch (\Throwable $e) {
                $stats['failed']++;
                Log::error('Watchlist monitoring failed', [
                    'watchlist_id' => $watchlist->id,
                    'gbif_species_key' => $watchlist->gbif_species_key,
                    'error' => $e->getMessage(),
                ]);
            }
        });

        return $stats;
    }

    public function monitorWatchlistItem(Watchlist $watchlist, bool $notify = true): array
    {
        $snapshot = $this->fetchSnapshot((int) $watchlist->gbif_species_key);

        if (empty($snapshot)) {
            return ['baselined' => false, 'notifications' => 0];
        }

        $previous = $watchlist->monitoring_snapshot ?? [];
        $hasBaseline = !empty($previous);
        $notifications = 0;

        if ($hasBaseline && $notify) {
            $changes = $this->detectChanges($previous, $snapshot);

            foreach ($changes as $change) {
                AppNotification::create([
                    'user_id' => $watchlist->user_id,
                    'type' => $change['type'],
                    'title' => $change['title'],
                    'message' => $change['message'],
                    'data' => array_merge($change['data'], [
                        'gbif_species_key' => $watchlist->gbif_species_key,
                        'species_name' => $watchlist->common_name ?: $watchlist->scientific_name,
                        'scientific_name' => $watchlist->scientific_name,
                    ]),
                    'is_read' => false,
                ]);
                $notifications++;
            }
        }

        $this->applySnapshot($watchlist, $snapshot);

        return [
            'baselined' => !$hasBaseline,
            'notifications' => $notifications,
        ];
    }

    public function initializeBaseline(Watchlist $watchlist): void
    {
        try {
            $snapshot = $this->fetchSnapshot((int) $watchlist->gbif_species_key);
            if (!empty($snapshot)) {
                $this->applySnapshot($watchlist, $snapshot);
            }
        } catch (\Throwable $e) {
            Log::warning('Unable to initialize watchlist monitoring baseline', [
                'watchlist_id' => $watchlist->id,
                'gbif_species_key' => $watchlist->gbif_species_key,
                'error' => $e->getMessage(),
            ]);
        }
    }

    private function fetchSnapshot(int $usageKey): array
    {
        $occurrenceQuery = http_build_query([
            'taxonKey' => $usageKey,
            'limit' => 20,
            'facetLimit' => 50,
            'sort' => 'EVENT_DATE',
            'sortOrder' => 'DESC',
        ]);
        $occurrenceQuery .= '&facet=country&facet=issue&facet=basisOfRecord';

        $responses = Http::pool(fn ($pool) => [
            $pool->as('details')->connectTimeout(5)->timeout(12)->get("{$this->baseUrl}/species/{$usageKey}"),
            $pool->as('iucn')->connectTimeout(5)->timeout(12)->get("{$this->baseUrl}/species/{$usageKey}/iucnRedListCategory"),
            $pool->as('occurrences')->connectTimeout(5)->timeout(12)->get("{$this->baseUrl}/occurrence/search?{$occurrenceQuery}"),
            $pool->as('coordinateOccurrences')->connectTimeout(5)->timeout(12)->get("{$this->baseUrl}/occurrence/search", [
                'taxonKey' => $usageKey,
                'hasCoordinate' => 'true',
                'limit' => 1,
            ]),
            $pool->as('mediaOccurrences')->connectTimeout(5)->timeout(12)->get("{$this->baseUrl}/occurrence/search", [
                'taxonKey' => $usageKey,
                'mediaType' => 'StillImage',
                'limit' => 1,
            ]),
        ]);

        $details = $this->successfulJson($responses['details'] ?? null, []);
        if (empty($details)) {
            return [];
        }

        $iucn = $this->successfulJson($responses['iucn'] ?? null, null);
        $occurrences = $this->successfulJson($responses['occurrences'] ?? null, []);
        $coordinateOccurrences = $this->successfulJson($responses['coordinateOccurrences'] ?? null, []);
        $mediaOccurrences = $this->successfulJson($responses['mediaOccurrences'] ?? null, []);

        $countryFacets = $this->facetCounts($occurrences, 'COUNTRY');
        $issueFacets = $this->facetCounts($occurrences, 'ISSUE');
        $basisFacets = $this->facetCounts($occurrences, 'BASIS_OF_RECORD');
        $latestOccurrence = $this->latestOccurrence($occurrences['results'] ?? []);

        return [
            'gbif_species_key' => $usageKey,
            'scientific_name' => $details['scientificName'] ?? null,
            'canonical_name' => $details['canonicalName'] ?? null,
            'kingdom' => $details['kingdom'] ?? null,
            'family' => $details['family'] ?? null,
            'conservation_status' => $iucn['code'] ?? null,
            'conservation_status_label' => $iucn['category'] ?? null,
            'occurrence_count' => (int) ($occurrences['count'] ?? 0),
            'coordinate_count' => (int) ($coordinateOccurrences['count'] ?? 0),
            'media_count' => (int) ($mediaOccurrences['count'] ?? 0),
            'country_count' => count($countryFacets),
            'countries' => array_keys($countryFacets),
            'issue_count' => array_sum($issueFacets),
            'issues' => $issueFacets,
            'basis_of_record' => $basisFacets,
            'last_observed_at' => $latestOccurrence['eventDate'] ?? null,
            'last_observation_country' => $latestOccurrence['country'] ?? null,
            'last_observation_locality' => $latestOccurrence['locality'] ?? null,
            'last_occurrence_key' => $latestOccurrence['key'] ?? null,
            'checked_at' => now()->toIso8601String(),
        ];
    }

    private function successfulJson(mixed $response, mixed $fallback = []): mixed
    {
        if (!is_object($response) || !method_exists($response, 'successful') || !$response->successful()) {
            if ($response instanceof \Throwable) {
                Log::warning('GBIF watchlist request failed', [
                    'error' => $response->getMessage(),
                ]);
            }

            return $fallback;
        }

        return $response->json();
    }

    private function facetCounts(array $occurrenceData, string $facetName): array
    {
        foreach ($occurrenceData['facets'] ?? [] as $facet) {
            if (($facet['field'] ?? '') !== $facetName) {
                continue;
            }

            $counts = [];
            foreach ($facet['counts'] ?? [] as $item) {
                $name = (string) ($item['name'] ?? '');
                if ($name !== '') {
                    $counts[$name] = (int) ($item['count'] ?? 0);
                }
            }
            ksort($counts);
            return $counts;
        }

        return [];
    }

    private function latestOccurrence(array $records): array
    {
        $latest = [];
        $latestTime = null;

        foreach ($records as $record) {
            $date = $this->parseDate($record['eventDate'] ?? null);
            if (!$date) {
                continue;
            }

            if (!$latestTime || $date->greaterThan($latestTime)) {
                $latestTime = $date;
                $latest = $record;
            }
        }

        return $latest;
    }

    private function detectChanges(array $previous, array $current): array
    {
        $changes = [];
        $name = $current['canonical_name'] ?? $current['scientific_name'] ?? 'A watchlisted species';

        $oldStatus = strtoupper((string) ($previous['conservation_status'] ?? ''));
        $newStatus = strtoupper((string) ($current['conservation_status'] ?? ''));
        if ($oldStatus !== $newStatus && $newStatus !== '') {
            $changes[] = [
                'type' => 'status_change',
                'title' => 'Conservation Status Changed',
                'message' => "{$name} changed from {$this->statusLabel($oldStatus, $previous)} to {$this->statusLabel($newStatus, $current)}.",
                'data' => [
                    'previous_status' => $oldStatus ?: null,
                    'new_status' => $newStatus,
                    'previous_status_label' => $previous['conservation_status_label'] ?? null,
                    'new_status_label' => $current['conservation_status_label'] ?? null,
                ],
            ];
        }

        $oldObserved = $this->parseDate($previous['last_observed_at'] ?? null);
        $newObserved = $this->parseDate($current['last_observed_at'] ?? null);
        $oldCount = (int) ($previous['occurrence_count'] ?? 0);
        $newCount = (int) ($current['occurrence_count'] ?? 0);
        if (($newObserved && (!$oldObserved || $newObserved->greaterThan($oldObserved))) || $newCount > $oldCount) {
            $changes[] = [
                'type' => 'new_sighting',
                'title' => 'New Species Sighting Detected',
                'message' => "{$name} has newer GBIF occurrence activity. Records changed from {$oldCount} to {$newCount}.",
                'data' => [
                    'previous_occurrence_count' => $oldCount,
                    'new_occurrence_count' => $newCount,
                    'previous_last_observed_at' => $previous['last_observed_at'] ?? null,
                    'new_last_observed_at' => $current['last_observed_at'] ?? null,
                    'last_observation_country' => $current['last_observation_country'] ?? null,
                    'last_observation_locality' => $current['last_observation_locality'] ?? null,
                    'last_occurrence_key' => $current['last_occurrence_key'] ?? null,
                ],
            ];
        }

        $previousCountries = is_array($previous['countries'] ?? null) ? $previous['countries'] : [];
        $currentCountries = is_array($current['countries'] ?? null) ? $current['countries'] : [];
        sort($previousCountries);
        sort($currentCountries);
        if ($previousCountries !== $currentCountries) {
            $added = array_values(array_diff($currentCountries, $previousCountries));
            $removed = array_values(array_diff($previousCountries, $currentCountries));
            $changes[] = [
                'type' => 'watchlist_update',
                'title' => 'Species Range Data Changed',
                'message' => "{$name} now has GBIF records across {$current['country_count']} countries.",
                'data' => [
                    'previous_country_count' => (int) ($previous['country_count'] ?? 0),
                    'new_country_count' => (int) ($current['country_count'] ?? 0),
                    'added_countries' => $added,
                    'removed_countries' => $removed,
                ],
            ];
        }

        $mediaChanged = (int) ($previous['media_count'] ?? 0) !== (int) ($current['media_count'] ?? 0);
        $coordinateChanged = (int) ($previous['coordinate_count'] ?? 0) !== (int) ($current['coordinate_count'] ?? 0);
        $issueChanged = (int) ($previous['issue_count'] ?? 0) !== (int) ($current['issue_count'] ?? 0);
        if ($mediaChanged || $coordinateChanged || $issueChanged) {
            $changes[] = [
                'type' => 'watchlist_update',
                'title' => 'Evidence and Data Quality Updated',
                'message' => "{$name} has updated GBIF evidence or data-quality metrics.",
                'data' => [
                    'previous_media_count' => (int) ($previous['media_count'] ?? 0),
                    'new_media_count' => (int) ($current['media_count'] ?? 0),
                    'previous_coordinate_count' => (int) ($previous['coordinate_count'] ?? 0),
                    'new_coordinate_count' => (int) ($current['coordinate_count'] ?? 0),
                    'previous_issue_count' => (int) ($previous['issue_count'] ?? 0),
                    'new_issue_count' => (int) ($current['issue_count'] ?? 0),
                ],
            ];
        }

        return $changes;
    }

    private function applySnapshot(Watchlist $watchlist, array $snapshot): void
    {
        $watchlist->forceFill([
            'scientific_name' => $snapshot['scientific_name'] ?: $watchlist->scientific_name,
            'conservation_status' => $snapshot['conservation_status'] ?: $watchlist->conservation_status,
            'conservation_status_label' => $snapshot['conservation_status_label'] ?: $watchlist->conservation_status_label,
            'family' => $snapshot['family'] ?: $watchlist->family,
            'kingdom' => $snapshot['kingdom'] ?: $watchlist->kingdom,
            'last_observed_at' => $this->parseDate($snapshot['last_observed_at'] ?? null),
            'last_known_occurrence_count' => $snapshot['occurrence_count'] ?? null,
            'last_known_country_count' => $snapshot['country_count'] ?? null,
            'last_known_media_count' => $snapshot['media_count'] ?? null,
            'last_known_coordinate_count' => $snapshot['coordinate_count'] ?? null,
            'last_known_issue_count' => $snapshot['issue_count'] ?? null,
            'monitoring_snapshot' => $snapshot,
            'monitored_at' => now(),
        ])->save();
    }

    private function parseDate(mixed $value): ?Carbon
    {
        if (!$value) {
            return null;
        }

        try {
            return Carbon::parse($value);
        } catch (\Throwable) {
            return null;
        }
    }

    private function statusLabel(string $code, array $snapshot): string
    {
        $label = $snapshot['conservation_status_label'] ?? null;
        if ($label) {
            return "{$code} ({$label})";
        }

        return $code !== '' ? $code : 'unknown status';
    }
}

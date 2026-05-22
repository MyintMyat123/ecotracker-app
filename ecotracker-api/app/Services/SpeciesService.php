<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Http\Client\Pool;

class SpeciesService
{
    protected string $baseUrl = 'https://api.gbif.org/v1';

    /**
     * Search for species by name using GBIF API.
     *
     * @param string $name
     * @return array
     */
    public function searchByName(string $name): array
    {
        try {
            // Laravel's Http client serializes arrays as highertaxonKey[0]=1, which GBIF ignores.
            // We append them manually to format them correctly.
            $queryString = http_build_query([
                'q' => $name,
                'datasetKey' => 'd7dddbf4-2cf0-4f39-9b2a-bb099caae36c',
                'status' => 'ACCEPTED',
                'rank' => 'SPECIES', // Ignore genus, subspecies, etc.
                'limit' => 20,
            ]);
            
            // Add dual qFields to force high priority on BOTH common and scientific names
            $queryString .= '&qField=VERNACULAR&qField=SCIENTIFIC&highertaxonKey=1&highertaxonKey=5&highertaxonKey=6';

            $response = Http::get("{$this->baseUrl}/species/search?{$queryString}");

            if ($response->successful()) {
                $data = $response->json();
                
                if (!empty($data['results'])) {
                    // Fetch IUCN statuses concurrently for better performance
                    $responses = Http::pool(function (Pool $pool) use ($data) {
                        $requests = [];
                        foreach ($data['results'] as $index => $species) {
                            $key = $species['key'] ?? null;
                            if ($key) {
                                $requests[$index] = $pool->as((string)$index)->get("{$this->baseUrl}/species/{$key}/iucnRedListCategory");
                            }
                        }
                        return $requests;
                    });

                    // Map responses back to results
                    foreach ($data['results'] as $index => &$species) {
                        $iucnResponse = $responses[(string)$index] ?? null;
                        if ($iucnResponse && $iucnResponse->successful()) {
                            $species['iucnRedListStatus'] = $iucnResponse->json();
                        } else {
                            $species['iucnRedListStatus'] = null;
                        }
                    }
                }

                return $data;
            }

            Log::error("GBIF API search failed: " . $response->body());
            return [];
        } catch (\Exception $e) {
            Log::error("Exception during GBIF API search: " . $e->getMessage());
            return [];
        }
    }

    /**
     * Get autocomplete suggestions for species names.
     *
     * @param string $name
     * @return array
     */
    public function suggest(string $name): array
    {
        try {
            // We use the search endpoint instead of suggest because suggest doesn't return vernacularNames
            $queryString = http_build_query([
                'q' => $name,
                'datasetKey' => 'd7dddbf4-2cf0-4f39-9b2a-bb099caae36c',
                'status' => 'ACCEPTED',
                'rank' => 'SPECIES', // Ignore genus, subspecies, etc.
                'limit' => 5,
            ]);
            
            $queryString .= '&qField=VERNACULAR&qField=SCIENTIFIC&highertaxonKey=1&highertaxonKey=5&highertaxonKey=6';

            $response = Http::get("{$this->baseUrl}/species/search?{$queryString}");

            if ($response->successful()) {
                $data = $response->json();
                return $data['results'] ?? [];
            }

            Log::error("GBIF API suggest failed: " . $response->body());
            return [];
        } catch (\Exception $e) {
            Log::error("Exception during GBIF API suggest: " . $e->getMessage());
            return [];
        }
    }

    /**
     * Get detailed information about a species by its GBIF key.
     *
     * @param int $usageKey
     * @return array
     */
    public function getDetails(int $usageKey): array
    {
        try {
            $response = Http::get("{$this->baseUrl}/species/{$usageKey}");

            if ($response->successful()) {
                $details = $response->json();

                // Attempt to fetch IUCN Red List status
                $iucnResponse = Http::get("{$this->baseUrl}/species/{$usageKey}/iucnRedListCategory");
                if ($iucnResponse->successful()) {
                    $details['iucnRedListStatus'] = $iucnResponse->json();
                } else {
                    $details['iucnRedListStatus'] = null; // Status not found or unavailable
                }

                return $details;
            }

            Log::error("GBIF API details failed: " . $response->body());
            return [];
        } catch (\Exception $e) {
            Log::error("Exception during GBIF API details fetch: " . $e->getMessage());
            return [];
        }
    }

    /**
     * Get recent occurrences (sightings) for a species.
     *
     * @param int $usageKey
     * @param int $limit
     * @return array
     */
    public function getOccurrences(int $usageKey, int $limit = 20): array
    {
        try {
            $response = Http::get("{$this->baseUrl}/occurrence/search", [
                'taxonKey' => $usageKey,
                'basisOfRecord' => 'HUMAN_OBSERVATION',
                'limit' => $limit,
                'hasCoordinate' => 'true',
            ]);

            if ($response->successful()) {
                return $response->json()['results'] ?? [];
            }

            Log::error("GBIF API occurrence search failed: " . $response->body());
            return [];
        } catch (\Exception $e) {
            Log::error("Exception during GBIF API occurrence search: " . $e->getMessage());
            return [];
        }
    }

    /**
     * Get professional tracker metrics for a species.
     *
     * @param int $usageKey
     * @return array
     */
    public function getTrackerMetrics(int $usageKey): array
    {
        try {
            $responses = Http::pool(function (Pool $pool) use ($usageKey) {
                $occQuery = http_build_query([
                    'taxonKey' => $usageKey,
                    'limit' => 1,
                    'facetLimit' => 100,
                ]);
                $occQuery .= '&facet=year&facet=country';

                return [
                    $pool->as('details')->get("{$this->baseUrl}/species/{$usageKey}"),
                    $pool->as('iucn')->get("{$this->baseUrl}/species/{$usageKey}/iucnRedListCategory"),
                    $pool->as('occurrences')->get("{$this->baseUrl}/occurrence/search?{$occQuery}"),
                    $pool->as('descriptions')->get("{$this->baseUrl}/species/{$usageKey}/descriptions"),
                    $pool->as('media')->get("{$this->baseUrl}/species/{$usageKey}/media"),
                ];
            });

            $details = isset($responses['details']) && $responses['details']->successful() ? $responses['details']->json() : [];
            $iucn = isset($responses['iucn']) && $responses['iucn']->successful() ? $responses['iucn']->json() : null;
            $occData = isset($responses['occurrences']) && $responses['occurrences']->successful() ? $responses['occurrences']->json() : [];
            $descData = isset($responses['descriptions']) && $responses['descriptions']->successful() ? $responses['descriptions']->json() : [];
            $mediaData = isset($responses['media']) && $responses['media']->successful() ? $responses['media']->json() : [];

            // Process images with map filtering
            $images = [];
            foreach ($mediaData['results'] ?? [] as $media) {
                if ($media['type'] === 'StillImage') {
                    $title = strtolower($media['title'] ?? '');
                    $desc = strtolower($media['description'] ?? '');
                    
                    // Reject maps and distribution figures
                    if (str_contains($title, 'distribution') || str_contains($title, 'map') || 
                        str_contains($desc, 'distribution') || str_contains($desc, 'map')) {
                        continue;
                    }
                    
                    $images[] = $media['identifier'];
                }
            }

            // Fallback & Photo Prioritization: Check occurrences for real photos (usually iNaturalist)
            $occWithMedia = Http::get("{$this->baseUrl}/occurrence/search", [
                'taxonKey' => $usageKey,
                'mediaType' => 'StillImage',
                'limit' => 10
            ])->json();

            $photos = [];
            foreach ($occWithMedia['results'] ?? [] as $occ) {
                foreach ($occ['media'] ?? [] as $media) {
                    if ($media['type'] === 'StillImage') {
                        $url = $media['identifier'];
                        // Avoid known map/figure servers if possible
                        if (!str_contains($url, 'zenodo.org')) {
                            $photos[] = $url;
                        }
                    }
                }
            }

            // Combine images, prioritizing the 'real' photos from occurrences
            $images = array_merge($photos, $images);

            // Process threats and conservation measures with expanded mapping
            $threats = [];
            foreach ($descData['results'] ?? [] as $desc) {
                if (!isset($desc['type'])) continue;
                
                $type = strtolower($desc['type']);
                $mappedType = null;

                if (in_array($type, ['threats', 'threat'])) {
                    $mappedType = 'THREATS';
                } elseif (in_array($type, ['conservation', 'conservation_measures', 'conservation_status', 'management'])) {
                    $mappedType = strtoupper($type);
                } elseif (in_array($type, ['habitat', 'biology_ecology', 'ecology'])) {
                    $mappedType = 'HABITAT';
                } elseif (in_array($type, ['breeding', 'reproduction'])) {
                    $mappedType = 'REPRODUCTION';
                }

                if ($mappedType) {
                    $threats[] = [
                        'type' => $mappedType,
                        'description' => strip_tags($desc['description'])
                    ];
                }
            }

            // Process sightings stats from facets
            $facets = $occData['facets'] ?? [];
            $yearFacet = collect($facets)->firstWhere('field', 'YEAR')['counts'] ?? [];
            $countryFacet = collect($facets)->firstWhere('field', 'COUNTRY')['counts'] ?? [];

            $currentYear = date('Y');
            $sightingsThisYear = collect($yearFacet)->firstWhere('name', $currentYear)['count'] ?? 0;
            $countries = collect($countryFacet)->pluck('name')->toArray();

            return [
                'identity' => [
                    'usageKey' => $usageKey,
                    'scientificName' => $details['scientificName'] ?? 'Unknown',
                    'canonicalName' => $details['canonicalName'] ?? 'Unknown',
                    'family' => $details['family'] ?? 'Unknown',
                    'kingdom' => $details['kingdom'] ?? 'Unknown',
                ],
                'conservation' => [
                    'status' => $iucn['code'] ?? 'NE',
                    'statusLabel' => $iucn['category'] ?? 'Not Evaluated',
                    'isExtinct' => $details['extinct'] ?? false,
                ],
                'trackerStats' => [
                    'globalSightings' => $occData['count'] ?? 0,
                    'sightingsThisYear' => (int)$sightingsThisYear,
                    'countriesObserved' => $countries,
                    'lastObserved' => $occData['results'][0]['eventDate'] ?? null,
                ],
                'threats' => $threats,
                'images' => array_values(array_unique($images)),
                'mapConfig' => [
                    'taxonKey' => $usageKey,
                    'tileUrl' => "https://api.gbif.org/v2/map/occurrence/density/{z}/{x}/{y}@1x.png?taxonKey={$usageKey}&style=purpleHeat.poly"
                ]
            ];
        } catch (\Exception $e) {
            Log::error("Exception during GBIF tracker metrics fetch: " . $e->getMessage());
            return [];
        }
    }
}

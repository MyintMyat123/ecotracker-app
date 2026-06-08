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
            $limit = max(1, min($limit, 500));

            $response = Http::get("{$this->baseUrl}/occurrence/search", [
                'taxonKey' => $usageKey,
                'basisOfRecord' => 'HUMAN_OBSERVATION',
                'limit' => $limit,
                'hasCoordinate' => 'true',
            ]);

            if ($response->successful()) {
                return $this->cleanOccurrences($response->json()['results'] ?? []);
            }

            Log::error("GBIF API occurrence search failed: " . $response->body());
            return [];
        } catch (\Exception $e) {
            Log::error("Exception during GBIF API occurrence search: " . $e->getMessage());
            return [];
        }
    }

    /**
     * Convert verbose GBIF occurrence records into validated map points.
     *
     * @param array $records
     * @return array
     */
    private function cleanOccurrences(array $records): array
    {
        $cleaned = [];

        foreach ($records as $record) {
            $latitude = $record['decimalLatitude'] ?? null;
            $longitude = $record['decimalLongitude'] ?? null;

            if (!$this->hasValidCoordinates($latitude, $longitude)) {
                continue;
            }

            $key = $record['key'] ?? null;

            $cleaned[] = [
                'key' => $key,
                'latitude' => (float) $latitude,
                'longitude' => (float) $longitude,
                'eventDate' => $record['eventDate'] ?? null,
                'country' => $record['country'] ?? 'Unknown',
                'locality' => $record['locality'] ?? 'Unknown',
                'basisOfRecord' => $record['basisOfRecord'] ?? 'HUMAN_OBSERVATION',
                'gbifUrl' => $key ? "https://www.gbif.org/occurrence/{$key}" : null,
            ];
        }

        return $cleaned;
    }

    private function hasValidCoordinates(mixed $latitude, mixed $longitude): bool
    {
        if (!is_numeric($latitude) || !is_numeric($longitude)) {
            return false;
        }

        $latitude = (float) $latitude;
        $longitude = (float) $longitude;

        return $latitude >= -90 && $latitude <= 90 && $longitude >= -180 && $longitude <= 180;
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

    /**
     * Get species by country and conservation status using GBIF API.
     *
     * @param string $countryName
     * @return array
     */
    public function getSpeciesByCountry(string $countryName): array
    {
        try {
            $countryCode = strtoupper(trim($countryName));
            if (strlen($countryCode) !== 2) {
                $converted = $this->getCountryCodeFromName($countryName);
                if ($converted) {
                    $countryCode = $converted;
                } else {
                    Log::warning("getSpeciesByCountry: Invalid country name/code '{$countryName}'. Must be a 2-letter ISO code or valid country name.");
                    return [];
                }
            }

            $queryString = http_build_query([
                'country' => $countryCode,
                'limit' => 100, // retrieve occurrences to extract unique species
            ]);
            $queryString .= '&iucnRedListCategory=CR&iucnRedListCategory=EN&iucnRedListCategory=VU';

            $url = "{$this->baseUrl}/occurrence/search?{$queryString}";
            Log::info("Fetching GBIF occurrences for species by country code: {$countryCode}, URL: {$url}");
            $response = Http::get($url);

            $uniqueSpecies = [];
            if ($response->successful()) {
                $results = $response->json()['results'] ?? [];
                foreach ($results as $record) {
                    $speciesKey = $record['speciesKey'] ?? null;
                    // Ensure it is species level (has speciesKey), and not already collected
                    if ($speciesKey && !isset($uniqueSpecies[$speciesKey])) {
                        $uniqueSpecies[$speciesKey] = [
                            'scientific_name' => $record['species'] ?? $record['scientificName'] ?? 'Unknown',
                            'conservation_status' => $record['iucnRedListCategory'] ?? 'NE',
                        ];
                    }
                }
            } else {
                Log::error("GBIF API occurrences search failed for country {$countryCode}: " . $response->body());
                return [];
            }

            // Limit to at most 30 species to avoid excessive details calls and keep UI fast
            $uniqueSpecies = array_slice($uniqueSpecies, 0, 30, true);
            $taxonKeys = array_keys($uniqueSpecies);

            if (!empty($taxonKeys)) {
                $responses = Http::pool(function (Pool $pool) use ($taxonKeys) {
                    $requests = [];
                    foreach ($taxonKeys as $key) {
                        $requests[$key] = $pool->get("{$this->baseUrl}/species/{$key}");
                    }
                    return $requests;
                });

                foreach ($uniqueSpecies as $key => &$info) {
                    $res = $responses[$key] ?? null;
                    $vernacularName = null;
                    if ($res && $res->successful()) {
                        $speciesDetails = $res->json();
                        $vernacularName = $speciesDetails['vernacularName'] ?? null;
                    }
                    $info['name'] = $vernacularName ?? $info['scientific_name'];
                    $info['common_name'] = $vernacularName;
                }
            }

            $allSpecies = [];
            foreach ($uniqueSpecies as $key => $info) {
                $allSpecies[] = [
                    'id' => $key,
                    'name' => $info['name'],
                    'common_name' => $info['common_name'],
                    'scientific_name' => $info['scientific_name'],
                    'conservation_status' => $info['conservation_status'],
                    'country' => $countryCode,
                ];
            }

            Log::info("Found " . count($allSpecies) . " unique species for country code: {$countryCode}");
            return $allSpecies;
        } catch (\Exception $e) {
            Log::error("Exception during GBIF API speciesByCountry fetch: " . $e->getMessage());
            return [];
        }
    }

    /**
     * Map common country names to 2-letter ISO codes.
     */
    private function getCountryCodeFromName(string $name): ?string
    {
        $name = strtolower(trim($name));
        $map = [
            'afghanistan' => 'AF', 'aland islands' => 'AX', 'albania' => 'AL', 'algeria' => 'DZ',
            'american samoa' => 'AS', 'andorra' => 'AD', 'angola' => 'AO', 'anguilla' => 'AI',
            'antarctica' => 'AQ', 'antigua and barbuda' => 'AG', 'argentina' => 'AR', 'armenia' => 'AM',
            'aruba' => 'AW', 'australia' => 'AU', 'austria' => 'AT', 'azerbaijan' => 'AZ',
            'bahamas' => 'BS', 'bahrain' => 'BH', 'bangladesh' => 'BD', 'barbados' => 'BB',
            'belarus' => 'BY', 'belgium' => 'BE', 'belize' => 'BZ', 'benin' => 'BJ', 'bermuda' => 'BM',
            'bhutan' => 'BT', 'bolivia' => 'BO', 'bosnia and herzegovina' => 'BA', 'botswana' => 'BW',
            'bouvet island' => 'BV', 'brazil' => 'BR', 'british indian ocean territory' => 'IO',
            'brunei darussalam' => 'BN', 'bulgaria' => 'BG', 'burkina faso' => 'BF', 'burundi' => 'BI',
            'cambodia' => 'KH', 'cameroon' => 'CM', 'canada' => 'CA', 'cape verde' => 'CV',
            'cayman islands' => 'KY', 'central african republic' => 'CF', 'chad' => 'TD', 'chile' => 'CL',
            'china' => 'CN', 'christmas island' => 'CX', 'cocos (keeling) islands' => 'CC', 'colombia' => 'CO',
            'comoros' => 'KM', 'congo' => 'CG', 'congo, democratic republic' => 'CD', 'cook islands' => 'CK',
            'costa rica' => 'CR', 'cote d\'ivoire' => 'CI', 'croatia' => 'HR', 'cuba' => 'CU',
            'cyprus' => 'CY', 'czech republic' => 'CZ', 'denmark' => 'DK', 'djibouti' => 'DJ',
            'dominica' => 'DM', 'dominican republic' => 'DO', 'ecuador' => 'EC', 'egypt' => 'EG',
            'el salvador' => 'SV', 'equatorial guinea' => 'GQ', 'eritrea' => 'ER', 'estonia' => 'EE',
            'ethiopia' => 'ET', 'falkland islands' => 'FK', 'faroe islands' => 'FO', 'fiji' => 'FJ',
            'finland' => 'FI', 'france' => 'FR', 'french guiana' => 'GF', 'french polynesia' => 'PF',
            'french southern territories' => 'TF', 'gabon' => 'GA', 'gambia' => 'GM', 'georgia' => 'GE',
            'germany' => 'DE', 'ghana' => 'GH', 'gibraltar' => 'GI', 'greece' => 'GR', 'greenland' => 'GL',
            'grenada' => 'GD', 'guadeloupe' => 'GP', 'guam' => 'GU', 'guatemala' => 'GT', 'guernsey' => 'GG',
            'guinea' => 'GN', 'guinea-bissau' => 'GW', 'guyana' => 'GY', 'haiti' => 'HT',
            'heard island and mcdonald islands' => 'HM', 'holy see (vatican city state)' => 'VA',
            'honduras' => 'HN', 'hong kong' => 'HK', 'hungary' => 'HU', 'iceland' => 'IS', 'india' => 'IN',
            'indonesia' => 'ID', 'iran, islamic republic of' => 'IR', 'iraq' => 'IQ', 'ireland' => 'IE',
            'isle of man' => 'IM', 'israel' => 'IL', 'italy' => 'IT', 'jamaica' => 'JM', 'japan' => 'JP',
            'jersey' => 'JE', 'jordan' => 'JO', 'kazakhstan' => 'KZ', 'kenya' => 'KE', 'kiribati' => 'KI',
            'korea, democratic people\'s republic of' => 'KP', 'korea, republic of' => 'KR', 'kuwait' => 'KW',
            'kyrgyzstan' => 'KG', 'lao people\'s democratic republic' => 'LA', 'latvia' => 'LV',
            'lebanon' => 'LB', 'lesotho' => 'LS', 'liberia' => 'LR', 'libyan arab jamahiriya' => 'LY',
            'liechtenstein' => 'LI', 'lithuania' => 'LT', 'luxembourg' => 'LU', 'macao' => 'MO',
            'macedonia' => 'MK', 'madagascar' => 'MG', 'malawi' => 'MW', 'malaysia' => 'MY',
            'maldives' => 'MV', 'mali' => 'ML', 'malta' => 'MT', 'marshall islands' => 'MH',
            'martinique' => 'MQ', 'mauritania' => 'MR', 'mauritius' => 'MU', 'mayotte' => 'YT',
            'mexico' => 'MX', 'micronesia' => 'FM', 'moldova, republic of' => 'MD', 'monaco' => 'MC',
            'mongolia' => 'MN', 'montenegro' => 'ME', 'monserrat' => 'MS', 'morocco' => 'MA',
            'mozambique' => 'MZ', 'myanmar' => 'MM', 'namibia' => 'NA', 'nauru' => 'NR', 'nepal' => 'NP',
            'netherlands' => 'NL', 'netherlands antilles' => 'AN', 'new caledonia' => 'NC',
            'new zealand' => 'NZ', 'nicaragua' => 'NI', 'niger' => 'NE', 'nigeria' => 'NG', 'niue' => 'NU',
            'norfolk island' => 'NF', 'northern mariana islands' => 'MP', 'norway' => 'NO',
            'oman' => 'OM', 'pakistan' => 'PK', 'palau' => 'PW', 'palestinian territory' => 'PS',
            'panama' => 'PA', 'papua new guinea' => 'PG', 'paraguay' => 'PY', 'peru' => 'PE',
            'philippines' => 'PH', 'pitcairn' => 'PN', 'poland' => 'PL', 'portugal' => 'PT',
            'puerto rico' => 'PR', 'qatar' => 'QA', 'reunion' => 'RE', 'romania' => 'RO',
            'russian federation' => 'RU', 'rwanda' => 'RW', 'saint barthelemy' => 'BL',
            'saint helena' => 'SH', 'saint kitts and nevis' => 'KN', 'saint lucia' => 'LC',
            'saint martin' => 'MF', 'saint pierre and miquelon' => 'PM', 'saint vincent and grenadines' => 'VC',
            'samoa' => 'WS', 'san marino' => 'SM', 'sao tome and principe' => 'ST', 'saudi arabia' => 'SA',
            'senegal' => 'SN', 'serbia' => 'RS', 'seychelles' => 'SC', 'sierra leone' => 'SL',
            'singapore' => 'SG', 'slovakia' => 'SK', 'slovenia' => 'SI', 'solomon islands' => 'SB',
            'somalia' => 'SO', 'south africa' => 'ZA', 'south georgia and south sandwich islands' => 'GS',
            'spain' => 'ES', 'sri lanka' => 'LK', 'sudan' => 'SD', 'suriname' => 'SR',
            'svalbard and jan mayen' => 'SJ', 'swaziland' => 'SZ', 'sweden' => 'SE', 'switzerland' => 'CH',
            'syrian arab republic' => 'SY', 'taiwan' => 'TW', 'tajikistan' => 'TJ', 'tanzania' => 'TZ',
            'thailand' => 'TH', 'timor-leste' => 'TL', 'togo' => 'TG', 'tokelau' => 'TK', 'tonga' => 'TO',
            'trinidad and tobago' => 'TT', 'tunisia' => 'TN', 'turkey' => 'TR', 'turkmenistan' => 'TM',
            'turks and caicos islands' => 'TC', 'tuvalu' => 'TV', 'uganda' => 'UG', 'ukraine' => 'UA',
            'united arab emirates' => 'AE', 'united kingdom' => 'GB', 'uk' => 'GB', 'united states' => 'US',
            'united states of america' => 'US', 'usa' => 'US', 'uruguay' => 'UY', 'uzbekistan' => 'UZ',
            'vanuatu' => 'VU', 'venezuela' => 'VE', 'vietnam' => 'VN', 'virgin islands, british' => 'VG',
            'virgin islands, u.s.' => 'VI', 'wallis and futuna' => 'WF', 'western sahara' => 'EH',
            'yemen' => 'YE', 'zambia' => 'ZM', 'zimbabwe' => 'ZW'
        ];
        return $map[$name] ?? null;
    }
}

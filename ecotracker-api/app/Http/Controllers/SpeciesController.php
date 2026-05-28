<?php

namespace App\Http\Controllers;

use App\Services\SpeciesService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SpeciesController extends Controller
{
    protected SpeciesService $speciesService;

    public function __construct(SpeciesService $speciesService)
    {
        $this->speciesService = $speciesService;
    }

    /**
     * Search for species by name.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function search(Request $request): JsonResponse
    {
        $request->validate([
            'query' => 'required|string|min:2',
        ]);

        $query = $request->input('query');
        $results = $this->speciesService->searchByName($query);

        return response()->json($results);
    }

    /**
     * Get autocomplete suggestions for species.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function suggest(Request $request): JsonResponse
    {
        $request->validate([
            'query' => 'required|string|min:2',
        ]);

        $query = $request->input('query');
        $results = $this->speciesService->suggest($query);

        return response()->json($results);
    }

    /**
     * Get details for a specific species by GBIF key.
     *
     * @param int $usageKey
     * @return JsonResponse
     */
    public function show(int $usageKey): JsonResponse
    {
        $details = $this->speciesService->getDetails($usageKey);

        if (empty($details)) {
            return response()->json(['message' => 'Species not found'], 404);
        }

        return response()->json($details);
    }

    /**
     * Get recent occurrences for a specific species by GBIF key.
     *
     * @param int $usageKey
     * @return JsonResponse
     */
    public function occurrences(Request $request, int $usageKey): JsonResponse
    {
        $validated = $request->validate([
            'limit' => 'sometimes|integer|min:1|max:500',
        ]);

        $results = $this->speciesService->getOccurrences($usageKey, $validated['limit'] ?? 20);

        return response()->json($results);
    }

    /**
     * Get professional tracker metrics for a specific species by GBIF key.
     *
     * @param int $usageKey
     * @return JsonResponse
     */
    public function tracker(int $usageKey): JsonResponse
    {
        $metrics = $this->speciesService->getTrackerMetrics($usageKey);

        if (empty($metrics)) {
            return response()->json(['message' => 'Tracker data not found'], 404);
        }

        return response()->json($metrics);
    }
}

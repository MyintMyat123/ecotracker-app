<?php

namespace App\Http\Controllers;

use App\Models\Watchlist;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WatchlistController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $items = $request->user()
            ->watchlists()
            ->latest()
            ->get();

        return response()->json($items);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'gbif_species_key' => 'required|integer|min:1',
            'common_name' => 'nullable|string|max:255',
            'scientific_name' => 'required|string|max:255',
            'conservation_status' => 'nullable|string|max:20',
            'conservation_status_label' => 'nullable|string|max:255',
            'family' => 'nullable|string|max:255',
            'kingdom' => 'nullable|string|max:255',
            'image_url' => 'nullable|string|max:2048',
            'last_observed_at' => 'nullable|date',
        ]);

        $item = Watchlist::updateOrCreate(
            [
                'user_id' => $request->user()->id,
                'gbif_species_key' => $validated['gbif_species_key'],
            ],
            $validated
        );

        return response()->json($item, $item->wasRecentlyCreated ? 201 : 200);
    }

    public function destroy(Request $request, int $gbifSpeciesKey): JsonResponse
    {
        $deleted = $request->user()
            ->watchlists()
            ->where('gbif_species_key', $gbifSpeciesKey)
            ->delete();

        if (!$deleted) {
            return response()->json([
                'message' => 'Watchlist item not found.',
            ], 404);
        }

        return response()->json([
            'message' => 'Species removed from watchlist.',
        ]);
    }
}

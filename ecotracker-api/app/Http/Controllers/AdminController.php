<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Watchlist;
use App\Models\AppNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminController extends Controller
{
    /**
     * Get dashboard statistics.
     */
    public function stats(): JsonResponse
    {
        $totalUsers     = User::count();
        $activeUsers    = User::where('is_active', true)->count();
        $adminUsers     = User::where('role', 'admin')->count();
        $totalWatchlist = Watchlist::count();
        $recentUsers    = User::where('created_at', '>=', now()->subDays(7))->count();

        // Top watched species
        $topSpecies = Watchlist::select('gbif_species_key', 'scientific_name', 'common_name', 'conservation_status_label')
            ->selectRaw('COUNT(*) as watch_count')
            ->groupBy('gbif_species_key', 'scientific_name', 'common_name', 'conservation_status_label')
            ->orderByDesc('watch_count')
            ->limit(10)
            ->get();

        // Conservation status distribution in watchlists
        $statusDist = Watchlist::select('conservation_status_label')
            ->selectRaw('COUNT(*) as count')
            ->whereNotNull('conservation_status_label')
            ->groupBy('conservation_status_label')
            ->orderByDesc('count')
            ->get();

        return response()->json([
            'stats' => [
                'total_users'     => $totalUsers,
                'active_users'    => $activeUsers,
                'admin_users'     => $adminUsers,
                'total_watchlist' => $totalWatchlist,
                'recent_users'    => $recentUsers,
            ],
            'top_species'  => $topSpecies,
            'status_dist'  => $statusDist,
        ]);
    }

    /**
     * List all users with pagination.
     */
    public function users(Request $request): JsonResponse
    {
        $query = User::withCount('watchlists')
            ->orderByDesc('created_at');

        if ($request->has('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%");
            });
        }

        if ($request->has('role')) {
            $query->where('role', $request->input('role'));
        }

        $users = $query->paginate(20);

        return response()->json($users);
    }

    /**
     * Get a single user's details.
     */
    public function showUser(int $id): JsonResponse
    {
        $user = User::withCount('watchlists')
            ->with(['watchlists' => fn($q) => $q->orderByDesc('created_at')->limit(5)])
            ->findOrFail($id);

        return response()->json($user);
    }

    /**
     * Update a user's role or active status.
     */
    public function updateUser(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'role'      => 'sometimes|in:user,admin',
            'is_active' => 'sometimes|boolean',
            'name'      => 'sometimes|string|max:255',
        ]);

        $user = User::findOrFail($id);

        // Prevent demoting the last admin
        if (isset($validated['role']) && $validated['role'] !== 'admin' && $user->role === 'admin') {
            $adminCount = User::where('role', 'admin')->count();
            if ($adminCount <= 1) {
                return response()->json(['message' => 'Cannot remove the last admin user.'], 422);
            }
        }

        $user->update($validated);

        // Notify user if their status changed
        if (isset($validated['is_active'])) {
            $user->appNotifications()->create([
                'type'    => 'system',
                'title'   => $validated['is_active'] ? 'Account Reactivated' : 'Account Deactivated',
                'message' => $validated['is_active']
                    ? 'Your account has been reactivated. Welcome back!'
                    : 'Your account has been deactivated. Please contact support.',
                'data'    => [],
            ]);
        }

        return response()->json([
            'message' => 'User updated successfully.',
            'user'    => $user->only(['id', 'name', 'email', 'role', 'is_active']),
        ]);
    }

    /**
     * Delete a user account.
     */
    public function deleteUser(int $id): JsonResponse
    {
        $user = User::findOrFail($id);

        // Prevent deleting last admin
        if ($user->role === 'admin') {
            $adminCount = User::where('role', 'admin')->count();
            if ($adminCount <= 1) {
                return response()->json(['message' => 'Cannot delete the last admin user.'], 422);
            }
        }

        $user->delete();

        return response()->json(['message' => 'User deleted successfully.']);
    }

    /**
     * Send a broadcast notification to all users or a specific user.
     */
    public function broadcastNotification(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title'                         => 'required|string|max:255',
            'message'                       => 'required|string',
            'user_id'                       => 'sometimes|exists:users,id',
            'user_ids'                      => 'sometimes|array',
            'user_ids.*'                    => 'integer|exists:users,id',
            'species'                       => 'sometimes|array|max:10',
            'species.*.gbif_species_key'    => 'required_with:species|integer|min:1',
            'species.*.common_name'         => 'nullable|string|max:255',
            'species.*.scientific_name'     => 'required_with:species|string|max:255',
            'species.*.conservation_status' => 'nullable|string|max:80',
        ]);

        if (!empty($validated['user_ids'])) {
            $users = User::whereIn('id', array_unique($validated['user_ids']))->get();
        } elseif (isset($validated['user_id'])) {
            $users = User::where('id', $validated['user_id'])->get();
        } else {
            $users = User::where('is_active', true)->get();
        }

        $attachedSpecies = collect($validated['species'] ?? [])
            ->map(fn(array $species) => [
                'gbif_species_key'    => (int) $species['gbif_species_key'],
                'species_name'        => ($species['common_name'] ?? null) ?: $species['scientific_name'],
                'common_name'         => $species['common_name'] ?? null,
                'scientific_name'     => $species['scientific_name'],
                'conservation_status' => $species['conservation_status'] ?? null,
            ])
            ->values()
            ->all();

        $data = [
            'from'            => 'admin',
            'recipient_scope' => !empty($validated['user_ids']) || isset($validated['user_id']) ? 'selected_users' : 'all_active_users',
        ];

        if (!empty($attachedSpecies)) {
            $data['attached_species'] = $attachedSpecies;
            $data['species_count'] = count($attachedSpecies);

            if (count($attachedSpecies) === 1) {
                $species = $attachedSpecies[0];
                $data['gbif_species_key'] = $species['gbif_species_key'];
                $data['species_name'] = $species['species_name'];
                $data['scientific_name'] = $species['scientific_name'];
                $data['conservation_status'] = $species['conservation_status'];
            }
        }

        foreach ($users as $user) {
            $user->appNotifications()->create([
                'type'    => 'system',
                'title'   => $validated['title'],
                'message' => $validated['message'],
                'data'    => $data,
            ]);
        }

        return response()->json([
            'message' => "Notification sent to {$users->count()} user(s).",
        ]);
    }
}

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
            'title'   => 'required|string|max:255',
            'message' => 'required|string',
            'user_id' => 'sometimes|exists:users,id',
        ]);

        if (isset($validated['user_id'])) {
            $users = User::where('id', $validated['user_id'])->get();
        } else {
            $users = User::where('is_active', true)->get();
        }

        foreach ($users as $user) {
            $user->appNotifications()->create([
                'type'    => 'system',
                'title'   => $validated['title'],
                'message' => $validated['message'],
                'data'    => ['from' => 'admin'],
            ]);
        }

        return response()->json([
            'message' => "Notification sent to {$users->count()} user(s).",
        ]);
    }
}

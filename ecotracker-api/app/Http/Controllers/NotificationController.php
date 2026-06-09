<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    /**
     * Get all notifications for the authenticated user.
     */
    public function index(Request $request): JsonResponse
    {
        $notifications = $request->user()
            ->appNotifications()
            ->orderByDesc('created_at')
            ->limit(50)
            ->get();

        $unreadCount = $request->user()
            ->appNotifications()
            ->where('is_read', false)
            ->count();

        return response()->json([
            'notifications' => $notifications,
            'unread_count'  => $unreadCount,
        ]);
    }

    /**
     * Mark a single notification as read.
     */
    public function markRead(Request $request, int $id): JsonResponse
    {
        $notification = $request->user()
            ->appNotifications()
            ->findOrFail($id);

        $notification->update(['is_read' => true]);

        return response()->json(['message' => 'Notification marked as read.']);
    }

    /**
     * Mark all notifications as read.
     */
    public function markAllRead(Request $request): JsonResponse
    {
        $request->user()
            ->appNotifications()
            ->where('is_read', false)
            ->update(['is_read' => true]);

        return response()->json(['message' => 'All notifications marked as read.']);
    }

    /**
     * Delete a notification.
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $notification = $request->user()
            ->appNotifications()
            ->findOrFail($id);

        $notification->delete();

        return response()->json(['message' => 'Notification deleted.']);
    }

    /**
     * Get unread count only (lightweight poll endpoint).
     */
    public function unreadCount(Request $request): JsonResponse
    {
        $count = $request->user()
            ->appNotifications()
            ->where('is_read', false)
            ->count();

        return response()->json(['unread_count' => $count]);
    }
}

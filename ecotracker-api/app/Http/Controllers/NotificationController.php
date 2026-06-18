<?php

namespace App\Http\Controllers;

use App\Models\AppNotification;
use App\Services\AppNotificationEmailService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function __construct(private AppNotificationEmailService $emailService)
    {
    }

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
     * Get a single notification for the authenticated user.
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $notification = $request->user()
            ->appNotifications()
            ->findOrFail($id);

        return response()->json($notification);
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

    /**
     * Send a test notification email to the authenticated user.
     */
    public function sendTestEmail(Request $request): JsonResponse
    {
        $notification = AppNotification::withoutEvents(fn () => $request->user()->appNotifications()->create([
            'type' => 'email_test',
            'title' => 'EcoTracker Email Test',
            'message' => 'Your EcoTracker email notification setup is working.',
            'data' => ['from' => 'email_test'],
            'is_read' => false,
        ]));

        $sent = $this->emailService->send($notification, force: true);

        return response()->json([
            'sent' => $sent,
            'notification' => $notification,
            'message' => $sent
                ? 'Test email sent.'
                : 'Test email was not sent. Check EMAIL_NOTIFICATIONS_ENABLED and mail settings.',
        ], $sent ? 200 : 422);
    }
}

<?php

namespace App\Services;

use App\Mail\AppNotificationMail;
use App\Models\AppNotification;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class AppNotificationEmailService
{
    public function send(AppNotification $notification, bool $force = false): bool
    {
        if (!config('services.notifications.email_enabled')) {
            return false;
        }

        $notification->loadMissing('user');
        $user = $notification->user;

        if (!$user || !$user->email || !$user->is_active) {
            return false;
        }

        if (!$force && !$this->shouldSendType((string) $notification->type)) {
            return false;
        }

        try {
            Mail::to($user->email)->send(
                new AppNotificationMail($notification, $this->actionUrl($notification))
            );

            return true;
        } catch (\Throwable $e) {
            Log::warning('Failed to send notification email', [
                'notification_id' => $notification->id,
                'user_id' => $notification->user_id,
                'type' => $notification->type,
                'error' => $e->getMessage(),
            ]);

            return false;
        }
    }

    private function shouldSendType(string $type): bool
    {
        $configuredTypes = config('services.notifications.email_types');

        if (!$configuredTypes) {
            return true;
        }

        $allowedTypes = collect(explode(',', $configuredTypes))
            ->map(fn (string $item) => trim($item))
            ->filter()
            ->all();

        return in_array($type, $allowedTypes, true);
    }

    private function actionUrl(AppNotification $notification): string
    {
        $baseUrl = rtrim((string) config('services.notifications.frontend_url'), '/');

        return "{$baseUrl}/#notification={$notification->id}";
    }
}

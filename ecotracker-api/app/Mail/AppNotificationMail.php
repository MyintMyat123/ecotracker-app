<?php

namespace App\Mail;

use App\Models\AppNotification;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class AppNotificationMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public AppNotification $notification,
        public string $actionUrl,
    ) {
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "EcoTracker: {$this->notification->title}",
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.app-notification',
        );
    }
}

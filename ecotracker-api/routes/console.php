<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;
use App\Services\WatchlistMonitoringService;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('watchlist:monitor {--limit= : Maximum watchlist rows to check}', function () {
    $monitor = app(WatchlistMonitoringService::class);
    $limit = $this->option('limit') ? (int) $this->option('limit') : null;
    $stats = $monitor->monitorAll($limit);

    $this->info("Checked {$stats['checked']} watchlist row(s).");
    $this->line("Baselines created: {$stats['baselined']}");
    $this->line("Notifications created: {$stats['notifications']}");

    if ($stats['failed'] > 0) {
        $this->warn("Failed checks: {$stats['failed']}");
    }
})->purpose('Check watchlisted species against GBIF and notify users about conservation-relevant changes');

Schedule::command('watchlist:monitor')
    ->dailyAt('02:00')
    ->withoutOverlapping();

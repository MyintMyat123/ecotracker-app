<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\SpeciesController;
use App\Http\Controllers\WatchlistController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\AdminController;
use App\Http\Controllers\AiController;

// Auth routes
Route::prefix('auth')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login',    [AuthController::class, 'login']);

    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/me',      [AuthController::class, 'me']);
        Route::post('/logout', [AuthController::class, 'logout']);
    });
});

// Species routes (public)
Route::prefix('species')->group(function () {
    Route::get('/search',               [SpeciesController::class, 'search']);
    Route::get('/suggest',              [SpeciesController::class, 'suggest']);
    Route::get('/country/{countryName}',[SpeciesController::class, 'speciesByCountry']);
    Route::get('/{usageKey}',           [SpeciesController::class, 'show']);
    Route::get('/{usageKey}/occurrences',[SpeciesController::class, 'occurrences']);
    Route::get('/{usageKey}/tracker',   [SpeciesController::class, 'tracker']);
});

// Watchlist routes (authenticated)
Route::middleware('auth:sanctum')->prefix('watchlist')->group(function () {
    Route::get('/',                      [WatchlistController::class, 'index']);
    Route::post('/',                     [WatchlistController::class, 'store']);
    Route::delete('/{gbifSpeciesKey}',   [WatchlistController::class, 'destroy']);
});

// Notification routes (authenticated)
Route::middleware('auth:sanctum')->prefix('notifications')->group(function () {
    Route::get('/',                 [NotificationController::class, 'index']);
    Route::get('/unread-count',     [NotificationController::class, 'unreadCount']);
    Route::patch('/{id}/read',      [NotificationController::class, 'markRead']);
    Route::post('/mark-all-read',   [NotificationController::class, 'markAllRead']);
    Route::delete('/{id}',          [NotificationController::class, 'destroy']);
});

// AI Overview route (public - rate limited by IP in production)
Route::post('/ai/overview', [AiController::class, 'overview']);

// Admin routes (authenticated + admin role)
Route::middleware(['auth:sanctum', 'admin'])->prefix('admin')->group(function () {
    Route::get('/stats',                        [AdminController::class, 'stats']);
    Route::get('/users',                        [AdminController::class, 'users']);
    Route::get('/users/{id}',                   [AdminController::class, 'showUser']);
    Route::patch('/users/{id}',                 [AdminController::class, 'updateUser']);
    Route::delete('/users/{id}',                [AdminController::class, 'deleteUser']);
    Route::post('/notifications/broadcast',     [AdminController::class, 'broadcastNotification']);
});

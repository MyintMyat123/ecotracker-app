<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\SpeciesController;
use App\Http\Controllers\WatchlistController;

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

Route::prefix('auth')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);

    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/me', [AuthController::class, 'me']);
        Route::post('/logout', [AuthController::class, 'logout']);
    });
});

Route::prefix('species')->group(function () {
    Route::get('/search', [SpeciesController::class, 'search']);
    Route::get('/suggest', [SpeciesController::class, 'suggest']);
    Route::get('/{usageKey}', [SpeciesController::class, 'show']);
    Route::get('/{usageKey}/occurrences', [SpeciesController::class, 'occurrences']);
    Route::get('/{usageKey}/tracker', [SpeciesController::class, 'tracker']);
});

Route::middleware('auth:sanctum')->prefix('watchlist')->group(function () {
    Route::get('/', [WatchlistController::class, 'index']);
    Route::post('/', [WatchlistController::class, 'store']);
    Route::delete('/{gbifSpeciesKey}', [WatchlistController::class, 'destroy']);
});

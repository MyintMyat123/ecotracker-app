<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

use App\Http\Controllers\SpeciesController;

Route::prefix('species')->group(function () {
    Route::get('/search', [SpeciesController::class, 'search']);
    Route::get('/suggest', [SpeciesController::class, 'suggest']);
    Route::get('/{usageKey}', [SpeciesController::class, 'show']);
    Route::get('/{usageKey}/occurrences', [SpeciesController::class, 'occurrences']);
    Route::get('/{usageKey}/tracker', [SpeciesController::class, 'tracker']);
});

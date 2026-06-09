<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'user_id',
    'gbif_species_key',
    'common_name',
    'scientific_name',
    'conservation_status',
    'conservation_status_label',
    'family',
    'kingdom',
    'image_url',
    'last_observed_at',
])]
class Watchlist extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return [
            'last_observed_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}

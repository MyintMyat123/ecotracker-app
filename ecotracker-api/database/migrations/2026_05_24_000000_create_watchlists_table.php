<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('watchlists', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('gbif_species_key');
            $table->string('common_name')->nullable();
            $table->string('scientific_name');
            $table->string('conservation_status', 20)->nullable();
            $table->string('conservation_status_label')->nullable();
            $table->string('family')->nullable();
            $table->string('kingdom')->nullable();
            $table->text('image_url')->nullable();
            $table->timestamp('last_observed_at')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'gbif_species_key']);
            $table->index('gbif_species_key');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('watchlists');
    }
};

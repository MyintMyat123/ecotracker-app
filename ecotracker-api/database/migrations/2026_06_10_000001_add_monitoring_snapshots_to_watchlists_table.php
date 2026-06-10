<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('watchlists', function (Blueprint $table) {
            $table->unsignedBigInteger('last_known_occurrence_count')->nullable()->after('last_observed_at');
            $table->unsignedInteger('last_known_country_count')->nullable()->after('last_known_occurrence_count');
            $table->unsignedInteger('last_known_media_count')->nullable()->after('last_known_country_count');
            $table->unsignedInteger('last_known_coordinate_count')->nullable()->after('last_known_media_count');
            $table->unsignedInteger('last_known_issue_count')->nullable()->after('last_known_coordinate_count');
            $table->json('monitoring_snapshot')->nullable()->after('last_known_issue_count');
            $table->timestamp('monitored_at')->nullable()->after('monitoring_snapshot');
        });
    }

    public function down(): void
    {
        Schema::table('watchlists', function (Blueprint $table) {
            $table->dropColumn([
                'last_known_occurrence_count',
                'last_known_country_count',
                'last_known_media_count',
                'last_known_coordinate_count',
                'last_known_issue_count',
                'monitoring_snapshot',
                'monitored_at',
            ]);
        });
    }
};

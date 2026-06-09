<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminSeeder extends Seeder
{
    public function run(): void
    {
        User::updateOrCreate(
            ['email' => 'admin@ecotracker.app'],
            [
                'name'      => 'EcoTracker Admin',
                'password'  => Hash::make('Admin@123456'),
                'role'      => 'admin',
                'is_active' => true,
            ]
        );
    }
}

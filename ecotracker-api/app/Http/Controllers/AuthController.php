<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name'     => 'required|string|max:255',
            'email'    => 'required|string|email|max:255|unique:users,email',
            'password' => 'required|string|min:8|confirmed',
        ]);

        $user = User::create([
            'name'      => $validated['name'],
            'email'     => $validated['email'],
            'password'  => $validated['password'],
            'role'      => 'user',
            'is_active' => true,
        ]);

        // Welcome notification
        $user->appNotifications()->create([
            'type'    => 'system',
            'title'   => 'Welcome to EcoTracker!',
            'message' => 'Thank you for joining EcoTracker. Start exploring endangered species and add them to your watchlist.',
            'data'    => ['action' => 'explore'],
        ]);

        $token = $user->createToken('ecotracker-ui')->plainTextToken;

        return response()->json([
            'user'  => $user->only(['id', 'name', 'email', 'role']),
            'token' => $token,
        ], 201);
    }

    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email'    => 'required|string|email',
            'password' => 'required|string',
        ]);

        $user = User::where('email', $validated['email'])->first();

        if (!$user || !Hash::check($validated['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        if (!$user->is_active) {
            return response()->json(['message' => 'Your account has been deactivated.'], 403);
        }

        $user->update(['last_login_at' => now()]);

        $token = $user->createToken('ecotracker-ui')->plainTextToken;

        return response()->json([
            'user'  => $user->only(['id', 'name', 'email', 'role']),
            'token' => $token,
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();
        return response()->json([
            'user' => $user->only(['id', 'name', 'email', 'role']),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()?->currentAccessToken()?->delete();
        return response()->json(['message' => 'Signed out successfully.']);
    }
}

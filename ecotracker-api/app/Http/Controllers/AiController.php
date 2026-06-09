<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class AiController extends Controller
{
    /**
     * Generate AI bullet-point overview from species description text.
     * Uses OpenAI-compatible endpoint.
     */
    public function overview(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'text'    => 'required|string|min:20|max:8000',
            'context' => 'sometimes|string|max:100',
            'type'    => 'sometimes|string|max:100', // alias for context
        ]);

        $text    = $validated['text'];
        $context = $validated['context'] ?? $validated['type'] ?? 'general';

        $systemPrompt = "You are a conservation biology expert. Summarize the following species {$context} information into clear, concise bullet points. Each bullet point should be a single, actionable or informative sentence. Use plain language suitable for the general public. Return ONLY the bullet points, one per line, each starting with a • character. Do not include headers, introductions, or conclusions.";

        try {
            $apiKey  = env('OPENAI_API_KEY');
            $apiBase = env('OPENAI_API_BASE', 'https://api.openai.com/v1');

            if (!$apiKey) {
                // Fallback: simple sentence splitting
                return $this->fallbackSummary($text);
            }

            $response = Http::withHeaders([
                'Authorization' => "Bearer {$apiKey}",
                'Content-Type'  => 'application/json',
            ])->post("{$apiBase}/chat/completions", [
                'model'       => 'gpt-5-mini',
                'messages'    => [
                    ['role' => 'system', 'content' => $systemPrompt],
                    ['role' => 'user', 'content' => $text],
                ],
                'max_tokens'  => 500,
                'temperature' => 0.3,
            ]);

            if ($response->successful()) {
                // Check for insufficient credits error in successful response
                if ($response->json('error')) {
                    Log::warning('AI overview API error: ' . $response->body());
                    return $this->fallbackSummary($text);
                }
                $content = $response->json('choices.0.message.content', '');
                $bullets = $this->parseBullets($content);

                return response()->json([
                    'bullets' => $bullets,
                    'source'  => 'ai',
                ]);
            }

            Log::warning('AI overview API call failed: ' . $response->body());
            return $this->fallbackSummary($text);

        } catch (\Exception $e) {
            Log::error('AI overview exception: ' . $e->getMessage());
            return $this->fallbackSummary($text);
        }
    }

    /**
     * Parse bullet points from AI response.
     */
    private function parseBullets(string $content): array
    {
        $lines = explode("\n", trim($content));
        $bullets = [];

        foreach ($lines as $line) {
            $line = trim($line);
            if (empty($line)) continue;

            // Remove leading bullet markers
            $line = preg_replace('/^[•\-\*]\s*/', '', $line);
            $line = preg_replace('/^\d+\.\s*/', '', $line);

            if (strlen($line) > 10) {
                $bullets[] = $line;
            }
        }

        return array_values(array_filter($bullets));
    }

    /**
     * Fallback: split text into sentences and return as bullets.
     */
    private function fallbackSummary(string $text): JsonResponse
    {
        // Split into sentences
        $sentences = preg_split('/(?<=[.!?])\s+/', strip_tags($text), -1, PREG_SPLIT_NO_EMPTY);
        $bullets   = [];

        foreach ($sentences as $sentence) {
            $sentence = trim($sentence);
            if (strlen($sentence) > 20 && strlen($sentence) < 300) {
                $bullets[] = $sentence;
            }
        }

        // Limit to 8 bullets
        $bullets = array_slice($bullets, 0, 8);

        return response()->json([
            'bullets' => $bullets,
            'source'  => 'fallback',
        ]);
    }
}

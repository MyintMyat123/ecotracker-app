<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class AiController extends Controller
{
    /**
     * Generate AI bullet-point overviews from one text block or multiple labelled sections.
     */
    public function overview(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'text' => 'required_without:sections|string|min:20|max:8000',
            'context' => 'sometimes|string|max:100',
            'type' => 'sometimes|string|max:100',
            'sections' => 'required_without:text|array|min:1|max:12',
            'sections.*.label' => 'required_with:sections|string|max:120',
            'sections.*.text' => 'required_with:sections|string|min:20|max:8000',
        ]);

        $sections = $this->normalizeSections($validated);
        $context = $validated['context'] ?? $validated['type'] ?? 'general';

        try {
            $apiKey = env('GEMINI_API_KEY');
            $model = env('GEMINI_MODEL', 'gemini-1.5-flash');

            if (!$apiKey) {
                return $this->fallbackSummary($sections);
            }

            $response = Http::timeout(45)->post(
                "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$apiKey}",
                [
                    'contents' => [[
                        'role' => 'user',
                        'parts' => [[
                            'text' => $this->buildGeminiPrompt($sections, $context),
                        ]],
                    ]],
                    'generationConfig' => [
                        'temperature' => 0.25,
                        'maxOutputTokens' => 1200,
                        'responseMimeType' => 'application/json',
                    ],
                ],
            );

            if (!$response->successful() || $response->json('error')) {
                Log::warning('Gemini overview API call failed: ' . $response->body());
                return $this->fallbackSummary($sections);
            }

            $content = $response->json('candidates.0.content.parts.0.text', '');
            $summaries = $this->parseSectionSummaries($content, $sections);

            return response()->json([
                'bullets' => $summaries[0]['bullets'] ?? [],
                'summaries' => $summaries,
                'source' => 'ai',
            ]);
        } catch (\Throwable $e) {
            Log::error('Gemini overview exception: ' . $e->getMessage());
            return $this->fallbackSummary($sections);
        }
    }

    private function normalizeSections(array $validated): array
    {
        if (!empty($validated['sections'])) {
            return collect($validated['sections'])
                ->map(fn ($section) => [
                    'label' => trim((string) $section['label']),
                    'text' => trim(strip_tags((string) $section['text'])),
                ])
                ->filter(fn ($section) => strlen($section['text']) >= 20)
                ->values()
                ->all();
        }

        return [[
            'label' => $validated['context'] ?? $validated['type'] ?? 'Summary',
            'text' => trim(strip_tags((string) $validated['text'])),
        ]];
    }

    private function buildGeminiPrompt(array $sections, string $context): string
    {
        $payload = json_encode($sections, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);

        return <<<PROMPT
You are a conservation biology expert helping summarize GBIF ecological information.
Summarize each labelled {$context} section into 3 to 5 concise bullet points.
Use plain language for conservation monitoring. Preserve the exact labels from the input.
Return only valid JSON in this exact shape:
{
  "summaries": [
    {
      "label": "same label from input",
      "bullets": ["short point", "short point"]
    }
  ]
}

Input sections:
{$payload}
PROMPT;
    }

    private function parseSectionSummaries(string $content, array $sourceSections): array
    {
        $content = trim($content);
        $content = preg_replace('/^```(?:json)?\s*/', '', $content);
        $content = preg_replace('/\s*```$/', '', $content);

        $decoded = json_decode($content, true);
        $items = $decoded['summaries'] ?? (is_array($decoded) ? $decoded : null);

        if (!is_array($items)) {
            return $this->fallbackSummaries($sourceSections);
        }

        $summaries = [];
        foreach ($items as $item) {
            $label = trim((string) ($item['label'] ?? ''));
            $bullets = $item['bullets'] ?? [];

            if ($label === '' || !is_array($bullets)) {
                continue;
            }

            $cleanBullets = collect($bullets)
                ->map(fn ($bullet) => trim((string) $bullet))
                ->filter(fn ($bullet) => strlen($bullet) > 10)
                ->take(5)
                ->values()
                ->all();

            if (!empty($cleanBullets)) {
                $summaries[] = [
                    'label' => $label,
                    'bullets' => $cleanBullets,
                ];
            }
        }

        return !empty($summaries) ? $summaries : $this->fallbackSummaries($sourceSections);
    }

    private function fallbackSummary(array $sections): JsonResponse
    {
        $summaries = $this->fallbackSummaries($sections);

        return response()->json([
            'bullets' => $summaries[0]['bullets'] ?? [],
            'summaries' => $summaries,
            'source' => 'fallback',
        ]);
    }

    private function fallbackSummaries(array $sections): array
    {
        return collect($sections)
            ->map(fn ($section) => [
                'label' => $section['label'],
                'bullets' => $this->sentenceBullets($section['text']),
            ])
            ->values()
            ->all();
    }

    private function sentenceBullets(string $text): array
    {
        $sentences = preg_split('/(?<=[.!?])\s+/', strip_tags($text), -1, PREG_SPLIT_NO_EMPTY);
        $bullets = [];

        foreach ($sentences as $sentence) {
            $sentence = trim($sentence);
            if (strlen($sentence) > 20 && strlen($sentence) < 300) {
                $bullets[] = $sentence;
            }
        }

        return array_slice($bullets, 0, 5);
    }
}

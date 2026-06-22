<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class AiController extends Controller
{
    /**
     * Build a structured ecological field brief from one GBIF text section.
     */
    public function overview(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'text' => 'required|string|min:20|max:9000',
            'context' => 'sometimes|string|max:120',
            'type' => 'sometimes|string|max:100',
            'commonName' => 'sometimes|string|max:160',
            'scientificName' => 'sometimes|string|max:220',
            'conservationStatus' => 'sometimes|string|max:80',
        ]);

        $section = [
            'label' => trim((string) ($validated['context'] ?? $validated['type'] ?? 'Ecological profile')),
            'text' => $this->prepareSourceText((string) $validated['text']),
        ];

        if (strlen($section['text']) < 20) {
            return $this->aiError('The selected section does not contain enough text to summarize.', 422);
        }

        $apiKey = trim((string) env('GEMINI_API_KEY', ''));
        if ($apiKey === '') {
            return $this->aiError('GEMINI_API_KEY is missing.', 503);
        }

        try {
            $payload = [
                'contents' => [[
                    'role' => 'user',
                    'parts' => [[
                        'text' => $this->buildPrompt(
                            $section,
                            $validated['commonName'] ?? null,
                            $validated['scientificName'] ?? null,
                            $validated['conservationStatus'] ?? null,
                        ),
                    ]],
                ]],
                'generationConfig' => [
                    'temperature' => 0.15,
                    'maxOutputTokens' => (int) env('GEMINI_MAX_OUTPUT_TOKENS', 1024),
                    'responseMimeType' => 'application/json',
                    'responseSchema' => [
                        'type' => 'ARRAY',
                        'items' => [
                            'type' => 'STRING',
                        ],
                    ],
                    'thinkingConfig' => [
                        'thinkingBudget' => 0,
                    ],
                ],
            ];

            $failureReason = null;
            $response = $this->postGemini($apiKey, $payload, $failureReason);
            if (!$response) {
                return $this->aiError($failureReason ?: 'Gemini request failed.', 502);
            }

            $content = (string) $response->json('candidates.0.content.parts.0.text', '');
            $finishReason = $response->json('candidates.0.finishReason');
            $bullets = $this->decodeBulletSummary($content);
            if (empty($bullets)) {
                Log::warning('Ecological AI brief parse failed', [
                    'model' => env('GEMINI_MODEL', 'gemini-3.5-flash'),
                    'finish_reason' => $finishReason,
                    'content_excerpt' => mb_substr($this->sanitizeLogMessage($content), 0, 600),
                ]);
                return $this->aiError('Gemini responded, but the bullet summary could not be parsed.', 502, [
                    'model' => env('GEMINI_MODEL', 'gemini-3.5-flash'),
                    'finish_reason' => $finishReason,
                    'raw_response' => $content,
                ]);
            }

            return response()->json([
                'source' => 'ai',
                'bullets' => $bullets,
            ]);
        } catch (\Throwable $e) {
            Log::error('Ecological AI brief exception: ' . $this->sanitizeLogMessage($e->getMessage()));
            return $this->aiError('Unexpected AI summary error.', 500);
        }
    }

    private function postGemini(string $apiKey, array $payload, ?string &$failureReason = null): ?\Illuminate\Http\Client\Response
    {
        $configuredModel = trim((string) env('GEMINI_MODEL', 'gemini-3.5-flash'));
        $fallbackModels = collect(explode(',', (string) env('GEMINI_FALLBACK_MODELS', '')))
            ->map(fn ($model) => trim($model))
            ->filter()
            ->all();
        $models = array_values(array_unique(array_filter([
            $configuredModel,
            ...$fallbackModels,
        ])));

        foreach ($models as $model) {
            try {
                $response = Http::connectTimeout(5)
                    ->timeout((int) env('GEMINI_TIMEOUT', 45))
                    ->post(
                        "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$apiKey}",
                        $payload,
                    );

                if ($response->successful() && !$response->json('error')) {
                    return $response;
                }

                $failureReason = "Gemini model {$model} failed with HTTP {$response->status()}.";
                Log::warning('Ecological AI brief API call failed', [
                    'model' => $model,
                    'status' => $response->status(),
                    'body' => $this->sanitizeLogMessage($response->body()),
                ]);
            } catch (\Throwable $e) {
                $failureReason = "Gemini model {$model} request failed: " . $this->sanitizeLogMessage($e->getMessage());
                Log::warning('Ecological AI brief request exception', [
                    'model' => $model,
                    'error' => $this->sanitizeLogMessage($e->getMessage()),
                ]);
            }
        }

        return null;
    }

    private function buildPrompt(array $section, ?string $commonName, ?string $scientificName, ?string $conservationStatus): string
    {
        $label = $section['label'];
        $text = $section['text'];
        $common = trim((string) $commonName) ?: 'Unknown common name';
        $scientific = trim((string) $scientificName) ?: 'Unknown scientific name';
        $status = trim((string) $conservationStatus) ?: 'Unknown conservation status';

        return <<<PROMPT
You are a conservation biology analyst for EcoTracker.

Task: Convert one raw GBIF ecological description section into a concise bullet-point summary for monitoring endangered species.

Rules:
- Use only the supplied text and species context.
- Do not invent threats, locations, traits, dates, or conservation claims.
- Ignore duplicate lines, citations, source names, taxonomic debris, and empty headings.
- Synthesize in your own words instead of copying the source.
- If the text is mostly taxonomy, synonymy, or specimen metadata, explain its monitoring value honestly.
- Keep the result compact and useful for researchers.

Return only a JSON array of strings.
The first character of your response must be [ and the last character must be ].
Do not write an introduction such as "Here is the JSON requested".

Species: {$common} ({$scientific}); status: {$status}; section: {$label}
Text:
{$text}
PROMPT;
    }

    private function prepareSourceText(string $text): string
    {
        $text = html_entity_decode(strip_tags($text));
        $text = str_replace(["\r\n", "\r"], "\n", $text);
        $lines = preg_split('/\n+/', $text, -1, PREG_SPLIT_NO_EMPTY) ?: [];
        $seen = [];
        $clean = [];

        foreach ($lines as $line) {
            $line = trim(preg_replace('/\s+/', ' ', $line));
            if ($line === '') {
                continue;
            }

            $key = strtolower($line);
            if (isset($seen[$key])) {
                continue;
            }

            $seen[$key] = true;
            $clean[] = $line;
        }

        return mb_substr(implode("\n", $clean), 0, 6500);
    }

    private function decodeBulletSummary(string $content): array
    {
        $content = $this->normalizeJsonCandidate($content);
        $decoded = json_decode((string) $content, true);

        if (is_string($decoded)) {
            return $this->decodeBulletSummary($decoded);
        }

        if (is_array($decoded)) {
            if (array_is_list($decoded)) {
                return $this->cleanBullets($decoded);
            }

            foreach (['bullets', 'summary', 'key_points', 'points'] as $key) {
                if (isset($decoded[$key]) && is_array($decoded[$key])) {
                    return $this->cleanBullets($decoded[$key]);
                }
            }
        }

        if (preg_match('/\[[\s\S]*\]/', (string) $content, $matches)) {
            $decoded = json_decode($this->repairJson($matches[0]), true);
            if (is_array($decoded)) {
                return $this->cleanBullets($decoded);
            }
        }

        return $this->parseBulletLines($content);
    }

    private function normalizeJsonCandidate(string $content): string
    {
        $content = trim($content);
        $content = preg_replace('/^```(?:json)?\s*/i', '', $content);
        $content = preg_replace('/\s*```$/', '', (string) $content);
        $content = html_entity_decode((string) $content);
        $content = trim((string) $content);

        if (
            strlen($content) >= 2 &&
            (($content[0] === '"' && substr($content, -1) === '"') || ($content[0] === "'" && substr($content, -1) === "'"))
        ) {
            $decoded = json_decode($content, true);
            if (is_string($decoded)) {
                return $this->normalizeJsonCandidate($decoded);
            }

            $content = trim(stripcslashes(substr($content, 1, -1)));
        }

        if (str_contains($content, '\\"') || str_contains($content, '\\n')) {
            $unescaped = stripcslashes($content);
            if (str_contains($unescaped, '[') && str_contains($unescaped, ']')) {
                return trim($unescaped);
            }
        }

        return $content;
    }

    private function repairJson(string $json): string
    {
        $json = trim($json);
        $json = preg_replace('/,\s*([}\]])/', '$1', $json) ?? $json;
        $json = str_replace(["\r\n", "\r"], "\n", $json);

        return $json;
    }

    private function cleanBullets(array $bullets): array
    {
        return collect($bullets)
            ->map(fn ($bullet) => $this->cleanBulletValue($bullet))
            ->filter(fn ($bullet) => $bullet !== '' && !str_starts_with(trim($bullet), '{'))
            ->take(5)
            ->values()
            ->all();
    }

    private function cleanBulletValue(mixed $bullet): string
    {
        if (is_array($bullet)) {
            foreach (['bullet', 'text', 'summary', 'content', 'point'] as $key) {
                if (isset($bullet[$key])) {
                    return $this->cleanScalar($bullet[$key]);
                }
            }

            return $this->cleanScalar(implode(' ', array_map(
                fn ($value) => is_scalar($value) ? (string) $value : '',
                $bullet,
            )));
        }

        return $this->cleanScalar($bullet);
    }

    private function parseBulletLines(string $content): array
    {
        $lines = preg_split('/\r?\n+/', trim($content), -1, PREG_SPLIT_NO_EMPTY) ?: [];
        $bullets = [];

        foreach ($lines as $line) {
            $line = trim($line);
            if (preg_match('/^(?:[-*•]|\d+[.)])\s*(.+)$/u', $line, $matches)) {
                $bullets[] = $matches[1];
            }
        }

        if (empty($bullets)) {
            return [];
        }

        return $this->cleanBullets($bullets);
    }

    private function aiError(string $message, int $status, array $extra = []): JsonResponse
    {
        return response()->json([
            'message' => $message,
            'source' => 'error',
            ...$extra,
        ], $status);
    }

    private function cleanScalar(mixed $value): string
    {
        $value = trim(preg_replace('/\s+/', ' ', strip_tags((string) $value)) ?? '');
        $value = preg_replace('/^[-*#\s]+/', '', (string) $value);

        return trim((string) $value);
    }

    private function sanitizeLogMessage(string $message): string
    {
        return preg_replace('/([?&]key=)[^&\s)]+/i', '$1[redacted]', $message) ?? $message;
    }
}

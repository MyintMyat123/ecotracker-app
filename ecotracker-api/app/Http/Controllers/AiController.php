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
            'commonName' => 'sometimes|string|max:160',
            'scientificName' => 'sometimes|string|max:220',
            'sections' => 'required_without:text|array|min:1|max:12',
            'sections.*.label' => 'required_with:sections|string|max:120',
            'sections.*.text' => 'required_with:sections|string|min:20|max:8000',
        ]);

        $sections = $this->normalizeSections($validated);
        $context = $validated['context'] ?? $validated['type'] ?? 'general';

        try {
            $apiKey = env('GEMINI_API_KEY');

            if (!$apiKey) {
                return $this->fallbackSummary($sections);
            }

            $payload = [
                'contents' => [[
                    'role' => 'user',
                    'parts' => [[
                        'text' => $this->buildGeminiPrompt(
                            $sections[0],
                            $context,
                            $validated['commonName'] ?? null,
                            $validated['scientificName'] ?? null,
                        ),
                    ]],
                ]],
                'generationConfig' => [
                    'temperature' => 0.45,
                    'maxOutputTokens' => 900,
                ],
            ];

            $response = $this->postGeminiOverview($apiKey, $payload);
            if (!$response) {
                return $this->fallbackSummary($sections);
            }

            $content = $response->json('candidates.0.content.parts.0.text', '');
            $markdown = $this->cleanMarkdown($content);
            if ($markdown === '') {
                return $this->fallbackSummary($sections);
            }

            $summary = [
                'label' => $sections[0]['label'],
                'markdown' => $markdown,
                'bullets' => [],
            ];

            return response()->json([
                'markdown' => $markdown,
                'bullets' => [],
                'summaries' => [$summary],
                'source' => 'ai',
            ]);
        } catch (\Throwable $e) {
            Log::error('Gemini overview exception: ' . $e->getMessage());
            return $this->fallbackSummary($sections);
        }
    }

    private function postGeminiOverview(string $apiKey, array $payload): ?\Illuminate\Http\Client\Response
    {
        $configuredModel = trim((string) env('GEMINI_MODEL', ''));
        $models = array_values(array_unique(array_filter([
            $configuredModel,
            'gemini-2.0-flash',
            'gemini-1.5-flash-latest',
            'gemini-1.5-pro-latest',
        ])));

        foreach ($models as $model) {
            try {
                $response = Http::connectTimeout(5)
                    ->timeout(15)
                    ->post(
                        "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$apiKey}",
                        $payload,
                    );

                if ($response->successful() && !$response->json('error')) {
                    return $response;
                }

                Log::warning('Gemini overview API call failed', [
                    'model' => $model,
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);
            } catch (\Throwable $e) {
                Log::warning('Gemini overview request exception', [
                    'model' => $model,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return null;
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

    private function buildGeminiPrompt(array $section, string $context, ?string $commonName, ?string $scientificName): string
    {
        $nameLine = trim((string) $commonName) !== '' || trim((string) $scientificName) !== ''
            ? "Known species context: Common name = " . (trim((string) $commonName) ?: 'Unknown') . "; Scientific name = " . (trim((string) $scientificName) ?: 'Unknown') . ".\n"
            : '';
        $label = $section['label'] ?? $context;
        $text = $this->prepareSourceText((string) ($section['text'] ?? ''));

        return <<<PROMPT
You are an advanced biological data parsing agent. Your sole task is to process disorganized, raw species data dumps and synthesize them into a clean, professional Markdown summary for one ecological information section.

CRITICAL BEHAVIORAL LAWS:
1. NO CONVERSATIONAL FILLER: Never start with intro sentences or conversational fluff. Output the summary immediately.
2. FILTER DEBRIS: Ignore duplicate lines, citations, and empty headers.
3. LOWER CASE CONSISTENCY: Avoid shouting in ALL CAPS even if the source data does. Use proper title casing for animal classifications.

OUTPUT STYLE:
- Return Markdown only.
- Do not wrap the answer in JSON.
- Do not use code fences.
- Start with a short Markdown heading for the section, not a fixed species blueprint.
- Write a concise synthesis in your own words. Keep it under 140 words.
- Use 2 to 4 bullets only when they make the section easier to scan.
- Adapt the structure to the actual section content. Do not force categories that are missing from the text.
- Highlight conservation relevance, uncertainty, location/range information, habitat, behavior, or data gaps only when they are actually supported by the supplied text.
- Keep the result professional and compact.
- Do not echo the raw source text.
- Do not include phrases like "For this section", "Raw species data", "this is the ai summary", "Discussion:", "Comments:", or "Synonymic list".
- Do not copy long sentences verbatim from the source.

Use the species context only when it helps clarify the subject.
Do not invent facts beyond the supplied text and species context.

{$nameLine}Section label: {$label}

Raw species data:
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

        return mb_substr(implode("\n", $clean), 0, 6000);
    }

    private function cleanMarkdown(string $content): string
    {
        $content = trim($content);

        for ($i = 0; $i < 3; $i++) {
            $content = trim($content);
            $content = preg_replace('/^```(?:json|markdown|md)?\s*/', '', $content);
            $content = preg_replace('/\s*```$/', '', $content);

            $decoded = json_decode($content, true);
            if (is_array($decoded) && isset($decoded['markdown'])) {
                $content = (string) $decoded['markdown'];
                continue;
            }

            if (is_string($decoded)) {
                $content = $decoded;
                continue;
            }

            if (preg_match('/"markdown"\s*:\s*"((?:[^"\\\\]|\\\\.)*)"/s', $content, $matches)) {
                $unescaped = json_decode('"' . $matches[1] . '"');
                if (is_string($unescaped)) {
                    $content = $unescaped;
                    continue;
                }
            }

            if (preg_match('/^\s*\{\s*"markdown"\s*:\s*(.*)\s*\}?\s*$/is', $content, $matches)) {
                $content = trim($matches[1]);
                $content = preg_replace('/^"/', '', $content);
                $content = preg_replace('/",?\s*\}?$/', '', $content);
                $content = stripcslashes((string) $content);
                continue;
            }

            break;
        }

        $content = preg_replace('/^\s*\{\s*"markdown"\s*:\s*"?/i', '', $content);
        $content = preg_replace('/"?,?\s*\}\s*$/', '', $content);
        $content = preg_replace('/^\s*(?:this is the ai summary\s*:|for this section\s*:)\s*/i', '', $content);
        $content = preg_replace('/\n\s*For this section\s*:.*$/is', '', $content);
        $content = preg_replace('/\n\s*Raw species data\s*:.*$/is', '', $content);
        $content = preg_replace('/^\s*(?:discussion|comments|synonymic list)\s*:?.*$/im', '', $content);
        $content = preg_replace("/\n{3,}/", "\n\n", $content);

        return trim((string) $content);
    }

    private function fallbackSummary(array $sections): JsonResponse
    {
        $summaries = $this->fallbackSummaries($sections);

        return response()->json([
            'bullets' => $summaries[0]['bullets'] ?? [],
            'markdown' => $summaries[0]['markdown'] ?? '',
            'summaries' => $summaries,
            'source' => 'fallback',
        ]);
    }

    private function fallbackSummaries(array $sections): array
    {
        return collect($sections)
            ->map(fn ($section) => [
                'label' => $section['label'],
                'markdown' => $this->fallbackMarkdown($section),
                'bullets' => $this->sentenceBullets($section['text']),
            ])
            ->values()
            ->all();
    }

    private function fallbackMarkdown(array $section): string
    {
        $bullets = $this->sentenceBullets((string) ($section['text'] ?? ''));
        $summary = $bullets[0] ?? 'No reliable summary could be generated from the available text.';
        $extraBullets = array_slice($bullets, 1, 3);

        $markdown = "### {$section['label']}\n{$summary}";

        foreach ($extraBullets as $bullet) {
            $markdown .= "\n* {$bullet}";
        }

        return $markdown;
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

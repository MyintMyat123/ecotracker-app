import React, { useMemo, useState } from 'react';
import { API_BASE_URL, TOKEN_STORAGE_KEY } from '../api';

interface AiSectionInput {
  label: string;
  text: string;
}

interface AiOverviewProps {
  text?: string;
  context?: string;
  label?: string;
  autoGenerate?: boolean;
  sections?: AiSectionInput[];
  commonName?: string;
  scientificName?: string;
}

interface AiSummary {
  label: string;
  markdown?: string;
  bullets: string[];
}

interface AiResult {
  bullets: string[];
  markdown?: string;
  summaries?: AiSummary[];
  source: 'ai' | 'fallback';
}

type AiSectionResult = AiSummary & { source: AiResult['source'] };

const normalizeLabel = (value: string) =>
  value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const AiOverview: React.FC<AiOverviewProps> = ({
  text,
  context = 'general',
  label = 'AI Summary',
  autoGenerate: _autoGenerate = false,
  sections,
  commonName,
  scientificName,
}) => {
  const normalizedSections = useMemo(() => {
    if (sections && sections.length > 0) {
      return sections.filter((section) => section.text.trim().length >= 20);
    }

    if (text && text.trim().length >= 20) {
      return [{ label: context, text }];
    }

    return [];
  }, [context, sections, text]);

  const [summariesByLabel, setSummariesByLabel] = useState<Record<string, AiSectionResult>>({});
  const [loadingLabel, setLoadingLabel] = useState<string | null>(null);
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const [errorLabel, setErrorLabel] = useState<string | null>(null);

  const activeSection = normalizedSections.find((section) => section.label === activeLabel) || normalizedSections[0];
  const activeSummary = activeSection ? summariesByLabel[activeSection.label] : null;
  const loading = activeSection ? loadingLabel === activeSection.label : false;
  const error = activeSection ? errorLabel === activeSection.label : false;

  const generate = async (section: AiSectionInput) => {
    if (!section) return;

    setLoadingLabel(section.label);
    setErrorLabel(null);
    try {
      const token = localStorage.getItem(TOKEN_STORAGE_KEY);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch(`${API_BASE_URL}/ai/overview`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          text: section.text,
          context: section.label || context,
          commonName,
          scientificName,
        }),
      });

      if (!response.ok) {
        setErrorLabel(section.label);
        return;
      }

      const data: AiResult = await response.json();
      const summary = data.summaries?.[0];
      const sectionResult: AiSectionResult = {
        label: section.label,
        markdown: summary?.markdown || data.markdown,
        bullets: summary?.bullets || data.bullets || [],
        source: data.source,
      };

      if (!sectionResult.markdown && sectionResult.bullets.length === 0) {
        setErrorLabel(section.label);
        return;
      }

      setSummariesByLabel((current) => ({
        ...current,
        [section.label]: sectionResult,
      }));
    } catch {
      setErrorLabel(section.label);
    } finally {
      setLoadingLabel(null);
    }
  };

  if (normalizedSections.length === 0) return null;

  const renderInlineMarkdown = (value: string) => {
    const parts = value.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index} className="font-bold text-slate-100">{part.slice(2, -2)}</strong>;
      }

      return <React.Fragment key={index}>{part}</React.Fragment>;
    });
  };

  const unwrapMarkdown = (value: string) => {
    let current = value.trim();

    for (let index = 0; index < 3; index += 1) {
      current = current
        .replace(/^```(?:json|markdown|md)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      try {
        const decoded = JSON.parse(current);
        if (typeof decoded === 'string') {
          current = decoded;
          continue;
        }
        if (decoded && typeof decoded.markdown === 'string') {
          current = decoded.markdown;
          continue;
        }
      } catch {
        // Not JSON, render as markdown.
      }

      const markdownMatch = current.match(/^\s*\{\s*"markdown"\s*:\s*"?([\s\S]*?)"?,?\s*\}?\s*$/i);
      if (markdownMatch?.[1]) {
        current = markdownMatch[1]
          .replace(/\\"/g, '"')
          .replace(/\\n/g, '\n')
          .replace(/\\\\/g, '\\')
          .trim();
        continue;
      }

      break;
    }

    return current
      .replace(/^\s*\{\s*"markdown"\s*:\s*"?/i, '')
      .replace(/"?,?\s*\}\s*$/i, '')
      .replace(/\\n/g, '\n')
      .trim();
  };

  const renderMarkdown = (markdown: string) => {
    return unwrapMarkdown(markdown)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, index) => {
        if (line.startsWith('### ')) {
          return (
            <h4 key={index} className="text-base font-bold text-white">
              {renderInlineMarkdown(line.replace(/^###\s+/, ''))}
            </h4>
          );
        }

        if (line.startsWith('* ')) {
          return (
            <div key={index} className="flex items-start gap-3">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300" />
              <p className="text-sm leading-6 text-slate-200">{renderInlineMarkdown(line.replace(/^\*\s+/, ''))}</p>
            </div>
          );
        }

        return (
          <p key={index} className="text-sm leading-6 text-slate-200">
            {renderInlineMarkdown(line)}
          </p>
        );
      });
  };

  return (
    <div className="rounded-2xl border border-violet-400/20 bg-gradient-to-br from-violet-500/8 via-slate-950/50 to-cyan-500/8 overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-white/8 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.24em] text-violet-300 font-black">Gemini summary</p>
          <h3 className="mt-1 text-base font-bold text-white">{label}</h3>
          <p className="mt-1 text-xs text-slate-500">
            Generate one section at a time
          </p>
        </div>
      </div>

      {error && (
        <div className="border-b border-red-400/15 bg-red-500/10 px-4 py-3 text-xs font-semibold text-red-200">
          Summary failed. Check your Gemini API key or try again.
        </div>
      )}

      <div className="p-4">
        <div className="mb-4 flex flex-wrap gap-2">
          {normalizedSections.map((section) => {
            const isActive = activeSection?.label === section.label;
            const hasSummary = Boolean(summariesByLabel[section.label]);

            return (
              <button
                key={section.label}
                type="button"
                onClick={() => setActiveLabel(section.label)}
                className={`rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] transition-colors ${
                  isActive
                    ? 'border-cyan-400/30 bg-cyan-400/12 text-cyan-100'
                    : hasSummary
                      ? 'border-emerald-400/20 bg-emerald-400/8 text-emerald-200 hover:text-emerald-100'
                      : 'border-white/8 bg-white/[0.03] text-slate-400 hover:text-slate-200'
                }`}
              >
                {normalizeLabel(section.label)}
              </button>
            );
          })}
        </div>

        {activeSection && (
          <div className="rounded-xl border border-white/8 bg-slate-950/45 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h4 className="text-sm font-bold text-white">{normalizeLabel(activeSection.label)}</h4>
              {activeSummary && (
                <span className="rounded-full border border-white/8 bg-white/[0.04] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">
                  {activeSummary.source === 'ai' ? 'Gemini' : 'Fallback'}
                </span>
              )}
            </div>
            {activeSummary?.markdown ? (
              <div className="space-y-3">
                {renderMarkdown(activeSummary.markdown)}
              </div>
            ) : (
              activeSummary ? (
                <div className="space-y-2.5">
                {activeSummary.bullets.map((bullet, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-violet-400/20 bg-violet-400/10 text-[8px] font-black text-violet-200">
                      {index + 1}
                    </span>
                    <p className="text-sm leading-6 text-slate-200">{bullet}</p>
                  </div>
                ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-5">
                  <p className="text-sm leading-6 text-slate-400">
                    Generate a focused Markdown summary for this section only.
                  </p>
                  <button
                    type="button"
                    onClick={() => generate(activeSection)}
                    disabled={loading}
                    className="mt-4 inline-flex items-center justify-center gap-2 rounded-full border border-violet-400/25 bg-violet-400/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-violet-200 hover:bg-violet-400/15 disabled:text-slate-500 transition-colors"
                  >
                    {loading ? (
                      <>
                        <span className="h-3 w-3 rounded-full border border-violet-300 border-t-transparent animate-spin" />
                        Summarizing
                      </>
                    ) : (
                      'Generate this section'
                    )}
                  </button>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AiOverview;

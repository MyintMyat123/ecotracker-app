import React, { useMemo, useState } from 'react';
import { API_BASE_URL, TOKEN_STORAGE_KEY } from '../api';

interface EcologicalSectionInput {
  label: string;
  text: string;
}

interface EcologicalInsightPanelProps {
  sections: EcologicalSectionInput[];
  commonName: string;
  scientificName: string;
  conservationStatus: string;
}

interface AiBulletResponse {
  source: 'ai' | 'error';
  message?: string;
  bullets?: string[];
  model?: string;
  finish_reason?: string | null;
  raw_response?: string;
}

interface BulletState {
  bullets: string[];
}

const normalizeLabel = (value: string) =>
  value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const looksLikeRawJson = (value: string) => {
  const trimmed = value.trim();
  return trimmed.startsWith('{') || trimmed.includes('"summary":') || trimmed.includes('\\"summary\\"');
};

const cleanBullets = (bullets?: string[]) =>
  (bullets || [])
    .map((bullet) => String(bullet || '').trim())
    .filter((bullet) => bullet.length > 0 && !looksLikeRawJson(bullet))
    .slice(0, 5);

const EcologicalInsightPanel: React.FC<EcologicalInsightPanelProps> = ({
  sections,
  commonName,
  scientificName,
  conservationStatus,
}) => {
  const validSections = useMemo(
    () => sections.filter((section) => section.text.trim().length >= 20),
    [sections],
  );
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<Record<string, BulletState>>({});
  const [loadingLabel, setLoadingLabel] = useState<string | null>(null);
  const [errorLabel, setErrorLabel] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [rawAiResponse, setRawAiResponse] = useState<string | null>(null);

  const activeSection = validSections.find((section) => section.label === activeLabel) || validSections[0];
  const activeSummary = activeSection ? summaries[activeSection.label] : null;
  const loading = Boolean(activeSection && loadingLabel === activeSection.label);
  const failed = Boolean(activeSection && errorLabel === activeSection.label);

  const generateSummary = async (section: EcologicalSectionInput) => {
    setLoadingLabel(section.label);
    setErrorLabel(null);
    setErrorMessage(null);
    setRawAiResponse(null);

    try {
      const token = localStorage.getItem(TOKEN_STORAGE_KEY);
      const headers: Record<string, string> = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      };
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch(`${API_BASE_URL}/ai/overview`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          text: section.text,
          context: section.label,
          type: 'ecological_profile',
          commonName,
          scientificName,
          conservationStatus,
        }),
      });

      const data: AiBulletResponse = await response.json();
      if (!response.ok) {
        setErrorLabel(section.label);
        setErrorMessage(
          [
            data.message || 'The AI summary could not be generated.',
            data.model ? `Model: ${data.model}` : '',
            data.finish_reason ? `Finish: ${data.finish_reason}` : '',
          ].filter(Boolean).join(' ')
        );
        setRawAiResponse(data.raw_response || null);
        return;
      }

      const bullets = cleanBullets(data.bullets);
      if (data.source !== 'ai' || bullets.length === 0) {
        setErrorLabel(section.label);
        setErrorMessage('The AI response did not contain usable bullet points.');
        setRawAiResponse(data.raw_response || null);
        return;
      }

      setSummaries((current) => ({
        ...current,
        [section.label]: { bullets },
      }));
    } catch {
      setErrorLabel(section.label);
      setErrorMessage('The AI request failed before EcoTracker received a valid response.');
    } finally {
      setLoadingLabel(null);
    }
  };

  if (validSections.length === 0) return null;

  return (
    <div className="rounded-2xl border border-cyan-400/20 bg-slate-950/55 backdrop-blur-xl overflow-hidden">
      <div className="border-b border-white/8 p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.24em] text-cyan-300 font-black">AI bullet summary</p>
            <h3 className="mt-1 text-lg font-bold text-white">Ecological profile summary</h3>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-400">
              Generate concise bullet points for one GBIF section at a time. Original source notes stay below for verification.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-slate-500">
            <span className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5">{validSections.length} sections</span>
            <span className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5">{Object.keys(summaries).length} generated</span>
          </div>
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[280px_1fr]">
        <div className="border-b border-white/8 p-4 lg:border-b-0 lg:border-r">
          <div className="space-y-2">
            {validSections.map((section) => {
              const active = activeSection?.label === section.label;
              const generated = Boolean(summaries[section.label]);
              return (
                <button
                  key={section.label}
                  type="button"
                  onClick={() => setActiveLabel(section.label)}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                    active
                      ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-100'
                      : 'border-white/8 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]'
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-bold">{normalizeLabel(section.label)}</span>
                    <span className="mt-0.5 block text-[10px] text-slate-500">{section.text.length.toLocaleString()} chars</span>
                  </span>
                  {generated && <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-300" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-5">
          {activeSection && (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-semibold">Selected section</p>
                  <h4 className="mt-1 text-xl font-black text-white">{normalizeLabel(activeSection.label)}</h4>
                </div>
                <button
                  type="button"
                  onClick={() => generateSummary(activeSection)}
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200 hover:bg-emerald-400/15 disabled:cursor-wait disabled:text-slate-500 transition-colors"
                >
                  {loading ? (
                    <>
                      <span className="h-3 w-3 rounded-full border border-emerald-300 border-t-transparent animate-spin" />
                      Generating
                    </>
                  ) : activeSummary ? (
                    'Regenerate summary'
                  ) : (
                    'Generate summary'
                  )}
                </button>
              </div>

              {failed && (
                <div className="space-y-3">
                  <div className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200">
                    {errorMessage || 'The AI summary could not be generated.'}
                  </div>
                  {rawAiResponse && (
                    <details className="rounded-xl border border-white/10 bg-slate-950/70 p-4">
                      <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
                        View raw AI response
                      </summary>
                      <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/30 p-3 text-xs leading-5 text-slate-300">
                        {rawAiResponse}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              {activeSummary ? (
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h5 className="text-base font-bold text-white">Summary bullets</h5>
                    <span className="shrink-0 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-emerald-200">
                      AI
                    </span>
                  </div>
                  <div className="space-y-3">
                    {activeSummary.bullets.map((bullet, index) => (
                      <div key={`${bullet}-${index}`} className="flex items-start gap-3 rounded-xl border border-white/8 bg-slate-950/45 px-4 py-3">
                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-cyan-400/20 bg-cyan-400/10 text-[10px] font-black text-cyan-200">
                          {index + 1}
                        </span>
                        <p className="text-sm leading-6 text-slate-200">{bullet}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-6">
                  <p className="max-w-2xl text-sm leading-7 text-slate-400">
                    No AI summary has been generated for this section yet.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EcologicalInsightPanel;

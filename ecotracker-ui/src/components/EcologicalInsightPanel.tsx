import React, { useState } from 'react';
import { API_BASE_URL, TOKEN_STORAGE_KEY } from '../api';

interface EcologicalInsightPanelProps {
  label: string;
  text: string;
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
  label,
  text,
  commonName,
  scientificName,
  conservationStatus,
}) => {
  const [bullets, setBullets] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [rawAiResponse, setRawAiResponse] = useState<string | null>(null);

  const generateSummary = async () => {
    setLoading(true);
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
          text,
          context: label,
          type: 'ecological_profile',
          commonName,
          scientificName,
          conservationStatus,
        }),
      });

      const data: AiBulletResponse = await response.json();
      if (!response.ok) {
        setErrorMessage(
          [
            data.message || 'The AI summary could not be generated.',
            data.model ? `Model: ${data.model}` : '',
            data.finish_reason ? `Finish: ${data.finish_reason}` : '',
          ]
            .filter(Boolean)
            .join(' '),
        );
        setRawAiResponse(data.raw_response || null);
        return;
      }

      const nextBullets = cleanBullets(data.bullets);
      if (data.source !== 'ai' || nextBullets.length === 0) {
        setErrorMessage('Gemini responded, but EcoTracker could not find usable summary bullets.');
        setRawAiResponse(data.raw_response || null);
        return;
      }

      setBullets(nextBullets);
    } catch {
      setErrorMessage('The AI request failed before EcoTracker received a valid response.');
    } finally {
      setLoading(false);
    }
  };

  if (text.trim().length < 20) return null;

  const showSummaryBox = bullets.length > 0 || Boolean(errorMessage);

  if (!showSummaryBox) {
    return (
      <button
        type="button"
        onClick={generateSummary}
        disabled={loading}
        className="inline-flex w-fit items-center justify-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200 transition-colors hover:bg-emerald-400/15 disabled:cursor-wait disabled:text-slate-500"
      >
        {loading ? (
          <>
            <span className="h-3 w-3 rounded-full border border-emerald-300 border-t-transparent animate-spin" />
            Generating
          </>
        ) : (
          'Generate AI summary'
        )}
      </button>
    );
  }

  return (
    <div className="w-full rounded-2xl border border-cyan-400/15 bg-slate-950/45 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">AI summary</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">Generate a concise monitoring summary for this section only.</p>
        </div>
        <button
          type="button"
          onClick={generateSummary}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200 transition-colors hover:bg-emerald-400/15 disabled:cursor-wait disabled:text-slate-500"
        >
          {loading ? (
            <>
              <span className="h-3 w-3 rounded-full border border-emerald-300 border-t-transparent animate-spin" />
              Generating
            </>
          ) : bullets.length > 0 ? (
            'Regenerate'
          ) : (
            'Generate summary'
          )}
        </button>
      </div>

      {errorMessage && (
        <div className="mt-4 space-y-3">
          <div className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200">
            {errorMessage}
          </div>
          {rawAiResponse && (
            <details className="rounded-xl border border-white/10 bg-black/20 p-3">
              <summary className="cursor-pointer text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">
                View raw AI response
              </summary>
              <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/30 p-3 text-xs leading-5 text-slate-300">
                {rawAiResponse}
              </pre>
            </details>
          )}
        </div>
      )}

      {bullets.length > 0 && (
        <div className="mt-4 space-y-2">
          {bullets.map((bullet, index) => (
            <div key={`${bullet}-${index}`} className="flex gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-cyan-400/20 bg-cyan-400/10 text-[10px] font-black text-cyan-200">
                {index + 1}
              </span>
              <p className="text-sm leading-6 text-slate-200">{bullet}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EcologicalInsightPanel;

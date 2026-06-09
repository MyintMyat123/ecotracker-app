import React, { useState } from 'react';
import { API_BASE_URL, TOKEN_STORAGE_KEY } from '../api';

interface AiOverviewProps {
  text: string;
  context?: string;
  label?: string;
  autoGenerate?: boolean;
}

interface AiResult {
  bullets: string[];
  source: 'ai' | 'fallback';
}

const AiOverview: React.FC<AiOverviewProps> = ({
  text,
  context = 'general',
  label = 'AI Overview',
  autoGenerate = false,
}) => {
  const [result, setResult] = useState<AiResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState(false);

  const generate = async () => {
    if (result) {
      setExpanded(!expanded);
      return;
    }
    if (!text || text.trim().length < 20) return;
    setLoading(true);
    setError(false);
    try {
      const token = localStorage.getItem(TOKEN_STORAGE_KEY);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(`${API_BASE_URL}/ai/overview`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ text, context }),
      });

      if (response.ok) {
        const data: AiResult = await response.json();
        if (data.bullets && data.bullets.length > 0) {
          setResult(data);
          setExpanded(true);
        } else {
          setError(true);
        }
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  // Auto-generate on mount if requested
  React.useEffect(() => {
    if (autoGenerate && !result && !loading) {
      generate();
    }
  }, [autoGenerate]);

  if (!text || text.trim().length < 20) return null;

  return (
    <div className="mt-3 space-y-2">
      {!result && !loading && (
        <button
          type="button"
          onClick={generate}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-gradient-to-r from-violet-500/10 to-cyan-500/10 border border-violet-500/20 hover:border-violet-400/40 text-violet-300 hover:text-violet-200 text-[10px] font-bold uppercase tracking-[0.2em] transition-all duration-200 hover:shadow-[0_0_12px_-4px_rgba(139,92,246,0.4)] group"
        >
          <svg className="w-3 h-3 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          {label}
        </button>
      )}

      {loading && (
        <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-[10px] font-bold uppercase tracking-[0.2em]">
          <span className="w-3 h-3 border border-violet-400 border-t-transparent rounded-full animate-spin" />
          Generating summary...
        </div>
      )}

      {error && (
        <button
          type="button"
          onClick={generate}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-red-500/10 border border-red-500/20 text-red-300 text-[10px] font-bold uppercase tracking-[0.2em] hover:border-red-400/40 transition-all"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Retry summary
        </button>
      )}

      {result && (
        <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/5 to-cyan-500/5 overflow-hidden">
          {/* Header */}
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/3 transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-violet-500/20 flex items-center justify-center">
                <svg className="w-2.5 h-2.5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="text-[10px] uppercase tracking-[0.22em] text-violet-300 font-bold">
                AI Summary
              </span>
              {result.source === 'fallback' && (
                <span className="px-1.5 py-0.5 rounded text-[8px] bg-slate-700/50 text-slate-400 border border-slate-600/30">
                  Auto
                </span>
              )}
              <span className="text-[9px] text-slate-500">
                {result.bullets.length} key points
              </span>
            </div>
            <svg
              className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Bullets */}
          {expanded && (
            <div className="px-4 pb-4 space-y-2 border-t border-white/5">
              <div className="pt-3 space-y-2.5">
                {result.bullets.map((bullet, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-violet-500/15 border border-violet-500/20 flex items-center justify-center mt-0.5">
                      <span className="text-[8px] font-black text-violet-400">{i + 1}</span>
                    </div>
                    <p className="text-sm text-slate-200 leading-relaxed">{bullet}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AiOverview;

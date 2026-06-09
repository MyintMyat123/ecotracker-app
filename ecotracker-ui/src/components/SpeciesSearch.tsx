import React, { useState } from 'react';
import { API_BASE_URL, type WatchlistItem, type WatchlistPayload } from '../api';

export interface IucnStatus {
  category: string;
  code: string;
}

export interface Species {
  key: number;
  scientificName: string;
  canonicalName: string;
  rank: string;
  taxonomicStatus: string;
  kingdom: string;
  phylum: string;
  order: string;
  family: string;
  genus: string;
  iucnRedListStatus?: IucnStatus | null;
}

interface SpeciesSearchProps {
  isAuthenticated: boolean;
  watchlist: WatchlistItem[];
  savingKey: number | null;
  removingKey: number | null;
  onAddToWatchlist: (payload: WatchlistPayload) => void;
  onRemoveFromWatchlist: (gbifSpeciesKey: number) => void;
  onViewTracker: (species: { usageKey: number; commonName: string }) => void;
  title?: string;
  subtitle?: string;
  variant?: 'hero' | 'compact';
}

const IUCN_BADGE: Record<string, { bg: string; text: string; border: string }> = {
  EX: { bg: 'bg-gray-800/60',   text: 'text-gray-300',   border: 'border-gray-500/30' },
  EW: { bg: 'bg-gray-800/60',   text: 'text-gray-300',   border: 'border-gray-500/30' },
  CR: { bg: 'bg-red-900/40',    text: 'text-red-300',    border: 'border-red-500/30' },
  EN: { bg: 'bg-orange-900/40', text: 'text-orange-300', border: 'border-orange-500/30' },
  VU: { bg: 'bg-amber-900/40',  text: 'text-amber-300',  border: 'border-amber-500/30' },
  NT: { bg: 'bg-yellow-900/40', text: 'text-yellow-300', border: 'border-yellow-500/30' },
  LC: { bg: 'bg-emerald-900/40',text: 'text-emerald-300',border: 'border-emerald-500/30' },
  DD: { bg: 'bg-slate-800/60',  text: 'text-slate-300',  border: 'border-slate-500/30' },
};

const IUCN_LABELS: Record<string, string> = {
  EX: 'Extinct', EW: 'Extinct in Wild', CR: 'Critically Endangered',
  EN: 'Endangered', VU: 'Vulnerable', NT: 'Near Threatened',
  LC: 'Least Concern', DD: 'Data Deficient', NE: 'Not Evaluated',
};

const SpeciesSearch: React.FC<SpeciesSearchProps> = ({
  isAuthenticated,
  watchlist,
  savingKey,
  removingKey,
  onAddToWatchlist,
  onRemoveFromWatchlist,
  onViewTracker,
  title = 'Species Explorer',
  subtitle = 'Discover information about endangered and diverse species from the GBIF database.',
  variant = 'hero',
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Species[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Species[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  React.useEffect(() => {
    if (query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/species/suggest?query=${encodeURIComponent(query)}`);
        if (response.ok) {
          const data = await response.json();
          setSuggestions(data || []);
          setShowSuggestions(true);
        }
      } catch {
        // silent
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const handleSearch = async (e?: React.FormEvent, explicitQuery?: string) => {
    if (e) e.preventDefault();
    const searchQuery = explicitQuery || query;
    if (searchQuery.length < 2) return;
    setQuery(searchQuery);
    setShowSuggestions(false);
    setLoading(true);
    setError(null);
    setHasSearched(true);
    try {
      const response = await fetch(`${API_BASE_URL}/species/search?query=${encodeURIComponent(searchQuery)}`);
      if (!response.ok) throw new Error('Search failed. Please try again.');
      const data = await response.json();
      setResults(data.results || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const getDisplayName = (species: Species) => {
    const s = species as Species & { vernacularNames?: Array<{ language: string; vernacularName: string }> };
    if (s.vernacularNames && s.vernacularNames.length > 0) {
      const eng = s.vernacularNames.find((n) => n.language === 'eng');
      if (eng) return eng.vernacularName;
      return s.vernacularNames[0].vernacularName;
    }
    return species.canonicalName || species.scientificName;
  };

  const isSaved = (speciesKey: number) => watchlist.some((item) => item.gbif_species_key === speciesKey);
  const isCompact = variant === 'compact';

  const toWatchlistPayload = (species: Species): WatchlistPayload => ({
    gbif_species_key: species.key,
    common_name: getDisplayName(species),
    scientific_name: species.scientificName,
    conservation_status: species.iucnRedListStatus?.code ?? null,
    conservation_status_label: species.iucnRedListStatus?.category ?? null,
    family: species.family ?? null,
    kingdom: species.kingdom ?? null,
    image_url: null,
    last_observed_at: null,
  });

  const getIucnBadge = (code: string) => IUCN_BADGE[code] || IUCN_BADGE.DD;

  return (
    <div className={`${isCompact ? 'w-full' : 'mx-auto max-w-5xl px-4 md:px-6 space-y-8'}`}>
      {!isCompact && (
        <div className="text-center space-y-3">
          <h2 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-500">
            {title}
          </h2>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">{subtitle}</p>
        </div>
      )}

      {/* Search form */}
      <form onSubmit={handleSearch} className={`relative group z-20 ${isCompact ? 'w-full' : ''}`}>
        {!isCompact && (
          <div className="absolute -inset-1 bg-gradient-to-r from-emerald-600 to-cyan-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200" />
        )}
        <div className={`relative flex items-center ${
          isCompact
            ? 'rounded-full bg-white/5 border border-white/10 backdrop-blur-xl shadow-lg px-2'
            : 'bg-slate-900/90 rounded-2xl overflow-hidden border border-white/8 focus-within:border-emerald-500/60 transition-all duration-300 backdrop-blur-xl shadow-lg'
        }`}>
          <div className={`flex items-center ${isCompact ? 'px-2' : 'px-4'}`}>
            <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            placeholder="Search species (e.g. Tiger, Panda, Blue Whale)..."
            className={`flex-1 bg-transparent border-none focus:ring-0 text-slate-100 placeholder:text-slate-500 outline-none ${
              isCompact ? 'px-2 py-2.5 text-sm' : 'px-3 py-4 text-base'
            }`}
          />
          <button
            type="submit"
            disabled={loading}
            className={`inline-flex items-center justify-center bg-emerald-500 hover:bg-emerald-400 text-white font-semibold transition-all duration-300 disabled:bg-slate-700 disabled:text-slate-400 ${
              isCompact
                ? 'px-4 py-2 text-xs rounded-full mr-1 border border-emerald-300/20'
                : 'px-8 py-4 rounded-r-2xl border-l border-emerald-300/10 gap-2'
            }`}
          >
            {loading ? (
              <>
                <span className={`border-2 border-white/30 border-t-white rounded-full animate-spin ${isCompact ? 'w-3 h-3' : 'w-4 h-4'}`} />
                {!isCompact && 'Searching...'}
              </>
            ) : (
              <>{!isCompact && 'Search'}</>
            )}
          </button>
        </div>

        {/* Suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className={`absolute top-full mt-2 z-30 left-0 right-0 ${
            isCompact
              ? 'bg-slate-950/95 backdrop-blur-2xl border border-white/8 rounded-2xl overflow-hidden shadow-2xl'
              : 'bg-slate-900/98 border border-white/8 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-xl'
          }`}>
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleSearch(undefined, getDisplayName(suggestion))}
                className="w-full text-left px-4 py-3 hover:bg-white/5 text-slate-300 hover:text-emerald-300 transition-colors border-b border-white/5 last:border-0 flex items-center gap-3"
              >
                <svg className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <div>
                  <div className="font-medium text-sm">{getDisplayName(suggestion)}</div>
                  <div className="text-xs text-slate-500 flex gap-2 mt-0.5">
                    <span className="italic">{suggestion.scientificName}</span>
                    {suggestion.kingdom && <><span>·</span><span>{suggestion.kingdom}</span></>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </form>

      {error && (
        <div className="p-4 bg-red-900/20 border border-red-500/25 rounded-2xl text-red-300 text-sm text-center backdrop-blur-sm">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className={`grid grid-cols-1 gap-4 ${isCompact ? '' : 'md:grid-cols-2 md:gap-5'}`}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-2xl border border-white/8 bg-slate-900/40 p-6 animate-pulse">
              <div className="flex justify-between mb-4">
                <div className="space-y-2">
                  <div className="h-5 bg-white/10 rounded-lg w-36" />
                  <div className="h-3 bg-white/5 rounded w-24" />
                </div>
                <div className="h-6 bg-white/10 rounded-full w-16" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((j) => (
                  <div key={j} className="space-y-1">
                    <div className="h-2.5 bg-white/5 rounded w-12" />
                    <div className="h-4 bg-white/10 rounded w-20" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      {!loading && (
        <div className={`grid grid-cols-1 gap-4 ${isCompact ? '' : 'md:grid-cols-2 md:gap-5'}`}>
          {results.map((species) => {
            const iucnCode = species.iucnRedListStatus?.code;
            const iucnBadge = iucnCode ? getIucnBadge(iucnCode) : null;
            const iucnLabel = iucnCode ? IUCN_LABELS[iucnCode] || iucnCode : null;
            const saved = isSaved(species.key);

            return (
              <div
                key={species.key}
                className={`group relative bg-slate-900/50 backdrop-blur-sm border border-white/8 rounded-2xl hover:border-emerald-500/35 transition-all duration-400 hover:shadow-[0_0_30px_-10px_rgba(16,185,129,0.25)] ${
                  isCompact ? 'p-4' : 'p-5'
                }`}
              >
                {/* Status indicator strip */}
                {iucnCode && ['CR', 'EN', 'VU'].includes(iucnCode) && (
                  <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl bg-gradient-to-r from-red-500/50 via-orange-500/50 to-amber-500/50" />
                )}

                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1 min-w-0 pr-3">
                    <h3 className={`${isCompact ? 'text-sm' : 'text-lg'} font-bold text-slate-100 group-hover:text-emerald-300 transition-colors leading-tight`}>
                      {getDisplayName(species)}
                    </h3>
                    <p className={`${isCompact ? 'text-[10px]' : 'text-xs'} text-slate-500 italic mt-0.5`}>
                      {species.scientificName}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5 items-end flex-shrink-0">
                    <span className="px-2.5 py-1 rounded-full bg-white/5 text-slate-400 text-[9px] font-bold border border-white/8 uppercase tracking-wide">
                      {species.rank}
                    </span>
                    {iucnBadge && iucnLabel && (
                      <span className={`px-2.5 py-1 rounded-full text-[9px] font-black border uppercase tracking-wide ${iucnBadge.bg} ${iucnBadge.text} ${iucnBadge.border}`}>
                        {iucnCode} · {iucnLabel}
                      </span>
                    )}
                  </div>
                </div>

                <div className={`grid grid-cols-2 gap-x-4 gap-y-2.5 ${isCompact ? 'text-[10px]' : 'text-xs'}`}>
                  {[
                    { label: 'Kingdom', value: species.kingdom },
                    { label: 'Family', value: species.family },
                    { label: 'Order', value: species.order },
                    { label: 'Genus', value: species.genus },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <span className="text-slate-500 block">{label}</span>
                      <span className="text-slate-200 font-medium">{value || '—'}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-3.5 border-t border-white/8 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    {saved ? (
                      <button
                        type="button"
                        onClick={() => onRemoveFromWatchlist(species.key)}
                        disabled={removingKey === species.key}
                        className="inline-flex items-center gap-1.5 text-red-300 text-[10px] font-black uppercase tracking-[0.2em] hover:text-red-200 disabled:text-slate-600 transition-colors"
                      >
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                        {removingKey === species.key ? 'Removing...' : 'Saved ✓'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onAddToWatchlist(toWatchlistPayload(species))}
                        disabled={savingKey === species.key}
                        className="inline-flex items-center gap-1.5 text-cyan-300 text-[10px] font-black uppercase tracking-[0.2em] hover:text-cyan-200 disabled:text-slate-600 transition-colors"
                        title={isAuthenticated ? 'Add to watchlist' : 'Sign in to save'}
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                        </svg>
                        {savingKey === species.key ? 'Saving...' : 'Watchlist'}
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onViewTracker({ usageKey: species.key, commonName: getDisplayName(species) })}
                    className="inline-flex items-center gap-1.5 text-emerald-300 text-[10px] font-black uppercase tracking-[0.2em] hover:text-emerald-200 group/btn transition-colors"
                  >
                    View tracker
                    <svg className="w-3 h-3 group-hover/btn:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && hasSearched && results.length === 0 && (
        <div className="text-center py-16 bg-slate-900/20 border border-dashed border-white/10 rounded-3xl backdrop-blur-sm">
          <div className="text-4xl mb-3">🔍</div>
          <p className="text-slate-400 font-medium">No species found for "{query}"</p>
          <p className="text-slate-500 text-sm mt-1">Try a different name or check your spelling</p>
        </div>
      )}
    </div>
  );
};

export default SpeciesSearch;

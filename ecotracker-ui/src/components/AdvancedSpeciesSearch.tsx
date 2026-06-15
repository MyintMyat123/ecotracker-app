import React, { useEffect, useState } from 'react';
import { API_BASE_URL, type WatchlistItem, type WatchlistPayload } from '../api';
import type { Species } from './SpeciesSearch';

interface AdvancedSpeciesSearchProps {
  isAuthenticated: boolean;
  watchlist: WatchlistItem[];
  savingKey: number | null;
  removingKey: number | null;
  onAddToWatchlist: (payload: WatchlistPayload) => void;
  onRemoveFromWatchlist: (gbifSpeciesKey: number) => void;
  onViewTracker: (species: { usageKey: number; commonName: string }) => void;
}

const STATUS_OPTIONS = [
  { code: 'CR', label: 'Critically Endangered' },
  { code: 'EN', label: 'Endangered' },
  { code: 'VU', label: 'Vulnerable' },
  { code: 'NT', label: 'Near Threatened' },
  { code: 'LC', label: 'Least Concern' },
  { code: 'DD', label: 'Data Deficient' },
  { code: 'NE', label: 'Not Evaluated' },
];

const STATUS_STYLE: Record<string, string> = {
  EX: 'bg-slate-700/50 text-slate-200 border-slate-400/20',
  EW: 'bg-slate-700/50 text-slate-200 border-slate-400/20',
  CR: 'bg-red-500/12 text-red-300 border-red-400/25',
  EN: 'bg-orange-500/12 text-orange-300 border-orange-400/25',
  VU: 'bg-amber-500/12 text-amber-300 border-amber-400/25',
  NT: 'bg-yellow-500/12 text-yellow-300 border-yellow-400/25',
  LC: 'bg-emerald-500/12 text-emerald-300 border-emerald-400/25',
  DD: 'bg-slate-500/12 text-slate-300 border-slate-400/20',
  NE: 'bg-slate-500/12 text-slate-300 border-slate-400/20',
};

const getDisplayName = (species: Species) => {
  const s = species as Species & { vernacularNames?: Array<{ language: string; vernacularName: string }> };
  const english = s.vernacularNames?.find((name) => name.language === 'eng');
  return english?.vernacularName || s.vernacularNames?.[0]?.vernacularName || species.canonicalName || species.scientificName;
};

const AdvancedSpeciesSearch: React.FC<AdvancedSpeciesSearchProps> = ({
  isAuthenticated,
  watchlist,
  savingKey,
  removingKey,
  onAddToWatchlist,
  onRemoveFromWatchlist,
  onViewTracker,
}) => {
  const [query, setQuery] = useState('');
  const [kingdom, setKingdom] = useState('');
  const [status, setStatus] = useState('');
  const [rank, setRank] = useState('SPECIES');
  const [limit, setLimit] = useState(40);
  const [results, setResults] = useState<Species[]>([]);
  const [suggestions, setSuggestions] = useState<Species[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/species/suggest?query=${encodeURIComponent(query.trim())}`);
        if (response.ok) {
          const data = await response.json();
          setSuggestions(data || []);
          setShowSuggestions(true);
        }
      } catch {
        // Suggestions should not block the main search flow.
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [query]);

  const handleSearch = async (event?: React.FormEvent, explicitQuery?: string) => {
    event?.preventDefault();
    const searchQuery = (explicitQuery || query).trim();
    if (searchQuery.length < 2) return;

    setQuery(searchQuery);
    setShowSuggestions(false);
    setLoading(true);
    setError(null);
    setSearched(true);

    try {
      const params = new URLSearchParams({
        query: searchQuery,
        rank,
        limit: String(limit),
      });
      if (kingdom) params.set('kingdom', kingdom);
      if (status) params.set('iucn', status);

      const response = await fetch(`${API_BASE_URL}/species/search?${params.toString()}`);
      if (!response.ok) throw new Error('Search failed. Please adjust your filters and try again.');
      const data = await response.json();
      setResults(data.results || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const isSaved = (speciesKey: number) => watchlist.some((item) => item.gbif_species_key === speciesKey);
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

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-6">
      <section className="relative z-30 rounded-2xl border border-white/8 bg-slate-950/55 backdrop-blur-xl p-5 md:p-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-emerald-300 font-semibold">Advanced Search</p>
            <h1 className="text-2xl md:text-3xl font-bold text-white mt-2">Find species by conservation priority</h1>
            <p className="text-sm text-slate-400 mt-2 max-w-2xl">
              Search GBIF species records with filters for IUCN status, kingdom, taxonomic rank, and result depth.
            </p>
          </div>
          <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Ordered by threat status</span>
        </div>

        <form onSubmit={handleSearch} className="mt-6 grid grid-cols-1 lg:grid-cols-[minmax(240px,1fr)_170px_170px_150px_130px] gap-3">
          <div className="relative">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              onBlur={() => window.setTimeout(() => setShowSuggestions(false), 180)}
              placeholder="Species name, common name, or scientific name"
              className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-emerald-400/50"
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/98 shadow-2xl backdrop-blur-xl">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion.key}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => handleSearch(undefined, getDisplayName(suggestion))}
                    className="flex w-full items-center gap-3 border-b border-white/5 px-4 py-3 text-left last:border-0 hover:bg-white/[0.05]"
                  >
                    <svg className="h-3.5 w-3.5 flex-shrink-0 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                    </svg>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-200">{getDisplayName(suggestion)}</p>
                      <p className="truncate text-xs italic text-slate-500">{suggestion.scientificName}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-11 rounded-xl border border-white/10 bg-slate-950 px-3 text-sm text-slate-200 outline-none focus:border-emerald-400/50">
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((option) => <option key={option.code} value={option.code}>{option.code} - {option.label}</option>)}
          </select>
          <select value={kingdom} onChange={(event) => setKingdom(event.target.value)} className="h-11 rounded-xl border border-white/10 bg-slate-950 px-3 text-sm text-slate-200 outline-none focus:border-emerald-400/50">
            <option value="">All kingdoms</option>
            <option value="ANIMALIA">Animals</option>
            <option value="PLANTAE">Plants</option>
            <option value="FUNGI">Fungi</option>
          </select>
          <select value={rank} onChange={(event) => setRank(event.target.value)} className="h-11 rounded-xl border border-white/10 bg-slate-950 px-3 text-sm text-slate-200 outline-none focus:border-emerald-400/50">
            <option value="SPECIES">Species</option>
            <option value="SUBSPECIES">Subspecies</option>
          </select>
          <select value={limit} onChange={(event) => setLimit(Number(event.target.value))} className="h-11 rounded-xl border border-white/10 bg-slate-950 px-3 text-sm text-slate-200 outline-none focus:border-emerald-400/50">
            <option value={20}>20 results</option>
            <option value={40}>40 results</option>
            <option value={80}>80 results</option>
          </select>
          <button type="submit" disabled={loading || query.trim().length < 2} className="lg:col-span-5 h-11 rounded-xl bg-emerald-500 text-sm font-bold text-white hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500 transition-colors">
            {loading ? 'Searching...' : 'Search species'}
          </button>
        </form>
      </section>

      {error && <div className="rounded-2xl border border-red-500/25 bg-red-950/25 p-4 text-sm text-red-300">{error}</div>}

      <section className="relative z-10 rounded-2xl border border-white/8 bg-slate-950/40 backdrop-blur-xl p-4 md:p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white">{searched ? `${results.length} matching records` : 'Search results'}</h2>
          <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500">CR first</span>
        </div>

        {loading && <div className="py-12 text-center text-sm text-slate-500">Searching GBIF...</div>}

        {!loading && searched && results.length === 0 && (
          <div className="py-12 text-center text-sm text-slate-500">No species matched those filters.</div>
        )}

        {!loading && results.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {results.map((species) => {
              const code = species.iucnRedListStatus?.code || 'NE';
              const saved = isSaved(species.key);
              return (
                <article key={species.key} className="rounded-2xl border border-white/8 bg-slate-950/65 p-4 hover:border-emerald-400/25 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-slate-100 truncate">{getDisplayName(species)}</h3>
                      <p className="text-xs italic text-slate-500 truncate mt-1">{species.scientificName}</p>
                    </div>
                    <span className={`rounded-full border px-2 py-1 text-[9px] font-black ${STATUS_STYLE[code] || STATUS_STYLE.NE}`}>{code}</span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div><span className="block text-slate-500">Kingdom</span><span className="text-slate-300 font-semibold">{species.kingdom || 'Unknown'}</span></div>
                    <div><span className="block text-slate-500">Family</span><span className="text-slate-300 font-semibold">{species.family || 'Unknown'}</span></div>
                    <div><span className="block text-slate-500">Rank</span><span className="text-slate-300 font-semibold">{species.rank || 'Unknown'}</span></div>
                    <div><span className="block text-slate-500">Status</span><span className="text-slate-300 font-semibold">{species.iucnRedListStatus?.category || 'Not Evaluated'}</span></div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" onClick={() => onViewTracker({ usageKey: species.key, commonName: getDisplayName(species) })} className="rounded-lg bg-emerald-500/12 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-300 hover:bg-emerald-500/20">
                      Tracker
                    </button>
                    {saved ? (
                      <button type="button" onClick={() => onRemoveFromWatchlist(species.key)} disabled={removingKey === species.key} className="rounded-lg bg-red-500/10 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-red-300 disabled:text-slate-600">
                        {removingKey === species.key ? 'Removing' : 'Saved'}
                      </button>
                    ) : (
                      <button type="button" onClick={() => onAddToWatchlist(toWatchlistPayload(species))} disabled={savingKey === species.key} title={isAuthenticated ? 'Add to watchlist' : 'Sign in to save'} className="rounded-lg bg-white/5 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-cyan-300 hover:bg-white/10 disabled:text-slate-600">
                        {savingKey === species.key ? 'Saving' : 'Watchlist'}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default AdvancedSpeciesSearch;

import React, { useState } from 'react';
import type { WatchlistItem, WatchlistPayload } from '../api';

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
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  React.useEffect(() => {
    if (query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`http://localhost:8000/api/species/suggest?query=${encodeURIComponent(query)}`);
        if (response.ok) {
          const data = await response.json();
          setSuggestions(data || []);
          setShowSuggestions(true);
        }
      } catch (err) {
        console.error('Failed to fetch suggestions', err);
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

    try {
      const response = await fetch(`http://localhost:8000/api/species/search?query=${encodeURIComponent(searchQuery)}`);
      if (!response.ok) {
        throw new Error('Search failed. Please try again.');
      }
      const data = await response.json();
      setResults(data.results || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const getDisplayName = (species: any) => {
    if (species.vernacularNames && species.vernacularNames.length > 0) {
      const engName = species.vernacularNames.find((n: any) => n.language === 'eng');
      if (engName) return engName.vernacularName;
      return species.vernacularNames[0].vernacularName;
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

  return (
    <div className={`${isCompact ? 'w-full' : 'mx-auto max-w-4xl px-4 md:px-6 space-y-8'}`}>
      {!isCompact && (
        <div className="text-center space-y-4">
          <h2 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-500">
            {title}
          </h2>
          <p className="text-slate-400 text-lg">
            {subtitle}
          </p>
        </div>
      )}

      <form onSubmit={handleSearch} className={`relative group z-20 ${isCompact ? 'w-full' : ''}`}>
        {!isCompact && (
          <div className="absolute -inset-1 bg-gradient-to-r from-emerald-600 to-cyan-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200" />
        )}
        <div className={`relative flex items-center ${isCompact ? 'rounded-full bg-white/5 border border-white/10 backdrop-blur-xl shadow-[0_8px_30px_-20px_rgba(0,0,0,0.85)] px-2' : 'bg-slate-900/90 rounded-2xl overflow-hidden border border-white/8 focus-within:border-emerald-500/60 transition-all duration-300 backdrop-blur-xl shadow-lg shadow-black/20'}`}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              if (suggestions.length > 0) setShowSuggestions(true);
            }}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            placeholder="Search species name (e.g. Lion)..."
            className={`flex-1 bg-transparent border-none focus:ring-0 text-slate-100 placeholder:text-slate-500 outline-none ${isCompact ? 'px-3 py-2.5 text-sm' : 'px-6 py-4 text-base'}`}
          />
          <button
            type="submit"
            disabled={loading}
            className={`inline-flex items-center justify-center bg-emerald-500 hover:bg-emerald-400 text-white font-semibold transition-all duration-300 disabled:bg-slate-700 disabled:text-slate-400 shadow-[0_10px_24px_-16px_rgba(16,185,129,0.8)] ${isCompact ? 'px-4 py-2 text-xs rounded-full mr-1 border border-emerald-300/20' : 'px-8 py-4 rounded-r-2xl border-l border-emerald-300/10'}`}
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>

        {showSuggestions && suggestions.length > 0 && (
          <div className={`absolute top-full mt-2 z-30 left-0 right-0 ${isCompact ? 'bg-slate-950/35 backdrop-blur-2xl' : 'bg-slate-900/95 border border-white/8 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-xl'}`}>
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleSearch(undefined, getDisplayName(suggestion))}
                className={`w-full text-left px-4 py-3 hover:bg-white/5 text-slate-300 hover:text-emerald-300 transition-colors border-b border-white/5 last:border-0 ${isCompact ? 'backdrop-blur-2xl' : ''}`}
              >
                <div className="font-medium">
                  {getDisplayName(suggestion)}
                </div>
                <div className="text-xs text-slate-500 flex gap-2 mt-1">
                  <span className="italic">{suggestion.scientificName}</span>
                  <span>-</span>
                  <span className="uppercase">{suggestion.rank}</span>
                  {suggestion.kingdom && <span>- {suggestion.kingdom}</span>}
                </div>
              </button>
            ))}
          </div>
        )}
      </form>

      {error && (
        <div className="p-4 bg-red-900/30 border border-red-500/30 rounded-2xl text-red-300 text-center animate-pulse backdrop-blur-sm">
          {error}
        </div>
      )}

      <div className={`grid grid-cols-1 gap-4 ${isCompact ? '' : 'md:grid-cols-2 md:gap-6'}`}>
        {results.map((species) => (
          <div
            key={species.key}
            className={`group relative bg-slate-900/55 backdrop-blur-sm border border-white/8 rounded-2xl hover:border-emerald-500/40 transition-all duration-500 hover:shadow-[0_0_30px_-10px_rgba(16,185,129,0.3)] ${isCompact ? 'p-4' : 'p-6'}`}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className={`${isCompact ? 'text-base' : 'text-xl'} font-bold text-slate-100 group-hover:text-emerald-300 transition-colors`}>
                  {getDisplayName(species)}
                </h3>
                <p className={`${isCompact ? 'text-[11px]' : 'text-sm'} text-slate-500 italic`}>{species.scientificName}</p>
              </div>
              <div className="flex flex-col gap-2 items-end">
                <span className="px-3 py-1 rounded-full bg-slate-800 text-emerald-300 text-[10px] font-semibold border border-emerald-500/20">
                  {species.rank}
                </span>
                {species.iucnRedListStatus && (
                  <span
                    className={`px-3 py-1 rounded-full text-[10px] font-bold border ${
                      ['EX', 'EW', 'CR', 'EN', 'VU'].includes(species.iucnRedListStatus.code)
                        ? 'bg-red-900/30 text-red-300 border-red-500/30'
                        : 'bg-emerald-900/30 text-emerald-300 border-emerald-500/30'
                    }`}
                  >
                    {species.iucnRedListStatus.category}
                  </span>
                )}
              </div>
            </div>

            <div className={`grid grid-cols-2 gap-4 ${isCompact ? 'text-[11px]' : 'text-sm'}`}>
              <div className="space-y-1">
                <span className="text-slate-500 block">Kingdom</span>
                <span className="text-slate-300 font-medium">{species.kingdom || 'Unknown'}</span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-500 block">Family</span>
                <span className="text-slate-300 font-medium">{species.family || 'Unknown'}</span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-500 block">Taxonomy</span>
                <span className={`font-medium ${species.taxonomicStatus === 'ACCEPTED' ? 'text-emerald-300' : 'text-amber-300'}`}>
                  {species.taxonomicStatus || 'Unknown'}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-500 block">Genus</span>
                <span className="text-slate-300 font-medium">{species.genus || 'Unknown'}</span>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-white/8 flex flex-wrap items-center justify-end gap-3">
              {isSaved(species.key) ? (
                <button
                  type="button"
                  onClick={() => onRemoveFromWatchlist(species.key)}
                  disabled={removingKey === species.key}
                  className="mr-auto text-red-300 text-[10px] font-black uppercase tracking-[0.24em] hover:text-red-200 disabled:text-slate-600"
                >
                  {removingKey === species.key ? 'Removing...' : 'Remove saved'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onAddToWatchlist(toWatchlistPayload(species))}
                  disabled={savingKey === species.key}
                  className="mr-auto text-cyan-300 text-[10px] font-black uppercase tracking-[0.24em] hover:text-cyan-200 disabled:text-slate-600"
                  title={isAuthenticated ? 'Add this species to your watchlist' : 'Sign in to save species'}
                >
                  {savingKey === species.key ? 'Saving...' : 'Add to watchlist'}
                </button>
              )}
              <button
                type="button"
                onClick={() => onViewTracker({ usageKey: species.key, commonName: getDisplayName(species) })}
                className="text-emerald-300 text-[10px] font-black uppercase tracking-[0.24em] hover:text-emerald-200 flex items-center gap-2 group/btn"
              >
                View live tracker stats
                <span className="group-hover/btn:translate-x-1 transition-transform">→</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {!loading && results.length === 0 && query.length >= 2 && (
        <div className="text-center py-16 bg-slate-900/20 border border-dashed border-white/10 rounded-3xl backdrop-blur-sm">
          <p className="text-slate-500">No species found matching your search.</p>
        </div>
      )}
    </div>
  );
};

export default SpeciesSearch;

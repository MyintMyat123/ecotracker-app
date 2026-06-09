import React, { useMemo, useState } from 'react';
import { API_BASE_URL } from '../api';
import type { WatchlistItem, WatchlistPayload } from '../api';

// API response format from /api/species/country/{name}
interface CountrySpecies {
  id: number;
  name: string;
  common_name: string | null;
  scientific_name: string;
  conservation_status: string;
  country: string;
  family?: string | null;
  kingdom?: string | null;
}

interface CountryExplorerProps {
  isAuthenticated: boolean;
  watchlist: WatchlistItem[];
  savingKey: number | null;
  removingKey: number | null;
  onAddToWatchlist: (payload: WatchlistPayload) => void;
  onRemoveFromWatchlist: (gbifSpeciesKey: number) => void;
  onViewTracker: (species: { usageKey: number; commonName: string }) => void;
}

const IUCN_BADGE: Record<string, { bg: string; text: string; border: string; label: string }> = {
  CR: { bg: 'bg-red-900/40',    text: 'text-red-300',    border: 'border-red-500/30',    label: 'Critically Endangered' },
  EN: { bg: 'bg-orange-900/40', text: 'text-orange-300', border: 'border-orange-500/30', label: 'Endangered' },
  VU: { bg: 'bg-amber-900/40',  text: 'text-amber-300',  border: 'border-amber-500/30',  label: 'Vulnerable' },
  NT: { bg: 'bg-yellow-900/40', text: 'text-yellow-300', border: 'border-yellow-500/30', label: 'Near Threatened' },
  LC: { bg: 'bg-emerald-900/40',text: 'text-emerald-300',border: 'border-emerald-500/30',label: 'Least Concern' },
  DD: { bg: 'bg-slate-800/60',  text: 'text-slate-300',  border: 'border-slate-500/30',  label: 'Data Deficient' },
  NE: { bg: 'bg-slate-800/60',  text: 'text-slate-400',  border: 'border-slate-600/30',  label: 'Not Evaluated' },
};

const POPULAR_COUNTRIES = [
  'Brazil', 'Indonesia', 'Colombia', 'Australia', 'China',
  'India', 'Peru', 'Mexico', 'Madagascar', 'South Africa',
  'United States', 'Canada', 'Russia', 'Japan', 'Kenya',
];

const STATUS_ORDER = ['CR', 'EN', 'VU', 'NT', 'LC', 'DD', 'NE'];
const statusWeight = (code: string) => {
  const index = STATUS_ORDER.indexOf(code || 'NE');
  return index === -1 ? STATUS_ORDER.length : index;
};

const CountryExplorer: React.FC<CountryExplorerProps> = ({
  isAuthenticated,
  watchlist,
  savingKey,
  removingKey,
  onAddToWatchlist,
  onRemoveFromWatchlist,
  onViewTracker,
}) => {
  const [country, setCountry] = useState('');
  const [results, setResults] = useState<CountrySpecies[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState<string | null>(null);
  const [nameFilter, setNameFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [kingdomFilter, setKingdomFilter] = useState('');

  const search = async (countryName: string) => {
    if (!countryName.trim()) return;
    setLoading(true);
    setError(null);
    setSearched(countryName);
    setResults([]);
    try {
      const response = await fetch(`${API_BASE_URL}/species/country/${encodeURIComponent(countryName)}`);
      if (!response.ok) throw new Error('Failed to fetch species for this country.');
      const data = await response.json();
      // API returns a plain array
      setResults(Array.isArray(data) ? data : (data.results || []));
      setNameFilter('');
      setStatusFilter('');
      setKingdomFilter('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const isSaved = (key: number) => watchlist.some((w) => w.gbif_species_key === key);

  // Count by status for summary bar
  const statusCounts = results.reduce<Record<string, number>>((acc, s) => {
    const code = s.conservation_status || 'NE';
    acc[code] = (acc[code] || 0) + 1;
    return acc;
  }, {});

  const kingdomOptions = useMemo(() => {
    return Array.from(new Set(results.map((species) => species.kingdom).filter(Boolean))) as string[];
  }, [results]);

  const filteredResults = useMemo(() => {
    const needle = nameFilter.trim().toLowerCase();

    return results
      .filter((species) => {
        const matchesName = !needle || [
          species.common_name,
          species.name,
          species.scientific_name,
          species.family,
        ].some((value) => value?.toLowerCase().includes(needle));
        const matchesStatus = !statusFilter || species.conservation_status === statusFilter;
        const matchesKingdom = !kingdomFilter || species.kingdom === kingdomFilter;

        return matchesName && matchesStatus && matchesKingdom;
      })
      .sort((a, b) => {
        const statusDiff = statusWeight(a.conservation_status) - statusWeight(b.conservation_status);
        if (statusDiff !== 0) return statusDiff;
        return (a.common_name || a.scientific_name).localeCompare(b.common_name || b.scientific_name);
      });
  }, [kingdomFilter, nameFilter, results, statusFilter]);

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 space-y-8">
      {/* Header */}
      <div className="text-center space-y-3">
        <h2 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-500">
          Country Explorer
        </h2>
        <p className="text-slate-400 text-lg max-w-2xl mx-auto">
          Discover endangered and threatened species by country from the GBIF database.
        </p>
      </div>

      {/* Search */}
      <form
        onSubmit={(e) => { e.preventDefault(); search(country); }}
        className="flex gap-3"
      >
        <input
          type="text"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          placeholder="Enter a country name (e.g. Brazil, Indonesia)..."
          className="flex-1 bg-slate-900/80 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold rounded-xl text-sm transition-all disabled:bg-slate-700 disabled:text-slate-400"
        >
          {loading ? 'Searching...' : 'Explore'}
        </button>
      </form>

      {/* Popular Countries */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500 font-semibold mb-3">Popular Regions</p>
        <div className="flex flex-wrap gap-2">
          {POPULAR_COUNTRIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => { setCountry(c); search(c); }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                searched === c
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : 'bg-white/5 text-slate-400 border-white/8 hover:bg-white/10 hover:text-white'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-900/20 border border-red-500/25 rounded-2xl text-red-300 text-sm text-center">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="rounded-2xl border border-white/8 bg-slate-900/40 p-5 animate-pulse space-y-3">
              <div className="h-5 bg-white/10 rounded w-3/4" />
              <div className="h-3 bg-white/5 rounded w-1/2" />
              <div className="grid grid-cols-2 gap-2">
                <div className="h-8 bg-white/5 rounded" />
                <div className="h-8 bg-white/5 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      {!loading && results.length > 0 && (
        <>
          {/* Summary bar */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-slate-400 text-sm">
              <span className="text-white font-semibold">{filteredResults.length}</span>
              {filteredResults.length !== results.length && <span className="text-slate-500"> of {results.length}</span>} threatened species found in{' '}
              <span className="text-emerald-300 font-semibold">{searched}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(statusCounts).sort((a, b) => {
                const order = ['CR', 'EN', 'VU', 'NT', 'LC', 'DD', 'NE'];
                return order.indexOf(a[0]) - order.indexOf(b[0]);
              }).map(([code, count]) => {
                const badge = IUCN_BADGE[code] || IUCN_BADGE.NE;
                return (
                  <span key={code} className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${badge.bg} ${badge.text} ${badge.border}`}>
                    {code}: {count}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[minmax(220px,1fr)_180px_180px_auto] gap-3 rounded-2xl border border-white/8 bg-slate-950/45 p-3">
            <input
              value={nameFilter}
              onChange={(event) => setNameFilter(event.target.value)}
              placeholder="Filter by common name, scientific name, or family"
              className="h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-emerald-400/50"
            />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-10 rounded-xl border border-white/10 bg-slate-950 px-3 text-sm text-slate-200 outline-none focus:border-emerald-400/50"
            >
              <option value="">All statuses</option>
              <option value="CR">CR - Critically Endangered</option>
              <option value="EN">EN - Endangered</option>
              <option value="VU">VU - Vulnerable</option>
            </select>
            <select
              value={kingdomFilter}
              onChange={(event) => setKingdomFilter(event.target.value)}
              className="h-10 rounded-xl border border-white/10 bg-slate-950 px-3 text-sm text-slate-200 outline-none focus:border-emerald-400/50"
            >
              <option value="">All kingdoms</option>
              {kingdomOptions.map((kingdom) => (
                <option key={kingdom} value={kingdom}>{kingdom}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => { setNameFilter(''); setStatusFilter(''); setKingdomFilter(''); }}
              className="h-10 rounded-xl border border-white/10 px-4 text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5"
            >
              Reset
            </button>
          </div>

          {filteredResults.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/35 py-12 text-center text-sm text-slate-500">
              No species match the active filters.
            </div>
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredResults.map((species) => {
              const iucnCode = species.conservation_status || 'NE';
              const badge = IUCN_BADGE[iucnCode] || IUCN_BADGE.NE;
              const saved = isSaved(species.id);
              const commonName = species.common_name || (species.name !== species.scientific_name ? species.name : null);
              const displayName = commonName || species.scientific_name;

              return (
                <div
                  key={species.id}
                  className="group bg-slate-900/50 border border-white/8 rounded-2xl hover:border-emerald-500/30 transition-all duration-300 p-5"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1 min-w-0 pr-2">
                      <h3 className="text-sm font-bold text-slate-100 group-hover:text-emerald-300 transition-colors leading-tight">
                        {displayName}
                      </h3>
                      {commonName && species.scientific_name !== displayName && (
                        <p className="text-[10px] text-slate-500 italic mt-0.5">{species.scientific_name}</p>
                      )}
                    </div>
                    <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[9px] font-black border ${badge.bg} ${badge.text} ${badge.border}`}>
                      {iucnCode}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px] mb-4">
                    {species.kingdom && (
                      <div><span className="text-slate-500 block">Kingdom</span><span className="text-slate-300">{species.kingdom}</span></div>
                    )}
                    {species.family && (
                      <div><span className="text-slate-500 block">Family</span><span className="text-slate-300">{species.family}</span></div>
                    )}
                    <div><span className="text-slate-500 block">Country</span><span className="text-slate-300">{species.country}</span></div>
                    <div><span className="text-slate-500 block">Status</span><span className={badge.text}>{badge.label}</span></div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-white/8">
                    <div>
                      {saved ? (
                        <button
                          type="button"
                          onClick={() => onRemoveFromWatchlist(species.id)}
                          disabled={removingKey === species.id}
                          className="text-[10px] text-red-400 hover:text-red-300 font-semibold uppercase tracking-wide"
                        >
                          {removingKey === species.id ? 'Removing...' : 'Saved ✓'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onAddToWatchlist({
                            gbif_species_key: species.id,
                            common_name: commonName,
                            scientific_name: species.scientific_name,
                            conservation_status: iucnCode,
                            conservation_status_label: badge.label,
                            family: species.family ?? null,
                            kingdom: species.kingdom ?? null,
                          })}
                          disabled={savingKey === species.id || !isAuthenticated}
                          className="text-[10px] text-cyan-300 hover:text-cyan-200 font-semibold uppercase tracking-wide disabled:opacity-40"
                          title={isAuthenticated ? 'Add to watchlist' : 'Sign in to save'}
                        >
                          {savingKey === species.id ? 'Saving...' : '+ Watchlist'}
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => onViewTracker({ usageKey: species.id, commonName: displayName })}
                      className="inline-flex items-center gap-1.5 text-[10px] text-emerald-300 hover:text-emerald-200 font-bold uppercase tracking-wide transition-colors"
                    >
                      View tracker
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </>
      )}

      {!loading && searched && results.length === 0 && !error && (
        <div className="text-center py-16 rounded-3xl border border-dashed border-white/10 bg-slate-900/20">
          <div className="text-4xl mb-3">🌍</div>
          <p className="text-slate-400 font-medium">No species found for "{searched}"</p>
          <p className="text-slate-500 text-sm mt-1">Try a different country name or check the spelling</p>
        </div>
      )}
    </div>
  );
};

export default CountryExplorer;

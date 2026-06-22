import React, { useEffect, useState } from 'react';
import { API_BASE_URL } from '../api';
import type { WatchlistItem } from '../api';

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

interface ComparisonMetric {
  usageKey: number;
  commonName: string;
  scientificName: string;
  status: string;
  statusLabel: string;
  globalSightings: number;
  countriesObserved: number;
  lastObserved: string | null;
  dataConfidence: {
    score: number;
    label: string;
  };
  recordTypes: Array<{ name: string; count: number }>;
}

const STATUS_WEIGHT: Record<string, number> = { CR: 0, EN: 1, VU: 2, NT: 3, LC: 4, DD: 5, NE: 6 };

const formatFacetName = (value: string) => value
  .replace(/_/g, ' ')
  .toLowerCase()
  .replace(/\b\w/g, (char) => char.toUpperCase());

interface WatchlistPageProps {
  items: WatchlistItem[];
  signedIn: boolean;
  onBackHome: () => void;
  onOpenTracker: (species: { usageKey: number; commonName: string }) => void;
  onRemove: (gbifSpeciesKey: number) => void;
  removingKey: number | null;
  onSignIn: () => void;
}

const WatchlistPage: React.FC<WatchlistPageProps> = ({
  items, signedIn, onBackHome, onOpenTracker, onRemove, removingKey, onSignIn,
}) => {
  const [filter, setFilter] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'status'>('date');
  const [selectedCompareKeys, setSelectedCompareKeys] = useState<number[]>([]);
  const [comparison, setComparison] = useState<ComparisonMetric[]>([]);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [comparisonError, setComparisonError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedCompareKeys((current) =>
      current.filter((key) => items.some((item) => item.gbif_species_key === key))
    );
  }, [items]);

  useEffect(() => {
    if (selectedCompareKeys.length < 2) {
      setComparison([]);
      setComparisonError(null);
      return;
    }

    let cancelled = false;
    const loadComparison = async () => {
      setComparisonLoading(true);
      setComparisonError(null);
      try {
        const selectedItems = selectedCompareKeys
          .map((key) => items.find((item) => item.gbif_species_key === key))
          .filter(Boolean) as WatchlistItem[];
        const metrics = await Promise.all(selectedItems.map(async (item) => {
          const response = await fetch(`${API_BASE_URL}/species/${item.gbif_species_key}/tracker`);
          if (!response.ok) throw new Error('Failed to load one or more comparison metrics.');
          const data = await response.json();

          return {
            usageKey: item.gbif_species_key,
            commonName: item.common_name || data.identity?.canonicalName || item.scientific_name,
            scientificName: data.identity?.scientificName || item.scientific_name,
            status: data.conservation?.status || item.conservation_status || 'NE',
            statusLabel: data.conservation?.statusLabel || item.conservation_status_label || 'Not Evaluated',
            globalSightings: data.trackerStats?.globalSightings || 0,
            countriesObserved: data.trackerStats?.countriesObserved?.length || 0,
            lastObserved: data.trackerStats?.lastObserved || item.last_observed_at,
            dataConfidence: data.monitoring?.dataConfidence || { score: 0, label: 'Limited' },
            recordTypes: data.monitoring?.recordTypes || [],
          };
        }));

        if (!cancelled) setComparison(metrics);
      } catch (err) {
        if (!cancelled) {
          setComparison([]);
          setComparisonError(err instanceof Error ? err.message : 'Failed to build comparison.');
        }
      } finally {
        if (!cancelled) setComparisonLoading(false);
      }
    };

    loadComparison();
    return () => {
      cancelled = true;
    };
  }, [items, selectedCompareKeys]);

  if (!signedIn) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
          <svg className="w-10 h-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">Your Watchlist</h2>
          <p className="text-slate-400 mt-2">Sign in to save and track endangered species you care about.</p>
        </div>
        <div className="flex gap-3 justify-center">
          <button type="button" onClick={onSignIn} className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold rounded-full text-sm transition-all">Sign In</button>
          <button type="button" onClick={onBackHome} className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 font-semibold rounded-full text-sm transition-all">Explore Species</button>
        </div>
      </div>
    );
  }

  const filteredItems = items
    .filter((item) => {
      if (!filter) return true;
      const q = filter.toLowerCase();
      return (
        item.scientific_name.toLowerCase().includes(q) ||
        (item.common_name?.toLowerCase().includes(q)) ||
        (item.family?.toLowerCase().includes(q)) ||
        (item.kingdom?.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      if (sortBy === 'name') return (a.common_name || a.scientific_name).localeCompare(b.common_name || b.scientific_name);
      if (sortBy === 'status') return (a.conservation_status || '').localeCompare(b.conservation_status || '');
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const criticalCount = items.filter((i) => ['CR', 'EN'].includes(i.conservation_status || '')).length;
  const recentlyChangedCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const riskGroups = {
    criticallyEndangered: items.filter((item) => item.conservation_status === 'CR'),
    endangered: items.filter((item) => item.conservation_status === 'EN'),
    vulnerable: items.filter((item) => item.conservation_status === 'VU'),
    recentlyChanged: items.filter((item) => new Date(item.updated_at).getTime() >= recentlyChangedCutoff),
    lowDataConfidence: items.filter((item) => !item.last_observed_at || !item.image_url || !item.family || !item.kingdom),
  };
  const priorityQueue = [...items]
    .sort((a, b) => {
      const statusDiff = (STATUS_WEIGHT[a.conservation_status || 'NE'] ?? 9) - (STATUS_WEIGHT[b.conservation_status || 'NE'] ?? 9);
      if (statusDiff !== 0) return statusDiff;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    })
    .slice(0, 5);
  const toggleCompare = (key: number) => {
    setSelectedCompareKeys((current) => {
      if (current.includes(key)) return current.filter((item) => item !== key);
      if (current.length >= 4) return current;
      return [...current, key];
    });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">My Watchlist</h1>
          <p className="text-slate-400 text-sm mt-1">
            {items.length} species tracked
            {criticalCount > 0 && (
              <span className="ml-2 px-2 py-0.5 rounded-full bg-red-500/15 text-red-300 border border-red-500/25 text-[10px] font-bold">{criticalCount} critical</span>
            )}
          </p>
        </div>
        <button type="button" onClick={onBackHome} className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
          Back to Explorer
        </button>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-20 rounded-3xl border border-dashed border-white/10 bg-slate-900/20">
          <div className="text-5xl mb-4">🌿</div>
          <h3 className="text-xl font-semibold text-white">Your watchlist is empty</h3>
          <p className="text-slate-400 mt-2 mb-6">Search for species and add them to track their conservation status.</p>
          <button type="button" onClick={onBackHome} className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold rounded-full text-sm transition-all">Explore Species</button>
        </div>
      ) : (
        <>
          <section className="rounded-3xl border border-white/8 bg-slate-950/55 p-5 shadow-2xl shadow-black/20">
            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.24em] text-emerald-300 font-black">Risk dashboard</p>
                <h2 className="mt-1 text-xl font-black text-white">Watchlist attention queue</h2>
              </div>
              <p className="max-w-xl text-xs leading-5 text-slate-400">
                Grouped by conservation urgency, recent updates, and records that need more evidence before decisions are made.
              </p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              {[
                { label: 'Critically Endangered', value: riskGroups.criticallyEndangered.length, tone: 'text-red-200 border-red-400/25 bg-red-500/10' },
                { label: 'Endangered', value: riskGroups.endangered.length, tone: 'text-orange-200 border-orange-400/25 bg-orange-500/10' },
                { label: 'Vulnerable', value: riskGroups.vulnerable.length, tone: 'text-amber-200 border-amber-400/25 bg-amber-500/10' },
                { label: 'Recently changed', value: riskGroups.recentlyChanged.length, tone: 'text-cyan-200 border-cyan-400/25 bg-cyan-500/10' },
                { label: 'Low data confidence', value: riskGroups.lowDataConfidence.length, tone: 'text-violet-200 border-violet-400/25 bg-violet-500/10' },
              ].map((item) => (
                <div key={item.label} className={`rounded-2xl border p-4 ${item.tone}`}>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-80">{item.label}</p>
                  <p className="mt-3 text-3xl font-black">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_1fr]">
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500 font-black">Priority species</p>
                <div className="mt-3 space-y-2">
                  {priorityQueue.map((item) => {
                    const label = item.common_name || item.scientific_name;
                    const badge = IUCN_BADGE[item.conservation_status || 'DD'] || IUCN_BADGE.DD;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onOpenTracker({ usageKey: item.gbif_species_key, commonName: label })}
                        className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/8 bg-slate-950/45 px-3 py-2 text-left hover:border-emerald-400/25"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-bold text-slate-100">{label}</span>
                          <span className="block truncate text-[10px] italic text-slate-500">{item.scientific_name}</span>
                        </span>
                        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-black ${badge.bg} ${badge.text} ${badge.border}`}>
                          {item.conservation_status || 'NE'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500 font-black">Data review cues</p>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl bg-slate-950/45 px-3 py-2">
                    <span className="block text-slate-500">Missing recent observation</span>
                    <strong className="text-slate-100">{items.filter((item) => !item.last_observed_at).length}</strong>
                  </div>
                  <div className="rounded-xl bg-slate-950/45 px-3 py-2">
                    <span className="block text-slate-500">No image evidence</span>
                    <strong className="text-slate-100">{items.filter((item) => !item.image_url).length}</strong>
                  </div>
                  <div className="rounded-xl bg-slate-950/45 px-3 py-2">
                    <span className="block text-slate-500">Missing family/kingdom</span>
                    <strong className="text-slate-100">{items.filter((item) => !item.family || !item.kingdom).length}</strong>
                  </div>
                  <div className="rounded-xl bg-slate-950/45 px-3 py-2">
                    <span className="block text-slate-500">Updated this week</span>
                    <strong className="text-slate-100">{riskGroups.recentlyChanged.length}</strong>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-white/8 bg-slate-950/55 p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.24em] text-cyan-300 font-black">Species comparison</p>
                <h2 className="mt-1 text-xl font-black text-white">Compare 2-4 watchlisted species</h2>
              </div>
              <p className="text-xs text-slate-400">{selectedCompareKeys.length}/4 selected</p>
            </div>

            {selectedCompareKeys.length < 2 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-sm text-slate-400">
                Select at least two species from the watchlist cards below to compare conservation status, sightings, countries, confidence, and evidence mix.
              </div>
            ) : comparisonLoading ? (
              <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-6 text-sm text-slate-300">Building comparison...</div>
            ) : comparisonError ? (
              <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{comparisonError}</div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-0 text-sm">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10 bg-slate-950 px-3 py-3 text-left text-[10px] uppercase tracking-[0.18em] text-slate-500">Metric</th>
                      {comparison.map((item) => (
                        <th key={item.usageKey} className="min-w-[210px] border-l border-white/8 px-3 py-3 text-left">
                          <span className="block text-sm font-black text-white">{item.commonName}</span>
                          <span className="block text-[10px] italic text-slate-500">{item.scientificName}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="[&_td]:border-t [&_td]:border-white/8">
                    {[
                      ['Conservation status', (item: ComparisonMetric) => `${item.status} - ${item.statusLabel}`],
                      ['Global sightings', (item: ComparisonMetric) => item.globalSightings.toLocaleString()],
                      ['Countries observed', (item: ComparisonMetric) => item.countriesObserved.toLocaleString()],
                      ['Last spotted', (item: ComparisonMetric) => item.lastObserved ? new Date(item.lastObserved).toLocaleDateString() : 'No date'],
                      ['Data confidence', (item: ComparisonMetric) => `${item.dataConfidence.label} (${item.dataConfidence.score})`],
                      ['Evidence mix', (item: ComparisonMetric) => item.recordTypes.length ? item.recordTypes.slice(0, 3).map((record) => `${formatFacetName(record.name)} ${record.count}`).join(', ') : 'No basis data'],
                    ].map(([label, render]) => (
                      <tr key={label as string}>
                        <td className="sticky left-0 z-10 bg-slate-950 px-3 py-3 text-xs font-bold text-slate-400">{label as string}</td>
                        {comparison.map((item) => (
                          <td key={`${item.usageKey}-${label}`} className="border-l border-white/8 px-3 py-3 text-slate-200">
                            {(render as (item: ComparisonMetric) => string)(item)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
              <input type="text" placeholder="Filter by name, family, kingdom..." value={filter} onChange={(e) => setFilter(e.target.value)} className="w-full bg-slate-900/80 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50" />
            </div>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as 'date' | 'name' | 'status')} className="bg-slate-900/80 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500/50">
              <option value="date">Sort: Date Added</option>
              <option value="name">Sort: Name</option>
              <option value="status">Sort: Status</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.map((item) => {
              const iucnCode = item.conservation_status || 'NE';
              const badge = IUCN_BADGE[iucnCode] || IUCN_BADGE.DD;
              const isCritical = ['CR', 'EN', 'VU'].includes(iucnCode);
              const label = item.common_name || item.scientific_name;
              const selectedForCompare = selectedCompareKeys.includes(item.gbif_species_key);
              const compareDisabled = !selectedForCompare && selectedCompareKeys.length >= 4;

              return (
                <div key={item.id} className="group relative bg-slate-900/50 backdrop-blur-sm border border-white/8 rounded-2xl hover:border-emerald-500/30 transition-all duration-300 overflow-hidden">
                  {item.image_url ? (
                    <div className="relative h-40 overflow-hidden">
                      <img src={item.image_url} alt={label} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" loading="lazy" />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 to-transparent" />
                      <div className="absolute bottom-2 left-3">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border ${badge.bg} ${badge.text} ${badge.border}`}>{iucnCode} · {item.conservation_status_label || 'Unknown'}</span>
                      </div>
                    </div>
                  ) : (
                    <div className={`relative h-24 flex items-center justify-center ${isCritical ? 'bg-red-950/20' : 'bg-emerald-950/20'}`}>
                      <svg className={`w-10 h-10 ${isCritical ? 'text-red-500/30' : 'text-emerald-500/30'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" /></svg>
                      <div className="absolute top-2 right-3">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border ${badge.bg} ${badge.text} ${badge.border}`}>{iucnCode}</span>
                      </div>
                    </div>
                  )}
                  <div className="p-4 space-y-3">
                    <div>
                      <h3 className="text-white font-bold text-sm leading-tight group-hover:text-emerald-300 transition-colors">{label}</h3>
                      <p className="text-slate-500 text-xs italic mt-0.5">{item.scientific_name}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div><span className="text-slate-500 block">Kingdom</span><span className="text-slate-300">{item.kingdom || '—'}</span></div>
                      <div><span className="text-slate-500 block">Family</span><span className="text-slate-300">{item.family || '—'}</span></div>
                      {item.last_observed_at && (
                        <div className="col-span-2"><span className="text-slate-500 block">Last Observed</span><span className="text-slate-300">{new Date(item.last_observed_at).toLocaleDateString()}</span></div>
                      )}
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-white/8">
                      <button type="button" onClick={() => onRemove(item.gbif_species_key)} disabled={removingKey === item.gbif_species_key} className="text-[10px] text-red-400 hover:text-red-300 font-semibold uppercase tracking-wide disabled:text-slate-600 transition-colors">
                        {removingKey === item.gbif_species_key ? 'Removing...' : 'Remove'}
                      </button>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => toggleCompare(item.gbif_species_key)}
                          disabled={compareDisabled}
                          className={`text-[10px] font-bold uppercase tracking-wide transition-colors disabled:opacity-40 ${
                            selectedForCompare ? 'text-cyan-200' : 'text-slate-400 hover:text-cyan-200'
                          }`}
                        >
                          {selectedForCompare ? 'Selected' : 'Compare'}
                        </button>
                        <button type="button" onClick={() => onOpenTracker({ usageKey: item.gbif_species_key, commonName: label })} className="inline-flex items-center gap-1.5 text-[10px] text-emerald-300 hover:text-emerald-200 font-bold uppercase tracking-wide transition-colors">
                          Open tracker
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredItems.length === 0 && filter && (
            <div className="text-center py-10 text-slate-500">No species match your filter "{filter}"</div>
          )}
        </>
      )}
    </div>
  );
};

export default WatchlistPage;

import React, { useState } from 'react';
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
                      <button type="button" onClick={() => onOpenTracker({ usageKey: item.gbif_species_key, commonName: label })} className="inline-flex items-center gap-1.5 text-[10px] text-emerald-300 hover:text-emerald-200 font-bold uppercase tracking-wide transition-colors">
                        Open tracker
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                      </button>
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

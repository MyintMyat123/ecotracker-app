import React from 'react';
import type { WatchlistItem } from '../api';

interface WatchlistPanelProps {
  items: WatchlistItem[];
  onRemove: (gbifSpeciesKey: number) => void;
  removingKey: number | null;
}

const WatchlistPanel: React.FC<WatchlistPanelProps> = ({ items, onRemove, removingKey }) => {
  return (
    <section className="max-w-4xl mx-auto px-6 pb-10">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-white font-black text-xs uppercase tracking-widest">My Watchlist</h2>
        <div className="h-px bg-slate-800 flex-1"></div>
        <span className="text-slate-500 text-xs font-bold">{items.length} saved</span>
      </div>

      {items.length === 0 ? (
        <div className="border border-dashed border-slate-800 rounded-2xl p-8 text-center text-slate-500 text-sm">
          Saved species will appear here after you add them from search results or tracker pages.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((item) => (
            <article key={item.id} className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
              {item.image_url && (
                <img src={item.image_url} alt={item.common_name || item.scientific_name} className="w-full h-36 object-cover" />
              )}
              <div className="p-5 space-y-4">
                <div className="flex justify-between gap-4">
                  <div>
                    <h3 className="text-white font-bold leading-tight">{item.common_name || item.scientific_name}</h3>
                    <p className="text-slate-500 text-sm italic">{item.scientific_name}</p>
                  </div>
                  {item.conservation_status && (
                    <span className="h-fit px-2 py-1 rounded-md bg-emerald-900/30 text-emerald-400 border border-emerald-500/20 text-[10px] font-black">
                      {item.conservation_status}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="block text-slate-500">Family</span>
                    <span className="text-slate-300 font-medium">{item.family || 'Unknown'}</span>
                  </div>
                  <div>
                    <span className="block text-slate-500">Kingdom</span>
                    <span className="text-slate-300 font-medium">{item.kingdom || 'Unknown'}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onRemove(item.gbif_species_key)}
                  disabled={removingKey === item.gbif_species_key}
                  className="w-full bg-slate-950 hover:bg-red-950/40 border border-slate-800 hover:border-red-500/40 text-slate-300 hover:text-red-300 rounded-lg py-2 text-xs font-black uppercase tracking-widest"
                >
                  {removingKey === item.gbif_species_key ? 'Removing' : 'Remove'}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};

export default WatchlistPanel;

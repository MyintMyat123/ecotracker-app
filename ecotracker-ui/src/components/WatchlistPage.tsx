import React from 'react';
import type { WatchlistItem } from '../api';

interface TrackerSelection {
  usageKey: number;
  commonName: string;
}

interface WatchlistPageProps {
  items: WatchlistItem[];
  signedIn: boolean;
  onBackHome: () => void;
  onOpenTracker: (species: TrackerSelection) => void;
  onRemove: (gbifSpeciesKey: number) => void;
  removingKey: number | null;
  onSignIn: () => void;
}

const WatchlistPage: React.FC<WatchlistPageProps> = ({
  items,
  signedIn,
  onBackHome,
  onOpenTracker,
  onRemove,
  removingKey,
  onSignIn,
}) => {
  return (
    <div className="w-full px-4 sm:px-6 lg:px-8">
      <div className="w-full flex flex-col gap-6">
        <button
          type="button"
          onClick={onBackHome}
          className="inline-flex w-fit items-center gap-2 bg-transparent border-0 p-0 text-sm font-medium text-slate-400 hover:text-white transition-colors"
        >
          <span className="text-base leading-none">←</span>
          Back to Home
        </button>

        {!signedIn ? (
          <div className="min-h-[60vh] rounded-[2rem] border border-dashed border-white/10 bg-slate-950/40 backdrop-blur-xl flex items-center justify-center p-8">
            <div className="max-w-xl text-center space-y-4">
              <p className="text-[10px] uppercase tracking-[0.32em] text-emerald-300/80 font-semibold">Sign in required</p>
              <h2 className="text-3xl md:text-4xl font-semibold text-white tracking-tight">
                Sign in to see your saved watchlist.
              </h2>
              <p className="text-slate-400">
                Your saved species and tracker shortcuts will appear here once you log in.
              </p>
              <button
                type="button"
                onClick={onSignIn}
                className="inline-flex items-center justify-center rounded-full border border-emerald-400/30 bg-transparent hover:bg-emerald-400/10 text-emerald-300 px-5 py-2.5 text-sm font-semibold transition-all"
              >
                Go to Sign In
              </button>
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="min-h-[60vh] rounded-[2rem] border border-dashed border-white/10 bg-slate-950/40 backdrop-blur-xl flex items-center justify-center p-8">
            <div className="max-w-xl text-center space-y-4">
              <p className="text-[10px] uppercase tracking-[0.32em] text-emerald-300/80 font-semibold">No saved species</p>
              <h2 className="text-3xl md:text-4xl font-semibold text-white tracking-tight">
                Your watchlist is empty.
              </h2>
              <p className="text-slate-400">
                Add species from the explorer or tracker to start building your saved list.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {items.map((item) => {
              const label = item.common_name || item.scientific_name;

              return (
                <article
                  key={item.id}
                  className="rounded-[1.75rem] border border-white/8 bg-slate-950/55 backdrop-blur-xl overflow-hidden shadow-[0_20px_60px_-30px_rgba(0,0,0,0.85)]"
                >
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={label}
                      className="w-full h-44 object-cover"
                    />
                  ) : (
                    <div className="h-44 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800" />
                  )}

                  <div className="p-5 space-y-4">
                    <div className="space-y-1">
                      <h3 className="text-lg font-semibold text-white leading-tight">
                        {label}
                      </h3>
                      <p className="text-sm italic text-slate-400">
                        {item.scientific_name}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {item.conservation_status && (
                        <span className="inline-flex items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-emerald-300">
                          {item.conservation_status}
                        </span>
                      )}
                      {item.conservation_status_label && (
                        <span className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                          {item.conservation_status_label}
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

                    <div className="flex items-center gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => onOpenTracker({ usageKey: item.gbif_species_key, commonName: label })}
                        className="inline-flex items-center justify-center rounded-full border border-cyan-400/30 bg-transparent hover:bg-cyan-400/10 text-cyan-300 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] transition-all"
                      >
                        Open tracker
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemove(item.gbif_species_key)}
                        disabled={removingKey === item.gbif_species_key}
                        className="inline-flex items-center justify-center rounded-full border border-red-400/20 bg-transparent hover:bg-red-500/10 text-red-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] transition-all disabled:text-slate-500"
                      >
                        {removingKey === item.gbif_species_key ? 'Removing...' : 'Remove'}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default WatchlistPage;

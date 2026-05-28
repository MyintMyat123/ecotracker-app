import React from 'react';
import type { WatchlistItem, WatchlistPayload } from '../api';
import SpeciesSearch from './SpeciesSearch';
import SpeciesTracker from './SpeciesTracker';

interface TrackerSelection {
  usageKey: number;
  commonName: string;
}

interface TrackerPageProps {
  selectedSpecies: TrackerSelection | null;
  onSelectSpecies: (species: TrackerSelection) => void;
  onBackHome: () => void;
  isAuthenticated: boolean;
  watchlist: WatchlistItem[];
  savingKey: number | null;
  removingKey: number | null;
  onAddToWatchlist: (payload: WatchlistPayload) => void;
  onRemoveFromWatchlist: (gbifSpeciesKey: number) => void;
}

const TrackerPage: React.FC<TrackerPageProps> = ({
  selectedSpecies,
  onSelectSpecies,
  onBackHome,
  isAuthenticated,
  watchlist,
  savingKey,
  removingKey,
  onAddToWatchlist,
  onRemoveFromWatchlist,
}) => {
  return (
    <div className="w-full">
      <div className="w-full flex flex-col gap-5">
        <div className="w-full px-4 sm:px-6 lg:px-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <button
            type="button"
            onClick={onBackHome}
            className="inline-flex w-fit items-center gap-2 bg-transparent border-0 p-0 text-sm font-medium text-slate-400 hover:text-white transition-colors"
          >
            <span className="text-base leading-none">←</span>
            Back to Home
          </button>

          <div className="w-full lg:max-w-sm lg:ml-auto">
            <SpeciesSearch
              isAuthenticated={isAuthenticated}
              watchlist={watchlist}
              savingKey={savingKey}
              removingKey={removingKey}
              onAddToWatchlist={onAddToWatchlist}
              onRemoveFromWatchlist={onRemoveFromWatchlist}
              onViewTracker={onSelectSpecies}
              variant="compact"
            />
          </div>
        </div>

        <main className="w-full px-4 sm:px-6 lg:px-8 space-y-6">
          {selectedSpecies ? (
            <SpeciesTracker
              usageKey={selectedSpecies.usageKey}
              commonName={selectedSpecies.commonName}
              onClose={onBackHome}
              isAuthenticated={isAuthenticated}
              isSaved={watchlist.some((item) => item.gbif_species_key === selectedSpecies.usageKey)}
              saving={savingKey === selectedSpecies.usageKey}
              removing={removingKey === selectedSpecies.usageKey}
              onAddToWatchlist={onAddToWatchlist}
              onRemoveFromWatchlist={onRemoveFromWatchlist}
            />
          ) : (
            <div className="min-h-[70vh] rounded-[2rem] border border-dashed border-white/10 bg-slate-950/40 backdrop-blur-xl flex items-center justify-center p-8">
              <div className="max-w-xl text-center space-y-4">
                <p className="text-[10px] uppercase tracking-[0.32em] text-emerald-300/80 font-semibold">Workbench Ready</p>
                <h2 className="text-3xl md:text-4xl font-semibold text-white tracking-tight">
                  Pick a species from search to open the live map.
                </h2>
                <p className="text-slate-400">
                  The tracker is built around the map first, with panels arranged around it for context.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default TrackerPage;

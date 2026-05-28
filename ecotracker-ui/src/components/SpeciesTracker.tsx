import React, { useEffect, useState } from 'react';
import type { WatchlistPayload } from '../api';
import SpeciesMap from './SpeciesMap';

interface TrackerData {
  identity: {
    usageKey: number;
    scientificName: string;
    canonicalName: string;
    family: string;
    kingdom: string;
  };
  conservation: {
    status: string;
    statusLabel: string;
    isExtinct: boolean;
  };
  trackerStats: {
    globalSightings: number;
    sightingsThisYear: number;
    countriesObserved: string[];
    lastObserved: string | null;
  };
  threats: Array<{
    type: string;
    description: string;
  }>;
  images: string[];
  mapConfig: {
    taxonKey: number;
    tileUrl: string;
  };
}

interface SpeciesTrackerProps {
  usageKey: number;
  commonName: string;
  onClose: () => void;
  isAuthenticated: boolean;
  isSaved: boolean;
  saving: boolean;
  removing: boolean;
  onAddToWatchlist: (payload: WatchlistPayload) => void;
  onRemoveFromWatchlist: (gbifSpeciesKey: number) => void;
}

const SpeciesTracker: React.FC<SpeciesTrackerProps> = ({
  usageKey,
  commonName,
  onClose,
  isAuthenticated,
  isSaved,
  saving,
  removing,
  onAddToWatchlist,
  onRemoveFromWatchlist,
}) => {
  const [data, setData] = useState<TrackerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    const fetchTrackerData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`http://localhost:8000/api/species/${usageKey}/tracker`);
        if (response.ok) {
          const result = await response.json();
          setData(result);
        } else {
          setError('Failed to initialize tracker data. The species might be missing monitoring metrics in the GBIF database.');
        }
      } catch (err) {
        console.error('Failed to fetch tracker data', err);
        setError('Network error. Please check your connection to the monitoring server.');
      } finally {
        setLoading(false);
      }
    };

    fetchTrackerData();
  }, [usageKey]);

  if (loading) {
    return (
      <div className="rounded-[2rem] p-12 border border-white/8 bg-slate-950/55 backdrop-blur-xl animate-pulse flex flex-col items-center justify-center space-y-4 min-h-[520px] shadow-[0_20px_60px_-30px_rgba(0,0,0,0.85)]">
        <div className="w-16 h-16 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-emerald-300 font-bold tracking-[0.28em] uppercase text-xs">Initializing tracker workspace</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[2rem] p-12 border border-red-500/20 bg-slate-950/55 backdrop-blur-xl flex flex-col items-center justify-center space-y-6 min-h-[320px] shadow-[0_20px_60px_-30px_rgba(0,0,0,0.85)]">
        <div className="text-red-300 text-3xl md:text-4xl font-semibold text-center">
          Tracker data unavailable
        </div>
        <p className="text-slate-400 text-center max-w-md leading-relaxed">
          {error}
        </p>
        <button
          onClick={onClose}
          className="rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white px-6 py-3 text-xs font-semibold uppercase tracking-[0.24em] transition-all"
        >
          Return to explorer
        </button>
      </div>
    );
  }

  if (!data) return null;

  const isCritical = ['CR', 'EN', 'VU'].includes(data.conservation.status);
  const watchlistPayload: WatchlistPayload = {
    gbif_species_key: usageKey,
    common_name: commonName,
    scientific_name: data.identity.scientificName,
    conservation_status: data.conservation.status,
    conservation_status_label: data.conservation.statusLabel,
    family: data.identity.family,
    kingdom: data.identity.kingdom,
    image_url: data.images[0] ?? null,
    last_observed_at: data.trackerStats.lastObserved,
  };

  const threatGroups = Object.entries(
    data.threats.reduce((acc, threat) => {
      const type = threat.type.toUpperCase();
      if (!acc[type]) acc[type] = [];
      acc[type].push(threat.description);
      return acc;
    }, {} as Record<string, string[]>)
  );

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/8 bg-slate-950/60 backdrop-blur-xl p-5 md:p-6 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.85)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`px-3.5 py-1.5 rounded-full text-[10px] font-black tracking-[0.24em] uppercase border flex items-center justify-center ${
                isCritical ? 'bg-red-500/15 text-red-300 border-red-500/20' : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20'
              }`}>
                Live tracker active
              </span>
              {data.conservation.isExtinct && (
                <span className="px-3.5 py-1.5 rounded-full text-[10px] font-black tracking-[0.24em] uppercase border bg-white/5 text-slate-400 border-white/10 flex items-center justify-center">
                  Memorial mode
                </span>
              )}
            </div>
            <div>
              <h2 className="text-3xl md:text-4xl font-semibold text-white tracking-tight">{commonName}</h2>
              <p className="text-slate-300 italic text-lg md:text-xl mt-1">
                {data.identity.scientificName}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className={`rounded-2xl border px-4 py-3 text-center min-w-[128px] ${
              isCritical ? 'bg-red-500/10 border-red-500/20' : 'bg-emerald-500/10 border-emerald-500/20'
            }`}>
              <div className={`text-4xl font-black leading-none ${isCritical ? 'text-red-300' : 'text-emerald-300'}`}>
                {data.conservation.status}
              </div>
              <div className="mt-2 text-xs font-semibold text-slate-300 leading-tight">
                {data.conservation.statusLabel}
              </div>
            </div>

            {isSaved ? (
              <button
                type="button"
                onClick={() => onRemoveFromWatchlist(usageKey)}
                disabled={removing}
                className="inline-flex items-center justify-center rounded-full border border-red-400/30 bg-transparent hover:bg-red-500/10 text-red-200 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.22em] transition-all"
              >
                {removing ? 'Removing...' : 'Remove from watchlist'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onAddToWatchlist(watchlistPayload)}
                disabled={saving}
                title={isAuthenticated ? 'Add this species to your watchlist' : 'Sign in to save species'}
                className="inline-flex items-center justify-center rounded-full border border-emerald-400/35 bg-transparent hover:bg-emerald-400/10 text-emerald-300 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.22em] transition-all"
              >
                {saving ? 'Saving...' : 'Add to watchlist'}
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
            className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 hover:bg-red-500/10 text-slate-400 hover:text-red-200 w-10 h-10 transition-all"
            aria-label="Close tracker"
            title="Close tracker"
          >
            X
            </button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.72fr)_minmax(340px,0.9fr)] gap-6 items-start">
        <div className="space-y-6">
          <div className="rounded-[2rem] border border-white/8 bg-slate-950/55 backdrop-blur-xl overflow-hidden shadow-[0_20px_60px_-30px_rgba(0,0,0,0.85)]">
            <div className="flex items-center justify-between px-5 pt-5">
              <div>
                <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500 font-semibold">Map workbench</p>
                <h3 className="text-lg font-semibold text-white mt-1">Distribution and sightings</h3>
              </div>
              <div className="text-[10px] uppercase tracking-[0.24em] text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1">
                Focus surface
              </div>
            </div>
            <div className="p-5">
              <SpeciesMap taxonKey={usageKey} scientificName={data.identity.scientificName} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-white/8 bg-slate-950/55 backdrop-blur-xl p-5">
              <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500 font-semibold">Global activity</p>
              <div className="text-3xl font-black text-white mt-3 leading-none">
                {data.trackerStats.globalSightings.toLocaleString()}
              </div>
              <p className="text-slate-500 text-[10px] uppercase tracking-[0.22em] mt-2">Observation records</p>
            </div>

            <div className="rounded-2xl border border-white/8 bg-slate-950/55 backdrop-blur-xl p-5">
              <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500 font-semibold">This year</p>
              <div className="text-3xl font-black text-emerald-300 mt-3 leading-none">
                +{data.trackerStats.sightingsThisYear}
              </div>
              <p className="text-slate-500 text-[10px] uppercase tracking-[0.22em] mt-2">Recent sightings</p>
            </div>

            <div className="rounded-2xl border border-white/8 bg-slate-950/55 backdrop-blur-xl p-5">
              <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500 font-semibold">Last spotted</p>
              <div className="text-lg font-semibold text-white mt-3 leading-tight">
                {data.trackerStats.lastObserved ? new Date(data.trackerStats.lastObserved).toLocaleDateString() : 'N/A'}
              </div>
              <p className="text-slate-500 text-[10px] uppercase tracking-[0.22em] mt-2">Latest observation</p>
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-[2rem] border border-white/8 bg-slate-950/55 backdrop-blur-xl p-5 space-y-5">
            <div>
              <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500 font-semibold">Taxonomy</p>
              <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-500 block">Kingdom</span>
                  <span className="text-white font-medium">{data.identity.kingdom || 'Unknown'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Family</span>
                  <span className="text-white font-medium">{data.identity.family || 'Unknown'}</span>
                </div>
              </div>
            </div>

            <div className="pt-5 border-t border-white/8">
              <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500 font-semibold">Distribution</p>
              <div className="text-3xl font-black text-white mt-4 leading-none">
                {data.trackerStats.countriesObserved.length}
              </div>
              <p className="text-slate-500 text-[10px] uppercase tracking-[0.22em] mt-2">Countries tracked</p>
              <div className="flex flex-wrap gap-1.5 mt-4">
                {data.trackerStats.countriesObserved.slice(0, 8).map((country) => (
                  <span
                    key={country}
                    className="px-2 py-1 rounded-lg bg-white/5 border border-white/8 text-slate-300 text-[10px] font-semibold uppercase tracking-[0.18em]"
                  >
                    {country}
                  </span>
                ))}
                {data.trackerStats.countriesObserved.length > 8 && (
                  <button
                    type="button"
                    className="text-[10px] text-cyan-300 font-semibold underline underline-offset-4 decoration-cyan-400/40 px-1 self-center"
                  >
                    +{data.trackerStats.countriesObserved.length - 8} more
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/8 bg-slate-950/55 backdrop-blur-xl p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500 font-semibold">Threat notes</p>
                <h3 className="text-lg font-semibold text-white mt-1">Conservation and risks</h3>
              </div>
              <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.24em] border flex items-center justify-center ${
                isCritical ? 'bg-red-500/15 text-red-300 border-red-500/20' : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20'
              }`}>
                Conservation
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500 font-semibold">Status summary</div>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <span className={`inline-flex items-center justify-center px-4 py-2 rounded-full text-xs font-black tracking-[0.18em] border ${
                  isCritical ? 'bg-red-500/10 text-red-200 border-red-400/20' : 'bg-emerald-500/10 text-emerald-200 border-emerald-400/20'
                }`}>
                  {data.conservation.status}
                </span>
                <span className="text-sm text-slate-300 font-medium">
                  {data.conservation.statusLabel}
                </span>
              </div>
            </div>

            {threatGroups.length > 0 ? (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {threatGroups.map(([type, descriptions]) => (
                  <div key={type} className="rounded-2xl border border-white/8 bg-white/5 p-4 flex flex-col max-h-72">
                    <div className="text-emerald-300 text-[10px] uppercase tracking-[0.24em] font-black mb-3">{type}</div>
                    <div className="space-y-3 overflow-y-auto pr-2 flex-1">
                      {descriptions.map((desc, index) => (
                        <p key={index} className="text-sm text-slate-300 leading-relaxed">
                          {desc}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-white/5 p-4 text-sm text-slate-500">
                No detailed ecological analysis available in the GBIF monitoring database for this species usageKey.
              </div>
            )}
          </div>
        </aside>
      </section>

      {data.images.length > 1 && (
        <section className="space-y-4">
          <div className="flex items-center gap-3 px-2">
            <h3 className="text-white font-semibold text-xs uppercase tracking-[0.28em]">Field evidence gallery</h3>
            <div className="h-px bg-white/10 flex-1" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {data.images.slice(1, 11).map((img, index) => (
              <div
                key={index}
                onClick={() => setSelectedImage(img)}
                className="aspect-square rounded-2xl overflow-hidden border border-white/8 hover:border-emerald-500/40 transition-all duration-300 group relative shadow-xl cursor-zoom-in bg-white/5"
              >
                <img
                  src={img}
                  alt={`${commonName} evidence ${index}`}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
              </div>
            ))}
          </div>
        </section>
      )}

      {selectedImage && (
        <div
          className="fixed inset-0 z-[9999] bg-slate-950/95 backdrop-blur-2xl flex items-center justify-center p-4 md:p-12 animate-in fade-in duration-300"
          onClick={() => setSelectedImage(null)}
        >
          <button
            className="absolute top-8 right-8 text-white/50 hover:text-red-200 text-5xl font-light transition-all hover:rotate-90 duration-300 focus:outline-none"
            onClick={() => setSelectedImage(null)}
          >
            X
          </button>

          <div className="relative max-w-5xl w-full max-h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <img
              src={selectedImage}
              alt="Enlarged monitoring evidence"
              className="max-w-full max-h-[85vh] rounded-2xl shadow-[0_0_50px_-12px_rgba(16,185,129,0.3)] border border-white/10 animate-in zoom-in-95 duration-500"
            />
            <div className="absolute -bottom-10 left-0 right-0 text-center">
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Scientific observation evidence</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SpeciesTracker;

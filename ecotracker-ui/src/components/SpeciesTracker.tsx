import React, { useEffect, useState } from 'react';
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
}

const SpeciesTracker: React.FC<SpeciesTrackerProps> = ({ usageKey, commonName, onClose }) => {
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
          setError("Failed to initialize tracker data. The species might be missing monitoring metrics in the GBIF database.");
        }
      } catch (err) {
        console.error("Failed to fetch tracker data", err);
        setError("Network error. Please check your connection to the monitoring server.");
      } finally {
        setLoading(false);
      }
    };

    fetchTrackerData();
  }, [usageKey]);

  if (loading) {
    return (
      <div className="bg-slate-900/80 backdrop-blur-md rounded-3xl p-12 border border-slate-800 animate-pulse flex flex-col items-center justify-center space-y-4 min-h-[400px]">
        <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-emerald-400 font-bold tracking-widest uppercase text-sm">Initializing Tracker Statistics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-900/80 backdrop-blur-md rounded-3xl p-12 border border-red-500/30 flex flex-col items-center justify-center space-y-6 min-h-[300px]">
        <div className="text-red-500 text-5xl font-light underline decoration-red-500/20 underline-offset-8">404 Tracker Gap</div>
        <p className="text-slate-400 text-center max-w-md leading-relaxed font-medium italic">
          {error}
        </p>
        <button 
          onClick={onClose}
          className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all"
        >
          Return to Explorer
        </button>
      </div>
    );
  }

  if (!data) return null;

  const isCritical = ['CR', 'EN', 'VU'].includes(data.conservation.status);

  return (
    <div className="animate-in fade-in zoom-in-95 duration-500 space-y-6">
      {/* Header Section */}
      <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-3xl overflow-hidden relative group shadow-2xl min-h-[350px] flex items-end p-8">
        {/* Hero Image Background */}
        {data.images.length > 0 ? (
          <div className="absolute inset-0 z-0 overflow-hidden">
            <img 
              src={data.images[0]} 
              alt={commonName}
              className="w-full h-full object-cover opacity-50 group-hover:opacity-70 transition-all duration-1000 grayscale-[0.3] group-hover:grayscale-0 scale-110 group-hover:scale-100"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent"></div>
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-transparent to-transparent"></div>
          </div>
        ) : (
          <div className="absolute inset-0 z-0 bg-gradient-to-br from-slate-800 to-slate-950 opacity-50"></div>
        )}

        <div className="absolute top-0 right-0 p-6 z-20">
           <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors text-3xl font-light focus:outline-none bg-slate-950/50 hover:bg-slate-950 w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-md border border-white/10">×</button>
        </div>
        
        <div className="flex flex-col md:flex-row md:items-end gap-6 relative z-10 w-full">
          <div className="space-y-3 flex-1">
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase border backdrop-blur-md ${
                isCritical ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
              }`}>
                Live Tracker Active
              </span>
              {data.conservation.isExtinct && (
                <span className="px-3 py-1 rounded-full bg-slate-800/80 text-slate-400 text-[10px] font-black uppercase border border-slate-700 backdrop-blur-md">
                  Memorial Mode
                </span>
              )}
            </div>
            <h2 className="text-5xl md:text-7xl font-black text-white leading-none tracking-tighter drop-shadow-2xl">
              {commonName}
            </h2>
            <p className="text-slate-300 italic text-xl font-light tracking-tight drop-shadow-lg">
              {data.identity.scientificName}
            </p>
          </div>

          <div className="text-right flex flex-col items-end">
             <div className={`text-8xl font-black tracking-tighter leading-none ${
               isCritical ? 'text-red-500 drop-shadow-[0_0_20px_rgba(239,68,68,0.6)]' : 'text-emerald-500 drop-shadow-[0_0_20px_rgba(16,185,129,0.4)]'
             }`}>
               {data.conservation.status}
             </div>
             <div className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-2 bg-slate-950/40 px-3 py-1 rounded-full border border-white/5 backdrop-blur-sm">
               {data.conservation.statusLabel}
             </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Sightings Pulse */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 space-y-4 hover:border-emerald-500/30 transition-all duration-300">
          <div className="flex justify-between items-center">
            <h3 className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Global Activity</h3>
            <div className="flex gap-1 items-end h-3">
              {[0.4, 0.7, 0.3, 0.9].map((delay, i) => (
                <div 
                  key={i} 
                  className="w-1 bg-emerald-500 rounded-full animate-pulse" 
                  style={{ 
                    height: `${Math.random() * 100}%`,
                    animationDelay: `${delay}s`,
                    animationDuration: '1s'
                  }}
                ></div>
              ))}
            </div>
          </div>
          <div className="space-y-1">
             <div className="text-4xl font-black text-white leading-none">
               {data.trackerStats.globalSightings.toLocaleString()}
             </div>
             <div className="text-slate-500 text-[10px] font-bold uppercase tracking-tight">Total Observations Records</div>
          </div>
          <div className="pt-4 border-t border-slate-800/50 flex justify-between items-end">
            <div className="space-y-1">
              <div className="text-xl font-black text-emerald-400 leading-none">+{data.trackerStats.sightingsThisYear}</div>
              <div className="text-[10px] text-slate-500 uppercase font-black">Sightings in {new Date().getFullYear()}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-slate-500 uppercase font-black mb-1">Last Spotted</div>
              <div className="text-xs font-bold text-white">
                {data.trackerStats.lastObserved ? new Date(data.trackerStats.lastObserved).toLocaleDateString() : 'N/A'}
              </div>
            </div>
          </div>
        </div>

        {/* Habitat Footprint */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 space-y-4 hover:border-cyan-500/30 transition-all duration-300">
          <h3 className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Habitat Footprint</h3>
          <div className="space-y-1">
             <div className="text-4xl font-black text-white leading-none">
               {data.trackerStats.countriesObserved.length}
             </div>
             <div className="text-slate-500 text-[10px] font-bold uppercase tracking-tight">Active Countries Tracked</div>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-4">
            {data.trackerStats.countriesObserved.slice(0, 8).map(c => (
              <span key={c} className="px-2 py-0.5 bg-slate-800 border border-slate-700 text-slate-400 text-[9px] rounded-md font-black uppercase tracking-tighter">
                {c}
              </span>
            ))}
            {data.trackerStats.countriesObserved.length > 8 && (
              <span className="text-[10px] text-slate-600 font-bold px-1 self-center">+{data.trackerStats.countriesObserved.length - 8} more</span>
            )}
          </div>
        </div>
      </div>

      {/* Ecological Insights Grid */}
      {data.threats.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Object.entries(
            data.threats.reduce((acc, t) => {
              const type = t.type.toUpperCase();
              if (!acc[type]) acc[type] = [];
              acc[type].push(t.description);
              return acc;
            }, {} as Record<string, string[]>)
          ).map(([type, descriptions]) => (
            <div 
              key={type} 
              className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 space-y-4 hover:border-emerald-500/30 transition-all duration-300"
            >
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
                <h3 className="text-emerald-400 font-black uppercase text-[10px] tracking-widest">{type}</h3>
              </div>
              <div className="space-y-4 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                {descriptions.map((desc, i) => (
                  <p key={i} className="text-[11px] text-slate-300 leading-relaxed">
                    {desc}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {data.threats.length === 0 && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 text-center italic text-slate-500 text-xs">
          No detailed ecological analysis available in the GBIF monitoring database for this species usageKey.
        </div>
      )}

      {/* Evidence Gallery Section */}
      {data.images.length > 1 && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-300">
          <div className="flex items-center gap-3 px-2">
            <h3 className="text-white font-black text-xs uppercase tracking-widest">Field Evidence Gallery</h3>
            <div className="h-px bg-slate-800 flex-1"></div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {data.images.slice(1, 11).map((img, i) => (
              <div 
                key={i} 
                onClick={() => setSelectedImage(img)}
                className="aspect-square rounded-2xl overflow-hidden border border-slate-800 hover:border-emerald-500/50 transition-all duration-500 group relative shadow-xl cursor-zoom-in"
              >
                <img 
                  src={img} 
                  alt={`${commonName} evidence ${i}`} 
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lightbox / Image Zoom Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-[9999] bg-slate-950/95 backdrop-blur-2xl flex items-center justify-center p-4 md:p-12 animate-in fade-in duration-300"
          onClick={() => setSelectedImage(null)}
        >
          <button 
            className="absolute top-8 right-8 text-white/50 hover:text-white text-5xl font-light transition-all hover:rotate-90 duration-300 focus:outline-none"
            onClick={() => setSelectedImage(null)}
          >
            ×
          </button>
          
          <div className="relative max-w-5xl w-full max-h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <img 
              src={selectedImage} 
              alt="Enlarged monitoring evidence" 
              className="max-w-full max-h-[85vh] rounded-2xl shadow-[0_0_50px_-12px_rgba(16,185,129,0.3)] border border-white/10 animate-in zoom-in-95 duration-500"
            />
            <div className="absolute -bottom-10 left-0 right-0 text-center">
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Scientific Observation Evidence</p>
            </div>
          </div>
        </div>
      )}

      {/* Map Feature */}
      <div className="relative rounded-3xl overflow-hidden border border-slate-800 group shadow-2xl">
        <div className="absolute top-6 left-6 z-[1000] space-y-1 bg-slate-900/80 backdrop-blur-xl p-4 rounded-2xl border border-slate-800 group-hover:border-emerald-500/30 transition-colors duration-500">
          <h4 className="text-white font-black text-xs uppercase tracking-widest">Interactive Range Monitor</h4>
          <p className="text-slate-400 text-[10px] font-medium leading-tight max-w-[200px]">
            Live spatial data synthesized from {data.trackerStats.globalSightings.toLocaleString()} records.
          </p>
        </div>
        <SpeciesMap taxonKey={usageKey} scientificName={data.identity.scientificName} />
      </div>
    </div>
  );
};

export default SpeciesTracker;

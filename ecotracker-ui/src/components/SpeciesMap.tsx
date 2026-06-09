import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { API_BASE_URL } from '../api';

// Fix for default marker icons (though we're using CircleMarkers now, good to keep for compatibility)
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface Occurrence {
  key: number | null;
  latitude: number;
  longitude: number;
  eventDate: string | null;
  country: string;
  locality: string;
  basisOfRecord: string;
  gbifUrl: string | null;
}

interface SpeciesMapProps {
  taxonKey: number;
  scientificName: string;
  heightClass?: string;
}

const SpeciesMap: React.FC<SpeciesMapProps> = ({ taxonKey, scientificName, heightClass = 'h-[620px] md:h-[720px]' }) => {
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOccurrence, setSelectedOccurrence] = useState<Occurrence | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showSightings, setShowSightings] = useState(true);
  const [recentOnly, setRecentOnly] = useState(false);
  const [datedOnly, setDatedOnly] = useState(false);
  const [mapStyle, setMapStyle] = useState<'dark' | 'terrain'>('dark');
  const [fitNonce, setFitNonce] = useState(0);
  const [showRecordList, setShowRecordList] = useState(false);

  useEffect(() => {
    const fetchOccurrences = async () => {
      setLoading(true);
      setSelectedOccurrence(null);
      try {
        const response = await fetch(`${API_BASE_URL}/species/${taxonKey}/occurrences?limit=100`);
        if (response.ok) {
          const data = await response.json();
          setOccurrences(data);
        }
      } catch (err) {
        console.error("Failed to fetch occurrences", err);
      } finally {
        setLoading(false);
      }
    };

    fetchOccurrences();
  }, [taxonKey]);

  const recentYearCutoff = new Date().getFullYear() - 5;
  const filteredOccurrences = useMemo(() => {
    return occurrences.filter((occ) => {
      if (datedOnly && !occ.eventDate) return false;
      if (recentOnly) {
        if (!occ.eventDate) return false;
        const year = new Date(occ.eventDate).getFullYear();
        if (!Number.isFinite(year) || year < recentYearCutoff) return false;
      }
      return true;
    });
  }, [datedOnly, occurrences, recentOnly, recentYearCutoff]);

  const countriesObserved = useMemo(() => {
    return Array.from(new Set(filteredOccurrences.map((occ) => occ.country).filter(Boolean)));
  }, [filteredOccurrences]);

  const latestOccurrence = useMemo(() => {
    return filteredOccurrences
      .filter((occ) => occ.eventDate)
      .sort((a, b) => new Date(b.eventDate as string).getTime() - new Date(a.eventDate as string).getTime())[0] ?? null;
  }, [filteredOccurrences]);

  // GBIF Tile API URL for density heatmap (using classic.poly for shaded area)
  // IMPORTANT: 'bin=hex' or 'bin=square' is required for poly-style rendering
  const gbifTileUrl = `https://api.gbif.org/v2/map/occurrence/density/{z}/{x}/{y}@1x.png?srs=EPSG:3857&taxonKey=${taxonKey}&style=classic.poly&bin=hex`;
  const tileUrl = mapStyle === 'dark'
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';

  // Helper component to fix Leaflet size issues in hidden/animated containers
  const ResizeMap = () => {
    const map = useMap();
    useEffect(() => {
      setTimeout(() => {
        map.invalidateSize();
      }, 500);
    }, [map]);
    return null;
  };

  const MapViewport = ({
    points,
    selected,
    fitVersion,
  }: {
    points: Occurrence[];
    selected: Occurrence | null;
    fitVersion: number;
  }) => {
    const map = useMap();

    useEffect(() => {
      if (!selected) return;
      map.flyTo([selected.latitude, selected.longitude], Math.max(map.getZoom(), 6), {
        duration: 0.8,
      });
    }, [map, selected]);

    useEffect(() => {
      if (points.length === 0) return;
      const bounds = L.latLngBounds(points.map((point) => [point.latitude, point.longitude]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 6 });
    }, [fitVersion, map, points]);

    return null;
  };

  const selectedKey = selectedOccurrence?.key ?? null;
  const formatDate = (value: string | null) => value ? new Date(value).toLocaleDateString() : 'Unknown';
  const controls = [
    { label: 'Heatmap', shortLabel: 'Heat', active: showHeatmap, onClick: () => setShowHeatmap((value) => !value) },
    { label: 'Sightings', shortLabel: 'Pts', active: showSightings, onClick: () => setShowSightings((value) => !value) },
    { label: 'Records from the last 5 years', shortLabel: 'Recent 5y', active: recentOnly, onClick: () => setRecentOnly((value) => !value) },
    { label: 'Only records with observation dates', shortLabel: 'Has date', active: datedOnly, onClick: () => setDatedOnly((value) => !value) },
  ];

  return (
    <div className={`${heightClass} w-full rounded-[1.75rem] overflow-hidden border border-white/8 shadow-2xl relative bg-slate-950`}>
      {loading && (
        <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm z-[1000] flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-emerald-400 font-semibold">Loading Map Data...</p>
          </div>
        </div>
      )}
      
      <div className="absolute top-4 right-4 z-[1000] pointer-events-none">
        <div className="pointer-events-auto w-[190px] rounded-xl border border-white/10 bg-slate-950/72 backdrop-blur-md p-2 shadow-xl">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-500">Map Layers</span>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.75)]" />
          </div>
          <div className="space-y-1">
            {controls.map((control) => (
              <button
                key={control.label}
                type="button"
                onClick={control.onClick}
                title={control.label}
                aria-pressed={control.active}
                className={`group flex h-8 w-full items-center justify-between rounded-lg border px-2.5 text-left transition-all ${
                  control.active
                    ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200'
                    : 'border-transparent bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-slate-200'
                }`}
              >
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em]">{control.shortLabel}</span>
                <span className={`relative h-3.5 w-6 rounded-full transition-colors ${
                  control.active ? 'bg-emerald-400/35' : 'bg-slate-700/80'
                }`}>
                  <span className={`absolute top-0.5 h-2.5 w-2.5 rounded-full transition-all ${
                    control.active ? 'left-3 bg-emerald-200' : 'left-0.5 bg-slate-400'
                  }`} />
                </span>
              </button>
            ))}
          </div>
          <div className="mt-2 border-t border-white/8 pt-2">
            <div className="mb-1.5 px-1 text-[8px] font-semibold uppercase tracking-[0.14em] text-slate-500">Basemap</div>
            <div className="grid grid-cols-2 gap-1">
              {(['dark', 'terrain'] as const).map((style) => (
                <button
                  key={style}
                  type="button"
                  onClick={() => setMapStyle(style)}
                  aria-pressed={mapStyle === style}
                  className={`flex h-7 items-center justify-center gap-1.5 rounded-lg border text-[10px] font-semibold transition-all ${
                    mapStyle === style
                      ? 'border-cyan-400/25 bg-cyan-400/10 text-cyan-200'
                      : 'border-transparent bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-slate-200'
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${mapStyle === style ? 'bg-cyan-200' : 'bg-slate-600'}`} />
                  {style === 'dark' ? 'Dark' : 'Topo'}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setFitNonce((value) => value + 1)}
              title="Fit map to visible sightings"
              className="mt-1.5 flex h-7 w-full items-center justify-center rounded-lg border border-white/8 bg-white/[0.04] text-[10px] font-semibold text-slate-300 hover:border-amber-400/20 hover:bg-amber-400/10 hover:text-amber-200 transition-all"
            >
              Fit view
            </button>
          </div>
        </div>
      </div>

      <div className="absolute left-4 right-4 bottom-4 z-[1000] pointer-events-none flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="pointer-events-auto rounded-xl border border-white/10 bg-slate-950/72 backdrop-blur-md shadow-xl overflow-hidden w-full md:w-auto">
          <div className="flex items-center divide-x divide-white/8">
            <div className="px-3.5 py-2.5 min-w-0">
              <p className="text-[8px] uppercase tracking-[0.16em] text-slate-500 font-semibold">Sightings</p>
              <p className="text-sm font-black text-white leading-none mt-1">{filteredOccurrences.length}</p>
            </div>
            <div className="px-3.5 py-2.5 min-w-0">
              <p className="text-[8px] uppercase tracking-[0.16em] text-slate-500 font-semibold">Countries</p>
              <p className="text-sm font-black text-cyan-300 leading-none mt-1">{countriesObserved.length}</p>
            </div>
            <div className="px-3.5 py-2.5 min-w-0">
              <p className="text-[8px] uppercase tracking-[0.16em] text-slate-500 font-semibold">Latest</p>
              <p className="text-[11px] font-bold text-amber-300 leading-none mt-1">{latestOccurrence ? formatDate(latestOccurrence.eventDate) : 'N/A'}</p>
            </div>
          </div>
        </div>

        {selectedOccurrence && (
          <div className="pointer-events-auto rounded-xl border border-emerald-400/20 bg-slate-950/78 backdrop-blur-md shadow-xl overflow-hidden w-full md:max-w-sm">
            <div className="px-3.5 py-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[8px] uppercase tracking-[0.18em] text-emerald-300 font-semibold">Selected Sighting</p>
                <p className="text-sm text-slate-100 font-semibold mt-1 truncate">{selectedOccurrence.locality || selectedOccurrence.country || 'Unknown locality'}</p>
                <p className="text-xs text-slate-500 mt-1">{selectedOccurrence.country || 'Unknown country'} · {formatDate(selectedOccurrence.eventDate)}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOccurrence(null)}
                className="h-8 w-8 flex-shrink-0 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                aria-label="Clear selected sighting"
              >
                x
              </button>
            </div>
          </div>
        )}

        <div className="pointer-events-auto w-full md:w-[320px]">
          <button
            type="button"
            onClick={() => setShowRecordList((value) => !value)}
            className="mb-2 ml-auto flex h-8 items-center justify-center rounded-lg border border-white/10 bg-slate-950/72 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-300 backdrop-blur-md shadow-xl hover:bg-slate-900/90"
          >
            {showRecordList ? 'Hide records' : 'Records'}
          </button>
          {showRecordList && (
            <div className="rounded-xl border border-white/10 bg-slate-950/88 backdrop-blur-md shadow-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-white/8 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500 font-semibold">GBIF Records</p>
              <p className="text-xs text-slate-300 mt-1">{filteredOccurrences.length} filtered sightings</p>
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto custom-scrollbar">
            {filteredOccurrences.slice(0, 12).map((occ) => {
              const key = occ.key ?? `${occ.latitude}-${occ.longitude}-${occ.eventDate ?? 'unknown'}`;
              const active = selectedKey === occ.key && occ.key !== null;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedOccurrence(occ)}
                  className={`w-full text-left px-4 py-3 border-b border-white/5 last:border-0 transition-colors ${
                    active ? 'bg-emerald-500/12' : 'hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-slate-200 truncate">{occ.country || 'Unknown country'}</span>
                    <span className="text-[10px] text-slate-500 flex-shrink-0">{formatDate(occ.eventDate)}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1 truncate">{occ.locality || 'Unknown locality'}</p>
                </button>
              );
            })}
            {!loading && filteredOccurrences.length === 0 && (
              <div className="px-4 py-6 text-center text-xs text-slate-500">No sightings match the active filters.</div>
            )}
          </div>
            </div>
          )}
        </div>
      </div>

      <MapContainer 
        center={[20, 0]} 
        zoom={2} 
        style={{ height: '100%', width: '100%', background: '#0f172a' }}
        scrollWheelZoom={true}
      >
        <ResizeMap />
        <MapViewport points={filteredOccurrences} selected={selectedOccurrence} fitVersion={fitNonce} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://www.gbif.org">GBIF</a>'
          url={tileUrl}
        />
        
        {/* GBIF Heatmap Layer */}
        {showHeatmap && (
          <TileLayer
            url={gbifTileUrl}
            opacity={0.8}
          />
        )}

        {/* Recent Sightings Circle Markers */}
        {showSightings && filteredOccurrences.map((occ) => {
          const active = selectedKey === occ.key && occ.key !== null;
          return (
          <CircleMarker 
            key={occ.key ?? `${occ.latitude}-${occ.longitude}-${occ.eventDate ?? 'unknown'}`} 
            center={[occ.latitude, occ.longitude]}
            radius={active ? 10 : 6}
            pathOptions={{ 
              fillColor: active ? '#10b981' : '#3b82f6', 
              color: '#ffffff', 
              weight: active ? 3 : 2, 
              fillOpacity: 0.9 
            }}
            eventHandlers={{
              click: () => setSelectedOccurrence(occ),
            }}
          >
            <Popup>
              <div className="text-slate-900 p-2 min-w-[200px]">
                <p className="font-bold text-slate-800 border-b border-slate-200 pb-2 mb-2">{scientificName}</p>
                <div className="space-y-1 text-xs">
                  <p><span className="text-slate-500">Locality:</span> <span className="font-medium">{occ.locality || 'Unknown'}</span></p>
                  <p><span className="text-slate-500">Country:</span> <span className="font-medium">{occ.country || 'Unknown'}</span></p>
                  <p><span className="text-slate-500">Date:</span> <span className="font-medium">{formatDate(occ.eventDate)}</span></p>
                  <p><span className="text-slate-500">Record:</span> <span className="font-medium">{occ.basisOfRecord.replace(/_/g, ' ')}</span></p>
                </div>
                <div className="mt-3 flex justify-between items-center">
                  <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Human Sighting</span>
                  {occ.gbifUrl && (
                    <a 
                      href={occ.gbifUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-[10px] text-emerald-600 hover:underline font-bold"
                    >
                      View on GBIF
                    </a>
                  )}
                </div>
              </div>
            </Popup>
          </CircleMarker>
        );
        })}
      </MapContainer>
    </div>
  );
};

export default SpeciesMap;

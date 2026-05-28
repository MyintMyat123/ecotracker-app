import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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
}

const SpeciesMap: React.FC<SpeciesMapProps> = ({ taxonKey, scientificName }) => {
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOccurrences = async () => {
      try {
        const response = await fetch(`http://localhost:8000/api/species/${taxonKey}/occurrences`);
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

  // GBIF Tile API URL for density heatmap (using classic.poly for shaded area)
  // IMPORTANT: 'bin=hex' or 'bin=square' is required for poly-style rendering
  const gbifTileUrl = `https://api.gbif.org/v2/map/occurrence/density/{z}/{x}/{y}@1x.png?srs=EPSG:3857&taxonKey=${taxonKey}&style=classic.poly&bin=hex`;

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

  return (
    <div className="h-[620px] md:h-[720px] w-full rounded-[1.75rem] overflow-hidden border border-white/8 shadow-2xl relative bg-slate-950">
      {loading && (
        <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm z-[1000] flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-emerald-400 font-semibold">Loading Map Data...</p>
          </div>
        </div>
      )}
      
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-slate-950/85 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300 shadow-xl flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-yellow-500/50 border border-yellow-400"></div>
          <span>Historical Range</span>
        </div>
        <div className="w-px h-3 bg-slate-700"></div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)] border border-white/50"></div>
          <span>Recent Sightings</span>
        </div>
      </div>

      <MapContainer 
        center={[20, 0]} 
        zoom={2} 
        style={{ height: '100%', width: '100%', background: '#0f172a' }}
        scrollWheelZoom={true}
      >
        <ResizeMap />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://www.gbif.org">GBIF</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        
        {/* GBIF Heatmap Layer */}
        <TileLayer
          url={gbifTileUrl}
          opacity={0.8}
        />

        {/* Recent Sightings Circle Markers */}
        {occurrences.map((occ) => (
        <CircleMarker 
            key={occ.key ?? `${occ.latitude}-${occ.longitude}-${occ.eventDate ?? 'unknown'}`} 
            center={[occ.latitude, occ.longitude]}
            radius={6}
            pathOptions={{ 
              fillColor: '#3b82f6', 
              color: '#ffffff', 
              weight: 2, 
              fillOpacity: 0.9 
            }}
          >
            <Popup>
              <div className="text-slate-900 p-2 min-w-[200px]">
                <p className="font-bold text-slate-800 border-b border-slate-200 pb-2 mb-2">{scientificName}</p>
                <div className="space-y-1 text-xs">
                  <p><span className="text-slate-500">Locality:</span> <span className="font-medium">{occ.locality || 'Unknown'}</span></p>
                  <p><span className="text-slate-500">Country:</span> <span className="font-medium">{occ.country || 'Unknown'}</span></p>
                  <p><span className="text-slate-500">Date:</span> <span className="font-medium">{occ.eventDate ? new Date(occ.eventDate).toLocaleDateString() : 'Unknown'}</span></p>
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
        ))}
      </MapContainer>
    </div>
  );
};

export default SpeciesMap;

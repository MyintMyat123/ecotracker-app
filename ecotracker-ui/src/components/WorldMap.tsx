import React, { useEffect, useState, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import type { GeoJSON as LeafletGeoJSON } from 'leaflet';
import 'leaflet/dist/leaflet.css';

const geoUrl = "https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson";

interface WorldMapProps {
  onSelectCountry: (countryName: string, countryCode: string) => void;
  selectedCountryCode: string;
}

const WorldMap: React.FC<WorldMapProps> = ({ onSelectCountry, selectedCountryCode }) => {
  const [geoData, setGeoData] = useState(null);
  const geoJsonRef = useRef<LeafletGeoJSON | null>(null);
  const selectedCodeRef = useRef(selectedCountryCode);

  // Keep the ref in sync so event handlers always read the latest value
  selectedCodeRef.current = selectedCountryCode;

  useEffect(() => {
    fetch(geoUrl)
      .then(res => res.json())
      .then(data => setGeoData(data))
      .catch(err => console.error("Error loading GeoJSON", err));
  }, []);

  // Whenever selectedCountryCode changes, re-apply styles on the existing layer
  useEffect(() => {
    if (!geoJsonRef.current) return;
    geoJsonRef.current.eachLayer((layer: any) => {
      const feature = layer.feature;
      if (!feature) return;
      const code = feature.properties?.ISO_A2 || feature.properties?.iso_a2 || '';
      const isSelected = code && code.toUpperCase() === selectedCountryCode.toUpperCase();
      layer.setStyle({
        fillColor: isSelected ? "rgb(16, 185, 129)" : "rgb(6, 182, 212)",
        weight: isSelected ? 2 : 1,
        opacity: 1,
        color: isSelected ? "rgb(52, 211, 153)" : "rgba(255, 255, 255, 0.15)",
        fillOpacity: isSelected ? 0.45 : 0.12,
      });
    });
  }, [selectedCountryCode]);

  const defaultStyle = useCallback(() => ({
    fillColor: "rgb(6, 182, 212)",
    weight: 1,
    opacity: 1,
    color: "rgba(255, 255, 255, 0.15)",
    fillOpacity: 0.12,
  }), []);

  const onEachFeature = useCallback((feature: any, layer: any) => {
    layer.on({
      click: () => {
        const code = feature.properties.ISO_A2 || feature.properties.iso_a2 || '';
        const name = feature.properties.ADMIN || feature.properties.name || 'Unknown';
        if (code && code !== '-99') {
          onSelectCountry(name, code.toUpperCase());
        }
      },
      mouseover: (e: any) => {
        const code = feature.properties?.ISO_A2 || feature.properties?.iso_a2 || '';
        const isSelected = code && code.toUpperCase() === selectedCodeRef.current.toUpperCase();
        e.target.setStyle({
          fillColor: 'rgb(16, 185, 129)',
          fillOpacity: 0.35,
          weight: isSelected ? 2.5 : 1.5,
          color: 'rgb(52, 211, 153)',
        });
      },
      mouseout: (e: any) => {
        const code = feature.properties?.ISO_A2 || feature.properties?.iso_a2 || '';
        const isSelected = code && code.toUpperCase() === selectedCodeRef.current.toUpperCase();
        e.target.setStyle({
          fillColor: isSelected ? "rgb(16, 185, 129)" : "rgb(6, 182, 212)",
          weight: isSelected ? 2 : 1,
          opacity: 1,
          color: isSelected ? "rgb(52, 211, 153)" : "rgba(255, 255, 255, 0.15)",
          fillOpacity: isSelected ? 0.45 : 0.12,
        });
      },
    });
  }, [onSelectCountry]);

  if (!geoData) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 font-medium bg-slate-950/20 backdrop-blur-sm">
        Loading World Map...
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <MapContainer
        center={[20, 0]}
        zoom={2}
        minZoom={2}
        maxBounds={[[-90, -180], [90, 180]]}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          noWrap={true}
          bounds={[[-90, -180], [90, 180]]}
        />
        <GeoJSON
          ref={geoJsonRef as any}
          data={geoData}
          style={defaultStyle}
          interactive={true}
          onEachFeature={onEachFeature}
        />
      </MapContainer>
    </div>
  );
};

export default WorldMap;

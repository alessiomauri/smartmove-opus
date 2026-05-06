'use client';

import { useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Props {
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number) => void;
}

/** Red pin icon so it stands out against the light basemap. */
function pinIcon() {
  return L.divIcon({
    className: '',
    html: `
      <div style="
        width:28px;height:28px;border-radius:50%;
        background:#e74c3c;
        border:3px solid #ffffff;
        box-shadow:0 2px 8px rgba(0,0,0,0.35);
        cursor:grab;
      "></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

/** Keep the map centred on the current coordinates when they change externally. */
function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom(), { animate: true });
  }, [lat, lng, map]);
  return null;
}

/** Click anywhere on the map to move the pin. */
function ClickHandler({ onChange }: { onChange: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onChange(
        Math.round(e.latlng.lat * 10000) / 10000,
        Math.round(e.latlng.lng * 10000) / 10000,
      );
    },
  });
  return null;
}

export default function CoordinatePicker({ lat, lng, onChange }: Props) {
  const markerRef = useRef<L.Marker | null>(null);

  const handleDragEnd = useCallback(() => {
    const marker = markerRef.current;
    if (!marker) return;
    const pos = marker.getLatLng();
    onChange(
      Math.round(pos.lat * 10000) / 10000,
      Math.round(pos.lng * 10000) / 10000,
    );
  }, [onChange]);

  return (
    <div className="rounded-lg overflow-hidden border border-gray-200">
      <MapContainer
        center={[lat, lng]}
        zoom={14}
        scrollWheelZoom={true}
        className="h-[320px] w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={19}
        />
        <RecenterMap lat={lat} lng={lng} />
        <ClickHandler onChange={onChange} />
        <Marker
          position={[lat, lng]}
          icon={pinIcon()}
          draggable={true}
          ref={markerRef}
          eventHandlers={{ dragend: handleDragEnd }}
        />
      </MapContainer>
      <div className="px-3 py-2 bg-gray-50 text-xs text-gray-500 border-t border-gray-200">
        Click anywhere or drag the pin to set coordinates
      </div>
    </div>
  );
}

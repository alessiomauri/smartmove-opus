'use client';

import { useEffect, useRef } from 'react';
import maplibregl, { Map as MlMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { buildAreasMapStyle } from '@/lib/map-style';

interface Props {
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number) => void;
}

const round4 = (n: number) => Math.round(n * 10000) / 10000;

export default function CoordinatePicker({ lat, lng, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  // Hold the latest onChange in a ref so the mount effect can run once
  // without re-creating the map every time the parent re-renders.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Mount the map once on first render.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildAreasMapStyle(),
      center: [lng, lat],
      zoom: 14,
      minZoom: 7,
      maxZoom: 14,
      attributionControl: { compact: true },
      pitchWithRotate: false,
      dragRotate: false,
    });
    map.touchZoomRotate.disableRotation();

    // Red pin — same look as the previous Leaflet divIcon (28px circle,
    // white border, soft drop shadow, grab cursor).
    const pinEl = document.createElement('div');
    pinEl.style.width = '28px';
    pinEl.style.height = '28px';
    pinEl.style.borderRadius = '50%';
    pinEl.style.background = '#e74c3c';
    pinEl.style.border = '3px solid #ffffff';
    pinEl.style.boxShadow = '0 2px 8px rgba(0,0,0,0.35)';
    pinEl.style.cursor = 'grab';

    const marker = new maplibregl.Marker({ element: pinEl, draggable: true })
      .setLngLat([lng, lat])
      .addTo(map);

    marker.on('dragend', () => {
      const p = marker.getLngLat();
      onChangeRef.current(round4(p.lat), round4(p.lng));
    });

    map.on('click', (e) => {
      onChangeRef.current(round4(e.lngLat.lat), round4(e.lngLat.lng));
    });

    mapRef.current = map;
    markerRef.current = marker;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mirror external lat/lng changes onto the map + marker.
  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;
    marker.setLngLat([lng, lat]);
    map.easeTo({ center: [lng, lat], duration: 400 });
  }, [lat, lng]);

  return (
    <div className="rounded-lg overflow-hidden border border-gray-200">
      <div ref={containerRef} className="h-[320px] w-full" />
      <div className="px-3 py-2 bg-gray-50 text-xs text-gray-500 border-t border-gray-200">
        Click anywhere or drag the pin to set coordinates
      </div>
    </div>
  );
}

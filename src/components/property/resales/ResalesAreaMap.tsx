'use client';

import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { buildAreasMapStyle } from '@/lib/map-style';

/**
 * Approximate-location map for a resales listing — the real site MapLibre +
 * Protomaps basemap (same engine/style as /areas), NOT a faux CSS map and
 * NOT Google.
 *
 * COORDINATE-FREE by construction: it is given ONLY the listing's AREA
 * centroid (areas.coordinates_lat/lng) — never the listing's own lat/long —
 * and shows a translucent gold "approximate area" circle with NO exact pin.
 * Interaction (zoom range) is clamped so it can't be zoomed to a street-level
 * inference of an exact address.
 */
function approxCirclePolygon(lng: number, lat: number, radiusKm: number, points = 72): GeoJSON.Feature {
  const ring: [number, number][] = [];
  const dxDeg = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  const dyDeg = radiusKm / 110.574;
  for (let i = 0; i <= points; i++) {
    const t = (i / points) * 2 * Math.PI;
    ring.push([lng + dxDeg * Math.cos(t), lat + dyDeg * Math.sin(t)]);
  }
  return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] }, properties: {} };
}

export default function ResalesAreaMap({ lat, lng }: { lat: number; lng: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const css = (name: string, fallback: string) => {
      const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return v || fallback;
    };
    const gold = css('--sm-gold', '#cbaa65');
    const goldDeep = css('--sm-gold-deep', '#b89653');

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildAreasMapStyle(),
      center: [lng, lat],
      zoom: 12.2,
      minZoom: 10,
      maxZoom: 13.5,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
    });
    map.touchZoomRotate.disableRotation();
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    map.on('load', () => {
      map.addSource('approx-area', { type: 'geojson', data: approxCirclePolygon(lng, lat, 1.4) });
      map.addLayer({
        id: 'approx-fill',
        type: 'fill',
        source: 'approx-area',
        paint: { 'fill-color': gold, 'fill-opacity': 0.13 },
      });
      map.addLayer({
        id: 'approx-line',
        type: 'line',
        source: 'approx-area',
        paint: { 'line-color': goldDeep, 'line-width': 1.5, 'line-dasharray': [2, 2], 'line-opacity': 0.85 },
      });
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="rs-map rs-map-live">
      <div ref={containerRef} className="rs-map-canvas" />
      <div className="note">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="10" r="3" /><path d="M12 2a8 8 0 0 0-8 8c0 5.4 8 12 8 12s8-6.6 8-12a8 8 0 0 0-8-8z" /></svg>
        Location is approximate
      </div>
    </div>
  );
}

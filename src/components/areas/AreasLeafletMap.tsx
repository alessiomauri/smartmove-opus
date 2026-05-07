'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { MapContainer, TileLayer, CircleMarker, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L, { LatLngBounds } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Area, PinCategory } from '@/types/area';

/**
 * Zoom level at and above which micro-area pins become visible. Below this,
 * only main towns + resorts + airports render — keeps the default zoomed-out
 * view calm and editorial. Default map zoom is 10, so micros stay hidden
 * until the user actively zooms in.
 */
const MICRO_REVEAL_ZOOM = 11;

interface Props {
  areas: Area[];
}

/* ───────── palette ───────── */

const PIN_PALETTE: Record<PinCategory, { fill: string; stroke: string; radius: number; weight: number }> = {
  main:    { fill: 'var(--sm-gold)', stroke: '#ffffff', radius: 10, weight: 2 },
  micro:   { fill: '#ffffff', stroke: 'var(--sm-gold)', radius: 4.5, weight: 1.75 },
  resort:  { fill: '#9a8568', stroke: '#ffffff', radius: 6.5, weight: 1.75 },
  airport: { fill: '#546d85', stroke: '#ffffff', radius: 7, weight: 2 },
};

function pinCategory(area: Area): PinCategory {
  return area.pin_category ?? (area.is_micro_location ? 'micro' : 'main');
}

/* ───────── airport icon ───────── */

function airportIcon() {
  return L.divIcon({
    className: '',
    html: `
      <div style="
        width:22px;height:22px;border-radius:50%;
        background:${PIN_PALETTE.airport.fill};
        border:2px solid #ffffff;
        box-shadow:0 1px 4px rgba(0,0,0,0.25);
        display:flex;align-items:center;justify-content:center;
      ">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>
        </svg>
      </div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -12],
  });
}

/* ───────── auto-fit ───────── */

/**
 * Fit the map to non-airport pins whenever the list changes.
 * Airport pins are transit references — they shouldn't pull the viewport east.
 */
function FitBounds({ areas }: { areas: Area[] }) {
  const map = useMap();
  // Serialise slugs so the effect only fires when the actual set of areas changes.
  const key = useMemo(() => areas.filter(a => a.pin_category !== 'airport').map(a => a.slug).join(','), [areas]);
  useEffect(() => {
    const pts = areas
      .filter(a => a.pin_category !== 'airport')
      .map(a => [a.coordinates_lat, a.coordinates_lng] as [number, number]);
    if (pts.length === 0) return;
    const bounds = new LatLngBounds(pts);
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14, animate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

/* ───────── component ───────── */

export default function AreasLeafletMap({ areas }: Props) {
  const mapRef = useRef<L.Map | null>(null);
  const defaultCenter: [number, number] = [36.55, -4.8];
  const defaultZoom = 10;
  // Tracked separately from the map instance so the legend can re-render on zoom.
  const [zoom, setZoom] = useState<number>(defaultZoom);
  const showMicros = zoom >= MICRO_REVEAL_ZOOM;

  const grouped = useMemo(() => {
    const g: Record<PinCategory, Area[]> = { micro: [], main: [], resort: [], airport: [] };
    for (const a of areas) g[pinCategory(a)].push(a);
    return g;
  }, [areas]);

  const microCount = grouped.micro.length;

  return (
    <div className="relative bg-white rounded-xl border border-ink/[0.06] overflow-hidden">
      {/* Legend */}
      <div className="absolute top-3 right-3 z-[500] bg-white/95 backdrop-blur-sm rounded-lg border border-ink/[0.06] px-3 py-2 shadow-sm pointer-events-none">
        <p className="text-[10px] font-semibold tracking-[0.1em] uppercase text-ink/60 mb-1.5">
          Costa del Sol
        </p>
        <div className="flex flex-col gap-1 text-[11px] text-ink/70">
          <LegendDot color={PIN_PALETTE.main.fill} label="Location" />
          <LegendDot color={PIN_PALETTE.micro.fill} outline={PIN_PALETTE.micro.stroke} label="Area" />
          <LegendDot color={PIN_PALETTE.resort.fill} label="Resort" />
          <LegendDot color={PIN_PALETTE.airport.fill} label="Airport" icon />
        </div>
        {!showMicros && microCount > 0 && (
          <p className="mt-2 pt-2 border-t border-ink/[0.06] text-[10px] text-ink/50 leading-snug max-w-[140px]">
            Zoom in to reveal {microCount} more areas
          </p>
        )}
      </div>

      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        scrollWheelZoom={true}
        className="h-[600px] w-full"
        ref={(m) => { mapRef.current = m; }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={19}
        />

        <FitBounds areas={areas} />
        <ZoomTracker onZoomChange={setZoom} />

        {/* Always-on: main towns + key resorts. Calm default view. */}
        {(['main', 'resort'] as const).flatMap(cat =>
          grouped[cat].map(a => (
            <CircleMarker
              key={a.slug}
              center={[a.coordinates_lat, a.coordinates_lng]}
              radius={PIN_PALETTE[cat].radius}
              pathOptions={{
                color: PIN_PALETTE[cat].stroke,
                weight: PIN_PALETTE[cat].weight,
                fillColor: PIN_PALETTE[cat].fill,
                fillOpacity: 1,
              }}
            >
              <Popup>
                <AreaPopup area={a} category={cat} />
              </Popup>
            </CircleMarker>
          ))
        )}

        {/* Zoom-gated: micro-areas only appear once the user actively zooms in. */}
        {showMicros && grouped.micro.map(a => (
          <CircleMarker
            key={a.slug}
            center={[a.coordinates_lat, a.coordinates_lng]}
            radius={PIN_PALETTE.micro.radius}
            pathOptions={{
              color: PIN_PALETTE.micro.stroke,
              weight: PIN_PALETTE.micro.weight,
              fillColor: PIN_PALETTE.micro.fill,
              fillOpacity: 1,
            }}
          >
            <Popup>
              <AreaPopup area={a} category="micro" />
            </Popup>
          </CircleMarker>
        ))}

        {grouped.airport.map(a => (
          <Marker
            key={a.slug}
            position={[a.coordinates_lat, a.coordinates_lng]}
            icon={airportIcon()}
          >
            <Popup>
              <AreaPopup area={a} category="airport" />
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      <div className="px-4 py-3 bg-paper border-t border-ink/[0.06] text-[11px] text-ink/50">
        Scroll to zoom · Drag to pan · Click a pin for details
      </div>
    </div>
  );
}

/* ───────── zoom tracker ───────── */

/**
 * Subscribes to map zoom changes and lifts the current zoom level to the
 * parent so it can decide whether to render micro-area pins. Kept tiny so
 * the parent owns the visibility logic.
 */
function ZoomTracker({ onZoomChange }: { onZoomChange: (z: number) => void }) {
  const map = useMap();
  useEffect(() => {
    onZoomChange(map.getZoom());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useMapEvents({
    zoomend: (e) => onZoomChange(e.target.getZoom()),
  });
  return null;
}

/* ───────── bits ───────── */

function LegendDot({
  color,
  outline,
  label,
  icon,
}: {
  color: string;
  outline?: string;
  label: string;
  icon?: boolean;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="inline-block rounded-full"
        style={{
          width: 10,
          height: 10,
          background: color,
          border: outline ? `2px solid ${outline}` : undefined,
          boxShadow: icon ? 'inset 0 0 0 1px white' : undefined,
        }}
      />
      {label}
    </span>
  );
}

function AreaPopup({ area, category }: { area: Area; category: PinCategory }) {
  const isAirport = category === 'airport';
  return (
    <div className="min-w-[200px] max-w-[260px]">
      {/* Hero thumbnail */}
      {area.hero_image && (
        <div className="relative w-full aspect-[16/10] rounded overflow-hidden mb-2 bg-[#f0ede9]">
          <Image
            src={area.hero_image}
            alt={area.hero_image_alt || area.name}
            fill
            className="object-cover"
            sizes="260px"
          />
        </div>
      )}
      <p className="text-[10px] font-semibold tracking-[0.1em] uppercase text-gold mb-0.5">
        {category === 'resort' && 'Resort · '}
        {category === 'airport' && 'Airport · '}
        {area.region}
        {category === 'micro' && area.parent_area && (
          <span className="text-ink/40 normal-case font-normal"> · part of {area.parent_area.replace(/-/g, ' ')}</span>
        )}
      </p>
      <p className="text-[15px] font-semibold text-ink mb-1">{area.name}</p>
      {area.price_range && (
        <p className="text-[12px] text-ink/60 mb-2">{area.price_range}</p>
      )}
      {!isAirport && (
        <Link
          href={{ pathname: '/areas/[slug]', params: { slug: area.slug } }}
          className="inline-block text-[12px] font-semibold text-gold hover:text-gold-deep transition-colors"
        >
          View area →
        </Link>
      )}
    </div>
  );
}

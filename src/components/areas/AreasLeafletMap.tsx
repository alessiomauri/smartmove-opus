'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Marker,
  Tooltip,
  Popup,
  useMap,
  useMapEvents,
} from 'react-leaflet';
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
  /**
   * Fired when any browsable pin (main / resort / micro) is clicked.
   * The parent uses this to drive the editorial rail to the right of
   * the map. Airport pins do NOT call this — they're transit-only.
   */
  onAreaSelect?: (slug: string) => void;
  /**
   * Slug of the currently selected area. The matching pin gets a
   * stronger visual treatment (larger radius, gold halo) so the
   * click-to-rail connection reads at a glance.
   */
  selectedSlug?: string | null;
}

/* ───────── palette ───────── */

const PIN_PALETTE: Record<PinCategory, { fill: string; stroke: string; radius: number; weight: number }> = {
  main:    { fill: 'var(--sm-gold)', stroke: '#ffffff', radius: 10, weight: 2 },
  micro:   { fill: '#ffffff', stroke: 'var(--sm-gold)', radius: 4.5, weight: 1.75 },
  resort:  { fill: '#9a8568', stroke: '#ffffff', radius: 6.5, weight: 1.75 },
  airport: { fill: '#546d85', stroke: '#ffffff', radius: 7, weight: 2 },
};

/** Visual delta applied when a pin is the currently selected one. */
const SELECTED_BOOST: Record<PinCategory, { radius: number; weight: number; stroke: string }> = {
  main:    { radius: 14, weight: 3, stroke: 'var(--sm-gold-deep)' },
  micro:   { radius: 7,  weight: 2.5, stroke: 'var(--sm-gold-deep)' },
  resort:  { radius: 9.5, weight: 2.5, stroke: 'var(--sm-gold-deep)' },
  airport: { radius: 7,  weight: 2, stroke: '#ffffff' }, // never highlights
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
 * Fit the map to non-airport pins whenever the visible set changes.
 * Airports are transit references and shouldn't drag the viewport east.
 */
function FitBounds({ areas }: { areas: Area[] }) {
  const map = useMap();
  const key = useMemo(
    () => areas.filter(a => a.pin_category !== 'airport').map(a => a.slug).join(','),
    [areas]
  );
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

/* ───────── flyToSelected ─────────
   When the parent updates `selectedSlug`, gently pan (no zoom change
   unless the pin is way off-screen) so the click-to-rail handoff has a
   subtle physical confirmation. */

function FlyToSelected({ areas, selectedSlug }: { areas: Area[]; selectedSlug?: string | null }) {
  const map = useMap();
  useEffect(() => {
    if (!selectedSlug) return;
    const a = areas.find(x => x.slug === selectedSlug);
    if (!a) return;
    const ll: [number, number] = [a.coordinates_lat, a.coordinates_lng];
    // Use panTo (cheap) — we keep the user's chosen zoom and just centre.
    map.panTo(ll, { animate: true, duration: 0.6 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSlug]);
  return null;
}

/* ───────── component ───────── */

export default function AreasLeafletMap({ areas, onAreaSelect, selectedSlug }: Props) {
  const mapRef = useRef<L.Map | null>(null);
  const defaultCenter: [number, number] = [36.55, -4.8];
  const defaultZoom = 10;
  const [zoom, setZoom] = useState<number>(defaultZoom);
  const showMicros = zoom >= MICRO_REVEAL_ZOOM;

  const grouped = useMemo(() => {
    const g: Record<PinCategory, Area[]> = { micro: [], main: [], resort: [], airport: [] };
    for (const a of areas) g[pinCategory(a)].push(a);
    return g;
  }, [areas]);

  // If a micro is selected but the user is below the reveal zoom, force
  // micros visible so the highlight doesn't vanish.
  const forceMicros = useMemo(() => {
    if (!selectedSlug) return false;
    const a = areas.find(x => x.slug === selectedSlug);
    return a?.pin_category === 'micro';
  }, [areas, selectedSlug]);
  const microsVisible = showMicros || forceMicros;

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
        <FlyToSelected areas={areas} selectedSlug={selectedSlug} />

        {/* Macro pins (main + resort) — always on. Clicking selects in the rail. */}
        {(['main', 'resort'] as const).flatMap(cat =>
          grouped[cat].map(a => (
            <BrowsablePin
              key={a.slug}
              area={a}
              category={cat}
              selected={selectedSlug === a.slug}
              onSelect={onAreaSelect}
            />
          ))
        )}

        {/* Micros — zoom-gated, except when one is currently selected */}
        {microsVisible && grouped.micro.map(a => (
          <BrowsablePin
            key={a.slug}
            area={a}
            category="micro"
            selected={selectedSlug === a.slug}
            onSelect={onAreaSelect}
          />
        ))}

        {/* Airport — transit only. Popup remains since it doesn't live in the rail. */}
        {grouped.airport.map(a => (
          <Marker
            key={a.slug}
            position={[a.coordinates_lat, a.coordinates_lng]}
            icon={airportIcon()}
          >
            <Popup>
              <AirportPopup area={a} />
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      <div className="px-4 py-3 bg-paper border-t border-ink/[0.06] text-[11px] text-ink/50">
        Click a pin to load it on the right · Scroll to zoom · Drag to pan
      </div>
    </div>
  );
}

/* ───────── browsable pin ─────────
   Shared marker for main + resort + micro. Uses a hover tooltip
   (lightweight name label, no photo) and on click hands the slug back
   to the parent so the rail can take over. The popup never opens —
   we deliberately suppress it so the rail is the single source of
   truth for "what am I looking at." */

function BrowsablePin({
  area,
  category,
  selected,
  onSelect,
}: {
  area: Area;
  category: PinCategory;
  selected: boolean;
  onSelect?: (slug: string) => void;
}) {
  const base = PIN_PALETTE[category];
  const boost = SELECTED_BOOST[category];
  const radius = selected ? boost.radius : base.radius;
  const weight = selected ? boost.weight : base.weight;
  const stroke = selected ? boost.stroke : base.stroke;

  return (
    <CircleMarker
      center={[area.coordinates_lat, area.coordinates_lng]}
      radius={radius}
      pathOptions={{
        color: stroke,
        weight,
        fillColor: base.fill,
        fillOpacity: 1,
        className: selected ? 'sm-pin sm-pin--selected' : 'sm-pin',
      }}
      eventHandlers={{
        click: () => onSelect?.(area.slug),
        // Hovering a circle marker briefly grows it to telegraph it's clickable.
      }}
    >
      <Tooltip direction="top" offset={[0, -2]} opacity={1} className="sm-pin-tooltip">
        <div className="sm-pin-tooltip-eyebrow">
          {category === 'resort' && 'Resort · '}
          {category === 'micro' && area.parent_area && `Part of ${area.parent_area.replace(/-/g, ' ')} · `}
          {area.region}
        </div>
        <div className="sm-pin-tooltip-name">{area.name}</div>
        <div className="sm-pin-tooltip-cta">Click to view →</div>
      </Tooltip>
    </CircleMarker>
  );
}

/* ───────── airport popup ───────── */

function AirportPopup({ area }: { area: Area }) {
  return (
    <div className="min-w-[180px]">
      <p className="text-[10px] font-semibold tracking-[0.1em] uppercase text-gold mb-0.5">
        Airport · {area.region}
      </p>
      <p className="text-[15px] font-semibold text-ink mb-1">{area.name}</p>
      {area.price_range && (
        <p className="text-[12px] text-ink/60">{area.price_range}</p>
      )}
    </div>
  );
}

/* ───────── zoom tracker ─────────
   Lifts the current zoom level to the parent so the parent can decide
   whether to render micro-area pins. */

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

/* ───────── legend dot ───────── */

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

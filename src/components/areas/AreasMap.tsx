'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl, {
  Map as MlMap,
  type GeoJSONSource,
  type LngLatBoundsLike,
  type MapLayerMouseEvent,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { buildAreasMapStyle } from '@/lib/map-style';
import { Area, PinCategory } from '@/types/area';

/**
 * Zoom level at and above which micro-area pins become visible. Below
 * this, only main towns + resorts + airports render — keeps the default
 * zoomed-out view calm and editorial. Default map zoom is 10, so micros
 * stay hidden until the user actively zooms in.
 */
const MICRO_REVEAL_ZOOM = 11;

/**
 * Feel knobs. The map should read as decisive — every transition
 * settles in under a second with a pronounced curve so the user reads
 * intent. Mouse wheel + dblclick step whole zoom levels so clients
 * can reach their target in 2–3 confident inputs; pinch stays
 * continuous and snaps to the nearest whole level on release.
 */
const FLY_DURATION = 800;
const FLY_CURVE = 1.6;
const FLY_SPEED = 1.5;

/** One whole-step zoom animation (wheel, +/-, dblclick). Settles fast
 *  with a cubic ease-out — feels assured, not floaty. */
const STEP_DURATION = 220;
const STEP_EASING = (t: number) => 1 - Math.pow(1 - t, 3);
/** How long a wheel step locks out subsequent wheel events. Tuned just
 *  above STEP_DURATION so an over-eager spin maxes out at one step per
 *  ~250ms — matches "2-3 confident clicks to target" feel. */
const STEP_LOCK_MS = 250;
/** Trackpad deltas are small floats; mouse wheels deliver ~100 per
 *  notch. Threshold below which we accumulate rather than fire. */
const WHEEL_DELTA_THRESHOLD = 6;

interface Props {
  areas: Area[];
  onAreaSelect?: (slug: string) => void;
  selectedSlug?: string | null;
}

/* ───────── palette — identical to the Leaflet build (design contract) ───────── */

const PIN_PALETTE: Record<PinCategory, { fill: string; stroke: string; radius: number; weight: number }> = {
  main:    { fill: 'var(--sm-gold)', stroke: '#ffffff', radius: 10, weight: 2 },
  micro:   { fill: '#ffffff', stroke: 'var(--sm-gold)', radius: 4.5, weight: 1.75 },
  resort:  { fill: '#9a8568', stroke: '#ffffff', radius: 6.5, weight: 1.75 },
  airport: { fill: '#546d85', stroke: '#ffffff', radius: 7, weight: 2 },
};

const SELECTED_BOOST: Record<PinCategory, { radius: number; weight: number; stroke: string }> = {
  main:    { radius: 14, weight: 3, stroke: 'var(--sm-gold-deep)' },
  micro:   { radius: 7,  weight: 2.5, stroke: 'var(--sm-gold-deep)' },
  resort:  { radius: 9.5, weight: 2.5, stroke: 'var(--sm-gold-deep)' },
  airport: { radius: 7,  weight: 2, stroke: '#ffffff' },
};

function resolveCssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function pinCategory(area: Area): PinCategory {
  return area.pin_category ?? (area.is_micro_location ? 'micro' : 'main');
}

/* ───────── component ───────── */

export default function AreasMap({ areas, onAreaSelect, selectedSlug }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const tooltipFeatureRef = useRef<string | null>(null);
  // Keep the latest onAreaSelect in a ref so the MapLibre event handlers
  // (registered once on mount) always call through to the current
  // parent-supplied callback rather than the first-render closure.
  const onSelectRef = useRef(onAreaSelect);
  useEffect(() => {
    onSelectRef.current = onAreaSelect;
  }, [onAreaSelect]);

  const [zoom, setZoom] = useState<number>(10);
  const [mapReady, setMapReady] = useState(false);

  /* ── flatten the areas into one GeoJSON FeatureCollection per category ── */
  const features = useMemo(() => {
    const out: Record<PinCategory, GeoJSON.Feature[]> = {
      main: [],
      micro: [],
      resort: [],
      airport: [],
    };
    for (const a of areas) {
      const cat = pinCategory(a);
      out[cat].push({
        type: 'Feature',
        id: a.slug,
        geometry: {
          type: 'Point',
          coordinates: [a.coordinates_lng, a.coordinates_lat],
        },
        properties: {
          slug: a.slug,
          name: a.name,
          region: a.region,
          parent_area: a.parent_area,
          pin_category: cat,
        },
      });
    }
    return out;
  }, [areas]);

  const fitKey = useMemo(
    () =>
      areas
        .filter((a) => a.pin_category !== 'airport')
        .map((a) => a.slug)
        .join(','),
    [areas],
  );

  const showMicros = zoom >= MICRO_REVEAL_ZOOM;
  const forceMicros = useMemo(() => {
    if (!selectedSlug) return false;
    const a = areas.find((x) => x.slug === selectedSlug);
    return a?.pin_category === 'micro';
  }, [areas, selectedSlug]);
  const microsVisible = showMicros || forceMicros;
  const microCount = features.micro.length;

  /* ── 1. mount the map once ──────────────────────────────────────── */
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const goldHex = resolveCssVar('--sm-gold', '#cbaa65');
    const goldDeepHex = resolveCssVar('--sm-gold-deep', '#b89653');
    const inkSoftHex = resolveCssVar('--sm-ink-soft', '#2a2723');

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildAreasMapStyle(),
      center: [-4.8, 36.55],
      zoom: 10,
      minZoom: 7,
      maxZoom: 14,
      attributionControl: { compact: true },
      pitchWithRotate: false,
      dragRotate: false,
      // Faster fade for label/icon transitions so basemap text settles
      // quickly after a flyTo — keeps the editorial feel decisive.
      fadeDuration: 150,
    });
    map.touchZoomRotate.disableRotation();

    // STAGED ZOOM ─────────────────────────────────────────────────────
    // The old Leaflet build used zoomSnap=1 — every zoom interaction
    // settled on a whole integer. MapLibre's default is a continuous
    // fractional glide, which reads as drifty and gradual. Restore the
    // discrete-step feel:
    //
    //   - Mouse wheel + trackpad: disable MapLibre's scrollZoom; we
    //     handle wheel events manually so each gesture steps exactly
    //     one zoom level per ~STEP_LOCK_MS, anchored on the cursor.
    //   - Pinch (touch): MapLibre's continuous pinch stays on — feels
    //     native — but we snap to the nearest whole zoom on touchend.
    //   - +/- buttons (NavigationControl): MapLibre default already
    //     steps by 1 zoom level per click; we leave that alone.
    //   - Double-click: MapLibre default already zooms +1; left on,
    //     duration overridden by passing a custom easeTo when needed.
    //     (Default easing is similar enough — we don't override.)
    map.scrollZoom.disable();

    let wheelAccum = 0;
    let wheelLocked = false;
    let wheelUnlockTimer: ReturnType<typeof setTimeout> | null = null;
    const canvasEl = map.getCanvas();

    const stepZoom = (direction: 1 | -1, anchor?: maplibregl.PointLike) => {
      if (wheelLocked) return;
      const current = map.getZoom();
      // Snap to the next whole level in the requested direction. If
      // we're sitting at a fractional zoom (e.g. mid-pinch), the next
      // step is the nearest integer ABOVE for +1 and BELOW for -1.
      const target =
        direction > 0 ? Math.floor(current) + 1 : Math.ceil(current) - 1;
      const minZ = map.getMinZoom();
      const maxZ = map.getMaxZoom();
      const clamped = Math.max(minZ, Math.min(maxZ, target));
      if (clamped === current) return;

      wheelLocked = true;
      if (anchor) {
        // Anchor the zoom on the cursor — natural feel.
        const lngLat = map.unproject(anchor);
        map.easeTo({
          zoom: clamped,
          around: lngLat,
          duration: STEP_DURATION,
          easing: STEP_EASING,
        });
      } else {
        map.easeTo({
          zoom: clamped,
          duration: STEP_DURATION,
          easing: STEP_EASING,
        });
      }
      if (wheelUnlockTimer) clearTimeout(wheelUnlockTimer);
      wheelUnlockTimer = setTimeout(() => {
        wheelLocked = false;
        wheelAccum = 0;
      }, STEP_LOCK_MS);
    };

    const onWheel = (e: WheelEvent) => {
      // Don't compete with the page when ctrl-wheel is being used for
      // browser zoom and the cursor is outside the map.
      e.preventDefault();
      // Mouse wheels deliver ~100 deltaY per notch (already strong
      // enough to fire immediately). Trackpads deliver tiny deltas —
      // accumulate until we cross the threshold.
      wheelAccum += e.deltaY;
      if (Math.abs(wheelAccum) < WHEEL_DELTA_THRESHOLD) return;
      const direction: 1 | -1 = wheelAccum > 0 ? -1 : 1; // up = zoom in
      // Don't immediately reset wheelAccum — the lock handles that.
      // But do clear it if it's a huge delta (mouse-wheel-style flick)
      // so we don't double-trigger on the next tick.
      wheelAccum = 0;
      const rect = canvasEl.getBoundingClientRect();
      stepZoom(direction, [e.clientX - rect.left, e.clientY - rect.top]);
    };
    canvasEl.addEventListener('wheel', onWheel, { passive: false });

    // Pinch — let it run continuously, then snap on release. We can't
    // distinguish pinch from drag in MapLibre's public event list, so
    // we listen on the canvas touchend and snap whatever zoom we
    // ended on to the nearest whole integer.
    const onTouchEnd = (e: TouchEvent) => {
      // Only snap if the gesture was a multi-touch (pinch).
      if ((e.touches?.length ?? 0) > 0) return; // still touching
      const z = map.getZoom();
      const snapped = Math.round(z);
      if (Math.abs(snapped - z) < 0.01) return; // already integer
      map.easeTo({
        zoom: snapped,
        duration: STEP_DURATION,
        easing: STEP_EASING,
      });
    };
    canvasEl.addEventListener('touchend', onTouchEnd);
    canvasEl.addEventListener('touchcancel', onTouchEnd);

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');

    map.on('load', () => {
      // GeoJSON sources — one per category. Empty initially; the next
      // effect populates them after mount.
      (['main', 'resort', 'micro', 'airport'] as PinCategory[]).forEach((cat) => {
        map.addSource(`areas-${cat}`, {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
          // promoteId pulls the slug out of properties as the canonical
          // feature id — needed for setFeatureState/click event id
          // round-tripping with non-numeric slugs.
          promoteId: 'slug',
        });
      });

      const addCircleLayers = (cat: 'main' | 'resort' | 'micro') => {
        const base = PIN_PALETTE[cat];
        const boost = SELECTED_BOOST[cat];
        const fillHex =
          cat === 'main' ? goldHex : cat === 'micro' ? '#ffffff' : base.fill;
        const strokeHex = cat === 'micro' ? goldHex : base.stroke;
        const selStrokeHex = goldDeepHex;

        // Selected halo (drawn first → sits underneath the pin).
        map.addLayer({
          id: `areas-${cat}-halo`,
          type: 'circle',
          source: `areas-${cat}`,
          paint: {
            'circle-radius': [
              'case',
              ['boolean', ['feature-state', 'selected'], false],
              boost.radius + 8,
              0,
            ],
            'circle-color': goldHex,
            'circle-opacity': 0.32,
            'circle-blur': 0.6,
          },
        });

        map.addLayer({
          id: `areas-${cat}`,
          type: 'circle',
          source: `areas-${cat}`,
          paint: {
            'circle-radius': [
              'case',
              ['boolean', ['feature-state', 'selected'], false],
              boost.radius,
              base.radius,
            ],
            'circle-color': fillHex,
            'circle-stroke-color': [
              'case',
              ['boolean', ['feature-state', 'selected'], false],
              selStrokeHex,
              strokeHex,
            ],
            'circle-stroke-width': [
              'case',
              ['boolean', ['feature-state', 'selected'], false],
              boost.weight,
              base.weight,
            ],
            'circle-pitch-alignment': 'map',
          },
        });
      };

      addCircleLayers('resort');
      addCircleLayers('main');
      addCircleLayers('micro');

      // Airport icon — painted via Canvas at DPR-aware size so the plane
      // glyph stays crisp on retina.
      const planeSize = 22;
      const dpr = window.devicePixelRatio || 1;
      const planeCanvas = document.createElement('canvas');
      planeCanvas.width = planeSize * dpr;
      planeCanvas.height = planeSize * dpr;
      const planeCtx = planeCanvas.getContext('2d');
      if (planeCtx) {
        planeCtx.scale(dpr, dpr);
        planeCtx.fillStyle = '#546d85';
        planeCtx.strokeStyle = '#ffffff';
        planeCtx.lineWidth = 2;
        planeCtx.beginPath();
        planeCtx.arc(planeSize / 2, planeSize / 2, planeSize / 2 - 1, 0, Math.PI * 2);
        planeCtx.fill();
        planeCtx.stroke();
        planeCtx.fillStyle = '#ffffff';
        planeCtx.strokeStyle = '#ffffff';
        planeCtx.lineWidth = 0.9;
        planeCtx.translate(planeSize / 2 - 6, planeSize / 2 - 6);
        const path = new Path2D(
          'M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z',
        );
        const scale = 12 / 24;
        planeCtx.scale(scale, scale);
        planeCtx.stroke(path);
        planeCtx.fill(path);
      }
      const imageData = planeCtx?.getImageData(0, 0, planeCanvas.width, planeCanvas.height);
      if (imageData) {
        map.addImage(
          'airport-icon',
          { width: planeCanvas.width, height: planeCanvas.height, data: new Uint8Array(imageData.data) },
          { pixelRatio: dpr },
        );
      }

      map.addLayer({
        id: 'areas-airport',
        type: 'symbol',
        source: 'areas-airport',
        layout: {
          'icon-image': 'airport-icon',
          'icon-allow-overlap': true,
          'icon-size': 1,
          'icon-anchor': 'center',
        },
      });

      /* ── interactivity ────────────────────────────────────────────
         All three browsable categories share the same handlers. The
         pin slug is pulled from `properties.slug` (not `e.features[0].id`)
         because promoteId makes id resolution implementation-dependent
         across MapLibre versions; `properties.slug` is always present
         because we set it explicitly when building the feature. */
      const browsableLayers = ['areas-main', 'areas-resort', 'areas-micro'];

      browsableLayers.forEach((layerId) => {
        map.on('mouseenter', layerId, () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', layerId, () => {
          map.getCanvas().style.cursor = '';
          hideTooltip();
        });
        map.on('mousemove', layerId, (e: MapLayerMouseEvent) => {
          const f = e.features?.[0];
          if (!f) return;
          const props = (f.properties ?? {}) as Record<string, unknown>;
          const slug = String(props.slug ?? '');
          if (!slug) return;
          showTooltip(slug, props, e.point);
        });
        map.on('click', layerId, (e: MapLayerMouseEvent) => {
          const f = e.features?.[0];
          if (!f) return;
          const slug = (f.properties as { slug?: string } | null)?.slug;
          if (typeof slug !== 'string' || !slug) return;
          onSelectRef.current?.(slug);
        });
      });

      // Airport — passive callout, no rail wiring.
      map.on('mouseenter', 'areas-airport', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'areas-airport', () => {
        map.getCanvas().style.cursor = '';
      });
      map.on('click', 'areas-airport', (e: MapLayerMouseEvent) => {
        const f = e.features?.[0];
        if (!f) return;
        const props = (f.properties ?? {}) as { name?: string; region?: string };
        const coords = (f.geometry as GeoJSON.Point).coordinates as [number, number];
        const html = `
          <div class="min-w-[180px]">
            <p class="text-[10px] font-semibold tracking-[0.1em] uppercase mb-0.5" style="color:${goldHex}">
              Airport · ${escapeHtml(props.region ?? '')}
            </p>
            <p class="text-[15px] font-semibold mb-1" style="color:${inkSoftHex}">${escapeHtml(props.name ?? '')}</p>
          </div>`;
        new maplibregl.Popup({ closeButton: true, closeOnClick: true, anchor: 'bottom' })
          .setLngLat(coords)
          .setHTML(html)
          .addTo(map);
      });

      const updateZoom = () => setZoom(map.getZoom());
      map.on('zoomend', updateZoom);
      updateZoom();

      setMapReady(true);
    });

    mapRef.current = map;
    if (typeof window !== 'undefined') {
      // Debug handle — lets us project pin coordinates, query rendered
      // features, and verify camera state from devtools or E2E probes.
      // Reading the map object from outside is harmless; no setters
      // mutate state without going through MapLibre's public API.
      (window as unknown as { __areasMap?: MlMap }).__areasMap = map;
    }
    return () => {
      canvasEl.removeEventListener('wheel', onWheel);
      canvasEl.removeEventListener('touchend', onTouchEnd);
      canvasEl.removeEventListener('touchcancel', onTouchEnd);
      if (wheelUnlockTimer) clearTimeout(wheelUnlockTimer);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── 2. push features into sources when areas / visibility change ── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const push = (cat: PinCategory, list: GeoJSON.Feature[]) => {
      const src = map.getSource(`areas-${cat}`) as GeoJSONSource | undefined;
      if (src) src.setData({ type: 'FeatureCollection', features: list });
    };

    push('main', features.main);
    push('resort', features.resort);
    push('micro', microsVisible ? features.micro : []);
    push('airport', features.airport);
  }, [features, microsVisible, mapReady]);

  /* ── 3. flyTo the filtered bounds when the visible set changes ──────
        Pill clicks change `mappedAreas` in the parent, which lands here
        as a new `fitKey`. Use cameraForBounds to derive the target, then
        flyTo with a pronounced curve so the camera reads decisive — not
        floaty. ──────────────────────────────────────────────────────── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const pts = areas.filter((a) => a.pin_category !== 'airport');
    if (pts.length === 0) return;
    let minLng = Infinity,
      minLat = Infinity,
      maxLng = -Infinity,
      maxLat = -Infinity;
    for (const a of pts) {
      if (a.coordinates_lng < minLng) minLng = a.coordinates_lng;
      if (a.coordinates_lng > maxLng) maxLng = a.coordinates_lng;
      if (a.coordinates_lat < minLat) minLat = a.coordinates_lat;
      if (a.coordinates_lat > maxLat) maxLat = a.coordinates_lat;
    }
    const bounds: LngLatBoundsLike = [
      [minLng, minLat],
      [maxLng, maxLat],
    ];
    const target = map.cameraForBounds(bounds, {
      padding: 50,
      maxZoom: 14,
    });
    if (target) {
      map.flyTo({
        center: target.center,
        zoom: target.zoom,
        duration: FLY_DURATION,
        curve: FLY_CURVE,
        speed: FLY_SPEED,
        essential: true,
      });
    } else {
      map.fitBounds(bounds, { padding: 50, maxZoom: 14, animate: true, duration: FLY_DURATION });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, mapReady]);

  /* ── 4. selected-pin highlight + flyTo on selection ──────────────── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    // Clear all feature-states, then set the selected one.
    (['main', 'resort', 'micro'] as PinCategory[]).forEach((cat) => {
      try {
        map.removeFeatureState({ source: `areas-${cat}` });
      } catch {
        /* older maplibre throws if no state set; ignore */
      }
    });

    if (!selectedSlug) return;
    const a = areas.find((x) => x.slug === selectedSlug);
    if (!a) return;
    const cat = pinCategory(a);
    if (cat === 'airport') return;
    map.setFeatureState(
      { source: `areas-${cat}`, id: selectedSlug },
      { selected: true },
    );
    // Decisive flyTo — short duration, pronounced curve. Centre over the
    // pin but keep the user's current zoom unless they're zoomed way
    // out, in which case nudge to 11 so the selection is legible.
    const targetZoom = Math.max(map.getZoom(), 11);
    map.flyTo({
      center: [a.coordinates_lng, a.coordinates_lat],
      zoom: targetZoom,
      duration: FLY_DURATION,
      curve: 1.4,
      speed: 1.4,
      essential: true,
    });
  }, [selectedSlug, areas, mapReady]);

  /* ── editorial tooltip — moves with the cursor, no MapLibre Popup chrome ── */
  function showTooltip(slug: string, props: Record<string, unknown>, point: { x: number; y: number }) {
    const el = tooltipRef.current;
    if (!el) return;
    el.style.left = `${point.x}px`;
    el.style.top = `${point.y - 12}px`;
    if (tooltipFeatureRef.current === slug) {
      el.style.opacity = '1';
      return;
    }
    tooltipFeatureRef.current = slug;
    const cat = props.pin_category as PinCategory;
    const region = String(props.region ?? '');
    const name = String(props.name ?? '');
    const parent = props.parent_area ? String(props.parent_area).replace(/-/g, ' ') : null;
    const eyebrow =
      cat === 'resort'
        ? `Resort · ${region}`
        : cat === 'micro' && parent
          ? `Part of ${parent} · ${region}`
          : region;
    el.innerHTML = `
      <div class="sm-pin-tooltip-eyebrow">${escapeHtml(eyebrow)}</div>
      <div class="sm-pin-tooltip-name">${escapeHtml(name)}</div>
      <div class="sm-pin-tooltip-cta">Click to view →</div>`;
    el.style.opacity = '1';
  }
  function hideTooltip() {
    const el = tooltipRef.current;
    if (!el) return;
    el.style.opacity = '0';
    tooltipFeatureRef.current = null;
  }

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

      <div
        ref={containerRef}
        className="h-[600px] w-full sm-areas-map-canvas"
        style={{ position: 'relative' }}
      />

      <div
        ref={tooltipRef}
        className="sm-pin-tooltip"
        style={{
          position: 'absolute',
          transform: 'translate(-50%, -100%)',
          opacity: 0,
          transition: 'opacity 120ms ease',
          pointerEvents: 'none',
          zIndex: 600,
        }}
      />

      <div className="px-4 py-3 bg-paper border-t border-ink/[0.06] text-[11px] text-ink/50">
        Click a pin to load it on the right · Scroll to zoom · Drag to pan
      </div>
    </div>
  );
}

/* ───────── helpers ───────── */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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

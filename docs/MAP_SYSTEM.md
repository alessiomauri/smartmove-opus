# Map System

The `/areas` page (and the admin coordinate picker) renders an interactive
map with property-area pins on top of a self-hosted vector basemap. No
third-party tile vendor, no API keys, zero per-load tile cost.

Two surfaces:
1. **Public**: `/areas` — `src/components/areas/AreasMap.tsx`, lazy-mounted
   via IntersectionObserver in `AreasIndexClient.tsx`. Pins, hover tooltip
   card, editorial rail to the right.
2. **Admin**: `/admin/areas/[slug]/edit` —
   `src/components/admin/CoordinatePicker.tsx`. Single draggable red pin
   to set `coordinates_lat` / `coordinates_lng` on an area row.

---

## Architecture

```
 [browser]                          [Cloudflare edge]                [R2]
 ─────────                          ────────────────                 ────
 MapLibre GL JS ──── /{archive}/{z}/{x}/{y}.mvt ──────►  Worker  ──► PMTiles file
                                                     smartmove-map-tiles    costa-del-sol.pmtiles
                                                     (range reads + cache)
                ◄──────── application/vnd.mapbox-vector-tile ──────────
                          (Content-Encoding: gzip, immutable, max-age 86400)

  + glyphs + sprite: https://protomaps.github.io/basemaps-assets
    (public Protomaps CDN — no key, CORS open, static)
```

- **`maplibre-gl@^5`** is the render engine (vector tiles, smooth zoom,
  retina-crisp). Lazy-imported via `next/dynamic({ ssr: false })`.
- **`@protomaps/basemaps@^5`** provides the canonical Protomaps `LIGHT`
  flavor and the `layers()` generator used by the style.
- **`workers/protomaps-tiles/`** is the Cloudflare Worker that
  range-reads our `costa-del-sol.pmtiles` from R2 and serves individual
  `.mvt` tiles. Range reads come from `pmtiles@^4` via a custom R2
  `Source` adapter. Successful tiles are written to `caches.default` so
  subsequent hits skip the R2 round-trip entirely.
- **R2 bucket**: `smartmove-map-tiles`, single object
  `costa-del-sol.pmtiles` (currently ~16 MB).
- **Worker URL**: `https://smartmove-map-tiles.alessio-mauri030702.workers.dev`
  (pending custom domain — see TODOs).

### What's deployed where

| Thing | Location | How to update |
|---|---|---|
| Vector tile data | R2: `smartmove-map-tiles/costa-del-sol.pmtiles` | Regenerate + reupload (see below) |
| Tile-serving worker | `workers/protomaps-tiles/` | `cd workers/protomaps-tiles && npx wrangler deploy` |
| Style / palette | `src/lib/map-style.ts` | Edit file; `npm run build` |
| Map component | `src/components/areas/AreasMap.tsx` | Edit file; HMR picks it up |
| Glyphs (text labels) | `protomaps.github.io/basemaps-assets/fonts` | n/a — hot-linked, public |
| Sprite (icons) | `protomaps.github.io/basemaps-assets/sprites/v4/light` | n/a — hot-linked, public |

---

## Regenerating the basemap

The PMTiles file in R2 is a slice of the Protomaps daily planet build
clipped to Costa del Sol. Refresh it when you want the latest OSM data
(monthly is plenty — the basemap is editorial, not navigational).

**Bbox used**: `-5.55, 36.20, -4.20, 36.85` — Sotogrande/Tarifa in the
west out to Málaga centro in the east, with ~0.2° pad. **Max zoom**: 14
(plenty for property-area density; bigger maxzoom inflates file size
quickly).

```bash
# 1. Install pmtiles CLI if missing (Darwin arm64 example).
# Latest releases: https://github.com/protomaps/go-pmtiles/releases
curl -sL -o /tmp/pmtiles.zip \
  https://github.com/protomaps/go-pmtiles/releases/download/v1.30.3/go-pmtiles-1.30.3_Darwin_arm64.zip
unzip -o /tmp/pmtiles.zip -d /tmp/pmtiles-bin
/tmp/pmtiles-bin/pmtiles version

# 2. Extract today's slice. Range-reads the planet pmtiles (~136 GB)
#    over HTTP — total transfer is ~17 MB (only the bbox you need).
/tmp/pmtiles-bin/pmtiles extract \
  "https://build.protomaps.com/$(date -u +%Y%m%d).pmtiles" \
  ./costa-del-sol.pmtiles \
  --bbox=-5.55,36.20,-4.20,36.85 \
  --maxzoom=14

# 3. Upload to R2 (note --remote; without it wrangler writes to the
#    local emulator).
cd <repo>
npx wrangler r2 object put \
  smartmove-map-tiles/costa-del-sol.pmtiles \
  --file=./costa-del-sol.pmtiles \
  --content-type=application/octet-stream \
  --remote
```

**Cache busting after a refresh**: tiles are served with
`Cache-Control: public, max-age=86400, immutable`, so the edge will keep
serving the old data for up to 24h. To force a swap on the client side,
pass a `cacheBust` to `buildAreasMapStyle({ cacheBust: '2026-06-10' })`
in `src/lib/map-style.ts` — it appends `?v=…` to the tile URL, which
changes the cache key. Bump the value, redeploy the Next app, done.

**Sanity-check the worker after a refresh**:

```bash
curl -sI \
  "https://smartmove-map-tiles.alessio-mauri030702.workers.dev/costa-del-sol/12/1992/1601.mvt" \
  | head -5
# Expected: HTTP/2 200, content-type: application/vnd.mapbox-vector-tile
# A 204 means the tile is empty (sea/no data) — normal away from land.
# A 500 means the worker can't decode the archive — check R2 upload.
```

---

## Style

Everything visual lives in **`src/lib/map-style.ts`**. The file exports
one function:

```ts
buildAreasMapStyle({ cacheBust?: string }): StyleSpecification
```

…which returns a MapLibre style JSON ready for `new maplibregl.Map({ style })`.

### How the palette maps to design tokens

The style is built from the Protomaps `LIGHT` flavor (74 colour tokens)
with surgical overrides. Each override pulls a colour from the site's
editorial palette in `src/app/globals.css`:

| Style flavor key | Hex | Site token | What it draws |
|---|---|---|---|
| `background`, `earth` | `#f7f3ec` | `--sm-paper` | Land + map background |
| `water`, `ocean_label` | `#b8cdd3` / `#5d7984` | hand-picked muted teal | Sea |
| `buildings`, `pedestrian` | `#efe9df` | `--sm-cream` | Building footprints |
| road `*_casing`, `boundaries` | `#dfd6c4` | `--sm-line` | Hairline strokes |
| `highway`, `highway_casing_early` | `#fff9ea` / `#cbaa65` | `--sm-gold` | Major roads (gold spine) |
| `city_label`, `country_label` | `#1c1a17` | `--sm-ink` | Headline labels |
| `subplace_label`, `state_label`, `roads_label_major` | `#5a544a` / `#2a2723` | `--sm-ink-soft` adjacent | Body labels |
| label `*_halo` | `#f7f3ec` | `--sm-paper` | Halo behind labels (warm, not white) |
| `pois` (all 8 kinds) | `#9c8e7a` | warm grey | POIs — desaturated so gold pins stay loudest |

### How to safely tweak the basemap

- **Change a single colour**: edit the `editorialFlavor` object in
  `src/lib/map-style.ts`. Keys not overridden inherit `LIGHT` defaults,
  so you don't have to maintain the full 74-token palette.
- **Change labels' language**: the `layers('protomaps', flavor, { lang: 'en' })`
  call sets English. Other supported langs come from
  `@protomaps/basemaps`. Don't try to tweak label-text expressions
  directly — let the upstream theme handle it.
- **Adjust which OSM features render**: each entry of
  `protomapsLayers(...)` is a MapLibre layer spec. You can filter the
  array before returning it (e.g. drop a layer by id) but try not to
  rewrite paint expressions in place — the theme is regenerated upstream
  and re-pinning will fight any custom expressions.

`buildAreasMapStyle` is used by **both** `AreasMap` (public) and
`CoordinatePicker` (admin) — there's only one basemap to maintain.

---

## Staged zoom

The map zooms in **discrete whole steps** to match the old Leaflet
build's `zoomSnap: 1` feel. MapLibre's continuous fractional zoom is
disabled in favour of a custom wheel handler.

Constants live at the top of **`src/components/areas/AreasMap.tsx`** —
this is the only file to touch if you want to retune the feel:

```ts
const FLY_DURATION       = 800;   // pill/pin-triggered flyTo
const FLY_CURVE          = 1.6;   // higher = more dramatic arc
const FLY_SPEED          = 1.5;
const STEP_DURATION      = 220;   // one wheel/dblclick step animation
const STEP_EASING        = (t) => 1 - Math.pow(1 - t, 3);  // cubic ease-out
const STEP_LOCK_MS       = 250;   // min interval between wheel steps
const WHEEL_DELTA_THRESHOLD = 6;  // trackpad accumulator threshold
```

What handles what:

| Input | Behaviour |
|---|---|
| Mouse wheel notch | One whole zoom level per gesture; cursor-anchored via `easeTo({ around: cursorLngLat })`; locked for `STEP_LOCK_MS` after each step |
| Trackpad small deltas | Accumulated until \|sum\| ≥ `WHEEL_DELTA_THRESHOLD`, then a single step fires |
| Double-click | MapLibre's default `doubleClickZoom` (+1); kept on |
| +/- buttons (`NavigationControl`) | MapLibre default; each click is `zoomTo(z ± 1)`, settles on integer |
| Pinch (touch) | MapLibre's `touchZoomRotate` runs continuous; on `touchend` we snap to `Math.round(zoom)` with `STEP_DURATION` ease |

Default scrollZoom is explicitly disabled via `map.scrollZoom.disable()`
— the wheel handler is installed directly on the canvas with
`{ passive: false }` so `preventDefault()` works. Cleanup tears down the
listeners on unmount.

**If the feel needs retuning, ONLY touch the constants above.** Don't
re-enable MapLibre's scrollZoom — the continuous glide is exactly what
this implementation replaces.

---

## Rail state machine

The rail to the right of the map has three modes. The state is owned
entirely by **`src/app/[locale]/areas/AreasIndexClient.tsx`** — two
useState atoms drive everything:

```ts
const [activeCluster, setActiveCluster] = useState<string>('all');
const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
```

Derived mode:

```
railArea           → AREA mode      (a pin was clicked)
activeClusterDef   → REGION mode    (a pill is active, no pin)
neither            → OVERVIEW mode  (default Costa del Sol)
```

### Triggers

| Action | What changes | Resulting mode |
|---|---|---|
| Click a region pill (Marbella, Benahavís, …) | `setActiveCluster(c.key); setSelectedSlug(null)` | REGION |
| Click the "All" pill | `setActiveCluster('all'); setSelectedSlug(null)` | OVERVIEW |
| Click a browsable pin (`main` / `resort` / `micro`) | `setSelectedSlug(slug)`; `activeCluster` untouched | AREA |
| Click "Back" from AREA | `setSelectedSlug(null)` | If a pill is active → REGION; else OVERVIEW |
| Click "Back" from REGION | `setActiveCluster('all')` | OVERVIEW |

### Back-navigation contract

The AREA-mode back button is **dynamic**:

```tsx
← Back to {activeClusterDef ? activeClusterDef.label : 'overview'}
```

So clicking Marbella pill → Nueva Andalucía pin → back returns to the
Marbella region state, not Costa del Sol. This is by design — the user's
"current scope" is the region they picked, not the global default.

### `pin_category` contract — DO NOT touch in the renderer

`AreasMap.tsx` renders strictly per `area.pin_category` from the DB:

- `main` → filled gold disc, 10 px
- `micro` → white disc with gold outline, 4.5 px (zoom ≥ 11 to render)
- `resort` → taupe filled disc, 6.5 px
- `airport` → blue disc + plane glyph (excluded from clustering, fit
  bounds, and the directory)

**Nesting lives in DATA, never in the renderer.** Some "child" areas
(Marbella East, Nueva Andalucía) have `parent_area: 'marbella'` but
`pin_category: 'main'` — meaning the editorial team chose to render them
as first-class main pins despite being nested in the data hierarchy.
**Never special-case area slugs in the renderer.** If you find yourself
writing `if (slug === 'nueva-andalucia')` in `AreasMap.tsx`, you're
fighting the data — fix the `pin_category` row instead.

The tooltip eyebrow is the only place that reads `parent_area`, and only
for the `micro` category (so micros read "Part of {parent} · {region}"):

```ts
cat === 'resort'           ? `Resort · ${region}`
: cat === 'micro' && parent ? `Part of ${parent} · ${region}`
: region;
```

---

## Region photos

Region-mode rail needs a photo, but the `Area` DB row has no
region-level photo field yet. As a temporary fallback the cluster
definition in `AreasIndexClient.tsx` carries a `flagshipSlug` — the
slug of the area whose `hero_image` represents that cluster:

| Cluster | Flagship slug | Why |
|---|---|---|
| `marbella` | `marbella` | The cluster's namesake area |
| `benahavis` | `la-zagaleta` | The iconic estate that defines the cluster |
| `estepona` | `estepona` | The cluster's namesake area |
| `western` | `sotogrande` | The polo capital, the cluster's headline |
| `mijas-east` | `mijas` | The cluster's namesake area |

If a cluster's flagship has no `hero_image`, the fallback is "first area
in the cluster with any hero." If still none, fall back to Marbella
overview.

**Admin TODO** (see below): wire a `region_photo_url` field per cluster
so editorial can swap these without touching code.

---

## Known TODOs

- **Custom domain for the tile worker**: serving from
  `smartmove-map-tiles.alessio-mauri030702.workers.dev` while the
  production domain story is settled. Once the SmartMove `.com` zone is
  on Cloudflare, add a route in `workers/protomaps-tiles/wrangler.toml`
  (e.g. `tiles.smartmove.com/*`) and update `TILES_WORKER_BASE` in
  `src/lib/map-style.ts`. Edge cache is unaffected.
- **Region photo field in admin** (Prompt 5): add a `Cluster` table
  (or just `cluster_photo` columns on a separate `region_photos` table)
  so the photo + tagline + blurb in REGION mode are editable without a
  code push. Replace the `flagshipSlug` fallback once shipped.
- **`pin_category` not editable in admin** (`AreaForm.tsx`): the field
  exists on `Area` rows and drives every pin's visual treatment, but
  the admin form has no select for it — changes require a manual SQL
  UPDATE. When the form gets a `pin_category` select, the four allowed
  values are exported as `PIN_CATEGORIES` from `src/types/area.ts`.
- **Property-detail mini-map**: not built. Single-property pages
  (`/property/[slug]`) currently embed a Google Maps iframe in
  `LocationSection.tsx`. If/when we want a native mini-map, follow the
  `CoordinatePicker` pattern (small MapLibre with one pin, no
  interactivity besides pan).

---

## Debugging

The map instance is exposed on `window.__areasMap` (read-only handle,
public API only) so devtools probes and E2E tests can:

```js
window.__areasMap.getZoom();
window.__areasMap.getCenter();
window.__areasMap.project([-4.8857, 36.5099]);          // lngLat → pixel
window.__areasMap.queryRenderedFeatures([x, y], { layers: ['areas-main'] });
```

Layer ids: `areas-main`, `areas-resort`, `areas-micro`,
`areas-airport`, plus `areas-{cat}-halo` for the selected-pin halo.
Source ids match (one source per category, `promoteId: 'slug'`).

For a fresh perspective: a clean repo + this doc should be enough to
re-tune the zoom feel (touch the constants), restyle the basemap (edit
`editorialFlavor` in `map-style.ts`), or debug the rail (the state
machine table above is the contract).

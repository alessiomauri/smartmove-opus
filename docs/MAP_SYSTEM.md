# Map System

Interactive Leaflet maps used in two places:
1. **Public**: `/areas` — interactive map with all areas as colour-coded pins, region zoom buttons, and image popups
2. **Admin**: `/admin/areas/[slug]/edit` — `CoordinatePicker` with a single draggable pin to set area coordinates

---

## Tech Stack

| Tech | Why |
|---|---|
| `leaflet@1.9.4` | Mature open-source map library, no API key |
| `react-leaflet@5.0.0` | Idiomatic React bindings |
| **CartoDB Positron** tiles | Free, no API key, minimal monochrome aesthetic that lets the pins shine |

Tile URL: `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png` — subdomains `abcd`, max zoom 19.

Attribution: `© OpenStreetMap contributors © CARTO`.

---

## Bundle Strategy

Leaflet + react-leaflet weigh ~600 KB combined. They're loaded **only on routes that need them**:

```tsx
// src/app/areas/AreasIndexClient.tsx
const AreasLeafletMap = lazy(() => import('@/components/areas/AreasLeafletMap'));

<Suspense fallback={<MapPlaceholder />}>
  <AreasLeafletMap areas={mapAreas} />
</Suspense>
```

`React.lazy` (not `next/dynamic`) is used because we want the map to be a normal `'use client'` lazy chunk; we don't need `next/dynamic`'s SSR controls (the map is always client-rendered).

The `CoordinatePicker` (admin) imports react-leaflet directly because it lives in admin-only routes that aren't user-facing.

---

## Pin Palette (`PIN_PALETTE`)

Defined in `src/components/areas/AreasLeafletMap.tsx`:

```ts
const PIN_PALETTE: Record<PinCategory, { fill, stroke, radius, weight }> = {
  main:    { fill: '#3c9ba7', stroke: '#ffffff', radius: 10,  weight: 2 },
  micro:   { fill: '#ffffff', stroke: '#3c9ba7', radius: 4.5, weight: 1.75 },
  resort:  { fill: '#9a8568', stroke: '#ffffff', radius: 6.5, weight: 1.75 },
  airport: { fill: '#546d85', stroke: '#ffffff', radius: 7,   weight: 2 },
};
```

| Category | Visual | Meaning |
|---|---|---|
| `main` | Filled teal disc, white outline, ~10px | Headline towns and major areas |
| `micro` | White disc, teal outline, ~4.5px | Neighbourhoods / urbanisations |
| `resort` | Filled taupe disc, white outline, ~6.5px | Specific resort complexes (Puente Romano, La Zagaleta, etc.) |
| `airport` | Slate disc with white plane SVG, 22px | Transit reference (Malaga). Excluded from grid + bounds. |

Pins are rendered as `<CircleMarker>` (SVG) for main/micro/resort, and as a `<Marker>` with a custom `L.divIcon` (HTML) for the airport.

---

## Render order

Pins are rendered in three layers so smaller pins don't get covered by larger ones:

```tsx
{(['micro', 'main', 'resort'] as const).flatMap(cat =>
  grouped[cat].map(a => <CircleMarker … />)
)}
{grouped.airport.map(a => <Marker icon={airportIcon()} … />)}
```

`micro` paints first (under main + resort), then `main`, then `resort`, finally airport on top.

---

## Popups

Each pin gets a `<Popup>` showing:
- Area name (Gloock font, teal)
- Area heading or subheading (smaller grey)
- Hero image thumbnail (when available, via `next/image`, 240×140)
- "View area →" link to `/areas/[slug]`

Implementation in `AreasLeafletMap.tsx` — popup content is JSX, react-leaflet renders it into Leaflet's popup container.

---

## FitBounds

The map auto-frames its visible pins on first render via the `<FitBounds>` helper component:

```tsx
function FitBounds({ areas }: { areas: Area[] }) {
  const map = useMap();
  useEffect(() => {
    const visible = areas.filter(a => pinCategory(a) !== 'airport');
    if (visible.length === 0) return;
    const bounds = L.latLngBounds(visible.map(a => [a.coordinates_lat, a.coordinates_lng]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
  }, [areas, map]);
  return null;
}
```

The airport is excluded because Malaga Airport is east of most properties and would skew the framing.

---

## Macro-Region Filter Buttons

Above the map (in `AreasIndexClient`), 5 region pills:
- All areas (default)
- Marbella region
- Benahavís region
- Estepona region
- Western Coast (Casares + Manilva + Sotogrande + San Roque)
- Mijas & East (Mijas + Fuengirola + Torremolinos + Malaga)

Clicking a pill filters which areas are passed into `<AreasLeafletMap>`, which triggers `<FitBounds>` to re-frame.

---

## Legend

Top-right of the map, glass panel showing the four pin categories (`Location`, `Area`, `Resort`, `Airport`). Implementation: a `<LegendDot>` subcomponent renders a small inline SVG matching the palette.

The legend is positioned `top-3 right-3` to avoid clashing with Leaflet's default zoom controls (which sit `top-left`).

---

## Coordinate Picker (Admin)

`src/components/admin/CoordinatePicker.tsx`:

- Single `<MapContainer>` with same CartoDB tiles
- One draggable `<Marker>` representing the current area's coords
- `useMapEvents` hook captures click events to relocate the marker
- On drag end / click, calls `onChange(lat, lng)` to update the parent form
- Defaults to `[36.5100, -4.8860]` (central Marbella) when no coords set

Used in `AreaForm.tsx` to set `coordinates_lat` + `coordinates_lng`.

---

## Property Detail Page Mini-Map

`src/components/property/LocationSection.tsx` shows a static map preview for the property's lat/lng. **It does not currently use Leaflet** — it's a simple display with neighbourhood blurb. (Future enhancement: embed a small leaflet map here, lazy-loaded.)

---

## Common Issues

### Hydration mismatch
react-leaflet's `<MapContainer>` doesn't render on the server. We sidestep this by `lazy()`-importing the whole map component and wrapping with `<Suspense>`. Don't import `react-leaflet` synchronously at the top of a non-lazy module.

### Marker icons missing
Default Leaflet markers use image URLs that 404 in webpack/Turbopack. We avoid this by using `<CircleMarker>` (pure SVG) for most pins and `L.divIcon` (HTML) for the airport — neither needs Leaflet's default icon assets.

### Tile blanks on first load
First map render fetches tiles asynchronously. The skeleton in `MapPlaceholder` covers it. If you see persistent blanks, check `next.config.ts` doesn't restrict `basemaps.cartocdn.com`.

---

## Recreating the Map

1. `npm install leaflet react-leaflet @types/leaflet`
2. Copy `src/components/areas/AreasLeafletMap.tsx` (palette, popups, fit bounds, legend)
3. Copy `src/components/admin/CoordinatePicker.tsx` if you need admin coord editing
4. Use `lazy()` to import the map in any client component that renders it
5. Make sure your area data has `coordinates_lat`, `coordinates_lng`, `pin_category`, and optionally `hero_image` for popups

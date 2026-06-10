/**
 * MapLibre style builder for the SmartMove basemap.
 *
 * Seeded from the Protomaps `LIGHT` flavor and re-tinted to the site's
 * editorial design tokens (warm paper, cream surfaces, deep ink labels,
 * gold accents). Labels are forced to English via the @protomaps/basemaps
 * `lang: 'en'` option, which maps to `coalesce(name:en, name)` per layer.
 *
 * The tile source points at the Cloudflare Worker that range-reads our
 * self-hosted PMTiles archive in R2. Sprite + glyph PBFs are fetched
 * from the public Protomaps assets bucket (open-source, CORS-enabled,
 * no rate limit, no API key) — keeps us off any commercial tile vendor
 * while not paying egress for static font/icon assets we don't change.
 */
import { LIGHT, layers as protomapsLayers, type Flavor } from '@protomaps/basemaps';
import type { StyleSpecification } from 'maplibre-gl';

/**
 * Cloudflare Worker that serves /{archive}/{z}/{x}/{y}.mvt tiles by
 * range-reading the PMTiles file in R2. Hard-coded — same worker URL
 * across all environments (the archive name in the path is the actual
 * cache key).
 */
const TILES_WORKER_BASE = 'https://smartmove-map-tiles.alessio-mauri030702.workers.dev';
const ARCHIVE = 'costa-del-sol';

/** Static asset CDN for sprite + glyph PBFs. */
const PROTOMAPS_ASSETS = 'https://protomaps.github.io/basemaps-assets';

/**
 * Editorial flavor — Protomaps LIGHT, re-coloured to the site's tokens.
 * Only the tokens that materially shift the look are overridden; the
 * rest inherit LIGHT defaults so we don't have to maintain a full
 * 74-token palette by hand.
 *
 * Token mapping:
 *   sm-paper      #f7f3ec  → background, earth, beach
 *   sm-cream      #efe9df  → buildings, pedestrian
 *   sm-line       #dfd6c4  → road casings, boundaries, building stroke
 *   sm-ink-soft   #2a2723  → city/state/country labels
 *   sm-ink        #1c1a17  → headline labels
 *   sm-gold-deep  #b89653  → highway fill (subtle warm thread)
 *   muted teal    #b8cdd3  → water — calmer than the default cyan,
 *                            echoes the hero coastline glyph tone
 */
const editorialFlavor: Flavor = {
  ...LIGHT,

  background: '#f7f3ec',
  earth: '#f7f3ec',

  // Greenery — desaturated so it reads as texture, not colour. Keeps the
  // map quiet enough that the gold pins pop.
  park_a: '#e7eadd',
  park_b: '#c8d3b8',
  wood_a: '#e3e7d6',
  wood_b: '#c0cdab',
  scrub_a: '#e7eadc',
  scrub_b: '#c8d3b6',
  beach: '#f0e9d3',
  sand: '#ede5cd',

  // Water — muted teal/slate. Echoes the hero coastline glyph
  // (rgba(74,108,128, .7)) but lightened so the basemap reads as warm
  // paper, not nautical.
  water: '#b8cdd3',
  ocean_label: '#5d7984',

  // Buildings — cream with a hairline stroke (added via the layer
  // override below since the flavor model only carries fill).
  buildings: '#efe9df',
  hospital: '#efe9df',
  industrial: '#e8e2d5',
  school: '#efe9df',
  zoo: '#e3eadf',
  military: '#e8e3d5',
  aerodrome: '#ece6d6',
  runway: '#f3eee0',
  pedestrian: '#efe9df',
  pier: '#dfd6c4',
  glacier: '#f0eee8',

  // Roads — white surface with cream/line casings. Hierarchy preserved:
  // major and highway slightly warmer to read as the spine of the
  // network, minor and other reduced to whisper.
  other: '#f9f6ee',
  minor_service: '#f9f6ee',
  minor_service_casing: '#dfd6c4',
  minor_a: '#fbf8f1',
  minor_b: '#ffffff',
  minor_casing: '#dfd6c4',
  link: '#ffffff',
  link_casing: '#dfd6c4',
  major: '#ffffff',
  major_casing_early: '#dfd6c4',
  major_casing_late: '#dfd6c4',
  highway: '#fff9ea',
  highway_casing_early: '#cbaa65',
  highway_casing_late: '#dfd6c4',
  bridges_other: '#f9f6ee',
  bridges_other_casing: '#dfd6c4',
  bridges_minor: '#ffffff',
  bridges_minor_casing: '#dfd6c4',
  bridges_link: '#ffffff',
  bridges_link_casing: '#dfd6c4',
  bridges_major: '#ffffff',
  bridges_major_casing: '#dfd6c4',
  bridges_highway: '#fff9ea',
  bridges_highway_casing: '#cbaa65',
  tunnel_other: '#efe9df',
  tunnel_minor: '#efe9df',
  tunnel_link: '#efe9df',
  tunnel_major: '#efe9df',
  tunnel_highway: '#efe9df',
  tunnel_other_casing: '#dfd6c4',
  tunnel_minor_casing: '#dfd6c4',
  tunnel_link_casing: '#dfd6c4',
  tunnel_major_casing: '#dfd6c4',
  tunnel_highway_casing: '#dfd6c4',

  railway: '#9aa39c',
  boundaries: '#cbaa65',

  // Labels — deep ink so they read off the paper background. Halos
  // tinted slightly warm (paper, not white) so labels don't punch holes
  // in the page.
  roads_label_minor: '#9c8e7a',
  roads_label_major: '#2a2723',
  roads_label_major_halo: '#f7f3ec',
  subplace_label: '#5a544a',
  subplace_label_halo: '#f7f3ec',
  city_label: '#1c1a17',
  city_label_halo: '#f7f3ec',
  state_label: '#5a544a',
  state_label_halo: '#f7f3ec',
  country_label: '#1c1a17',
  address_label: '#9c8e7a',
  address_label_halo: '#f7f3ec',

  // POIs are colour-coded per category — desaturate them to a single
  // warm tone so the design's gold pins stay the loudest thing on the
  // map. Keeping the original shape (per-key colours) so the protomaps
  // theme renderer can still target individual POI kinds.
  pois: {
    blue: '#9c8e7a',
    green: '#9c8e7a',
    lapis: '#9c8e7a',
    pink: '#9c8e7a',
    red: '#9c8e7a',
    slategray: '#9c8e7a',
    tangerine: '#9c8e7a',
    turquoise: '#9c8e7a',
  },
};

/**
 * Build a MapLibre style spec for the SmartMove editorial basemap. Pure
 * function — call once per map instance.
 *
 * `cacheBust` is appended to the tile URL as a no-op query string so we
 * can force the edge cache to drop after a fresh PMTiles upload.
 */
export function buildAreasMapStyle(opts: { cacheBust?: string } = {}): StyleSpecification {
  const qs = opts.cacheBust ? `?v=${encodeURIComponent(opts.cacheBust)}` : '';
  const tileUrl = `${TILES_WORKER_BASE}/${ARCHIVE}/{z}/{x}/{y}.mvt${qs}`;

  const layers = protomapsLayers('protomaps', editorialFlavor, { lang: 'en' });

  return {
    version: 8,
    name: 'SmartMove Editorial',
    glyphs: `${PROTOMAPS_ASSETS}/fonts/{fontstack}/{range}.pbf`,
    sprite: [
      { id: 'default', url: `${PROTOMAPS_ASSETS}/sprites/v4/light` },
    ],
    sources: {
      protomaps: {
        type: 'vector',
        tiles: [tileUrl],
        minzoom: 0,
        maxzoom: 14,
        attribution:
          '<a href="https://protomaps.com" target="_blank" rel="noopener">Protomaps</a> · <a href="https://openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
      },
    },
    layers,
  };
}

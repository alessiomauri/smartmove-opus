'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { Link } from '@/i18n/navigation';
import { Area, AreaRegion } from '@/types/area';

/**
 * Areas index — Areas v3 design (Brand Foundation, May 2026).
 *
 * Composition, top to bottom:
 *   1. Editorial hero with 4-stat strip + coastline glyph (SVG placeholder
 *      per user direction — to be swapped for a real map illustration later)
 *   2. Sticky region-pill filter
 *   3. Full-bleed map section (dark ink bg) — the real AreasLeafletMap from
 *      Marbella Live, rendered against the design's dark canvas, with a
 *      detail rail on the right showing the active region
 *   4. Featured 6 cards (curated hero areas)
 *   5. Directory grouped by region cluster — every area, 4-col grid per cluster
 *   6. Final dark CTA (orientation call + area-guide PDF)
 *
 * Counts are computed server-side from manual + scraper properties only
 * (excludes Resales bulk per the user's editorial filter).
 */

function MapPlaceholder() {
  return (
    <div className="flex items-center justify-center h-full text-[13px] text-ink/50">
      Loading map…
    </div>
  );
}

const AreasLeafletMap = dynamic(
  () => import('@/components/areas/AreasLeafletMap'),
  { ssr: false, loading: () => <MapPlaceholder /> }
);

interface Cluster {
  key: string;
  label: string;
  italic?: string;           // italicised portion of the label
  blurb: string;
  regions: AreaRegion[];
  slugs?: string[];          // optional explicit slug allowlist (overrides regions)
  fromMin?: number;          // human "from €X" anchor used in the cluster head
}

const CLUSTERS: Cluster[] = [
  {
    key: 'marbella',
    label: 'Marbella',
    blurb:
      "The core market. Fourteen distinct sub-areas, from the polished hush of Sierra Blanca to the marina noise of Banús. The majority of every cycle's transactions happens here.",
    regions: ['Marbella'],
  },
  {
    key: 'benahavis',
    label: 'Benahavís',
    italic: 'Benahavís',
    blurb:
      "Inland from Banús, framed by mountains and the Guadalmina river. Trades nightlife for nature reserves and very large plots. Includes the coast's two most-policed gated estates.",
    regions: ['Benahavis'],
  },
  {
    key: 'estepona',
    label: 'Estepona',
    blurb:
      'Twenty-five minutes west of Marbella, with a continuous beachfront promenade now stretching most of its length. Newer buildings, fewer dynastic estates, the strongest gold-standard new-build pipeline on the coast.',
    regions: ['Estepona'],
  },
  {
    key: 'western',
    label: 'Western Coast',
    italic: 'Coast',
    blurb:
      'Beyond Estepona, into Manilva, Casares, San Roque. Larger plots, lower prices, and the polo capital of Europe at the far end. Forty-five minutes from Marbella, a different demographic from the moment you cross the Guadiaro.',
    regions: ['Casares', 'Manilva', 'San Roque'],
  },
  {
    key: 'mijas-east',
    label: 'Mijas & East',
    italic: '& East',
    blurb:
      'East of Marbella, into Mijas, Fuengirola, Benalmádena, all the way to Málaga centro. Higher density, better value per square metre, the strongest short-let yields on the coast. Buyer profile is younger, more domestic.',
    regions: ['Mijas', 'Fuengirola', 'Torremolinos', 'Malaga'],
  },
];

/** The six curated hero areas surfaced in the "most of the demand" block. */
const FEATURED: Array<{
  slug: string;
  fallbackName: string;
  italic: string;
  municip: string;
  blurb: string;
  badges: Array<{ label: string; gold?: boolean }>;
  num: string;
}> = [
  {
    slug: 'la-zagaleta',
    fallbackName: 'La Zagaleta',
    italic: 'Zagaleta',
    municip: 'Benahavís · West',
    blurb:
      "Spain's most-policed gated estate. 230 villas across 900 hectares; new-build land is gone, so every transaction is a re-trade. Helipad and two private golf courses included in the HOA.",
    badges: [{ label: 'Resort', gold: true }, { label: 'Trophy' }],
    num: 'i.',
  },
  {
    slug: 'golden-mile',
    fallbackName: 'Golden Mile',
    italic: 'Mile',
    municip: 'Marbella · Centre',
    blurb:
      'The four kilometres between Marbella town and Puerto Banús. Beachfront penthouses, art-deco palacios, the Marbella Club. Limited supply, predictable buyers.',
    badges: [{ label: 'Beachfront' }],
    num: 'ii.',
  },
  {
    slug: 'nueva-andalucia',
    fallbackName: 'Nueva Andalucía',
    italic: 'Andalucía',
    municip: 'Marbella · West',
    blurb:
      'The valley behind Banús, framed by Las Brisas, Aloha, and Los Naranjos. Families optimising for international schools and a 6-iron from clubhouse to terrace.',
    badges: [{ label: 'Family · Golf' }],
    num: 'iii.',
  },
  {
    slug: 'sierra-blanca',
    fallbackName: 'Sierra Blanca',
    italic: 'Blanca',
    municip: 'Marbella · Hillside',
    blurb:
      "The amphitheatre above Marbella town. Twenty-four-hour security, terraced plots stepping up the mountain, the city's best sea views from a southerly aspect.",
    badges: [{ label: 'Resort', gold: true }, { label: 'Trophy' }],
    num: 'iv.',
  },
  {
    slug: 'puerto-banus',
    fallbackName: 'Puerto Banús',
    italic: 'Banús',
    municip: 'Marbella · Marina',
    blurb:
      'The marina itself plus the apartments and townhouses surrounding it. Short-let yields outperform the rest of the coast; expect strong-season pricing on every transaction.',
    badges: [{ label: 'Marina · Holiday' }],
    num: 'v.',
  },
  {
    slug: 'sotogrande',
    fallbackName: 'Sotogrande',
    italic: '',
    municip: 'San Roque · West',
    blurb:
      'Forty-five minutes west, the polo capital and Valderrama golf. Larger plots, calmer streets, and a buyer profile that skews equestrian.',
    badges: [{ label: 'Resort', gold: true }, { label: 'Polo' }],
    num: 'vi.',
  },
];

function formatFrom(n: number | undefined): string | null {
  if (!n) return null;
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `€${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  return `€${Math.round(n / 1000)}K`;
}

/** Inject italic emphasis into an area name at the second word. */
function nameWithItalic(name: string, italic?: string) {
  if (!italic) return name;
  const i = name.toLowerCase().indexOf(italic.toLowerCase());
  if (i === -1) return name;
  const before = name.slice(0, i);
  const part = name.slice(i, i + italic.length);
  const after = name.slice(i + italic.length);
  return (
    <>
      {before}
      <em>{part}</em>
      {after}
    </>
  );
}

interface Props {
  areas: Area[];
  listingCounts: Record<string, number>;
  minPrices: Record<string, number>;
}

export default function AreasIndexClient({
  areas,
  listingCounts,
  minPrices,
}: Props) {
  const [activeCluster, setActiveCluster] = useState<string>('all');
  const [sortMode, setSortMode] = useState<'region' | 'alpha' | 'price'>('region');
  // Macro pin clicked? Drives the rail. null = "Costa del Sol" overview.
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  // Drop the airport — it's a transit pin on the map, not an area to browse.
  const propertyAreas = useMemo(
    () => areas.filter((a) => a.pin_category !== 'airport'),
    [areas]
  );

  // Map cluster key → list of areas in that cluster.
  const clusterAreas = useMemo(() => {
    const m: Record<string, Area[]> = {};
    for (const c of CLUSTERS) {
      m[c.key] = propertyAreas.filter((a) => c.regions.includes(a.region));
    }
    return m;
  }, [propertyAreas]);

  // Areas visible on the map, given the current region pill.
  const mappedAreas = useMemo(() => {
    if (activeCluster === 'all') return areas;
    const c = CLUSTERS.find((x) => x.key === activeCluster);
    if (!c) return areas;
    return areas.filter(
      (a) => c.regions.includes(a.region) || a.pin_category === 'airport'
    );
  }, [areas, activeCluster]);

  // Rail is driven by pin clicks only:
  //   - selectedSlug set → that area
  //   - nothing selected → Costa del Sol overview
  const railArea = useMemo(
    () => (selectedSlug ? propertyAreas.find((a) => a.slug === selectedSlug) ?? null : null),
    [selectedSlug, propertyAreas]
  );

  // Aggregate stats for the default Costa del Sol view.
  const aggregate = useMemo(() => {
    const totalListings = propertyAreas.reduce(
      (sum, a) => sum + (listingCounts[a.slug] ?? 0),
      0
    );
    const allMins = propertyAreas
      .map((a) => minPrices[a.slug])
      .filter((p): p is number => typeof p === 'number');
    const fromMin = allMins.length ? Math.min(...allMins) : null;
    return {
      totalAreas: propertyAreas.length,
      totalListings,
      fromMin,
      // Editorial region clusters (Marbella / Benahavís / Estepona /
      // Western Coast / Mijas & East), not raw DB region count.
      regions: CLUSTERS.length,
    };
  }, [propertyAreas, listingCounts, minPrices]);

  // Hero photo for the rail. Clicked area → Marbella fallback for the
  // Costa del Sol overview.
  const railPhoto = useMemo(() => {
    if (railArea?.hero_image)
      return { src: railArea.hero_image, alt: railArea.hero_image_alt || railArea.name };
    const fallback = propertyAreas.find((a) => a.slug === 'marbella' && a.hero_image)
      ?? propertyAreas.find((a) => a.hero_image);
    return fallback ? { src: fallback.hero_image, alt: 'Costa del Sol' } : null;
  }, [railArea, propertyAreas]);

  const railCount = railArea ? listingCounts[railArea.slug] ?? 0 : aggregate.totalListings;
  const railFrom = railArea
    ? formatFrom(minPrices[railArea.slug])
    : formatFrom(aggregate.fromMin ?? undefined);

  // Resolve featured area data from the live areas list.
  const featuredResolved = useMemo(
    () =>
      FEATURED.map((f) => {
        const area = propertyAreas.find((a) => a.slug === f.slug);
        return { spec: f, area };
      }).filter((x) => x.area),
    [propertyAreas]
  );

  // Directory rendering helper: sort within a cluster.
  function sortedCluster(c: Cluster): Area[] {
    const list = [...(clusterAreas[c.key] ?? [])];
    if (sortMode === 'alpha') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortMode === 'price') {
      list.sort((a, b) => {
        const pa = minPrices[a.slug] ?? Number.POSITIVE_INFINITY;
        const pb = minPrices[b.slug] ?? Number.POSITIVE_INFINITY;
        return pa - pb;
      });
    } else {
      // "region" order: main pins first, then resorts, then micros, alpha within
      list.sort((a, b) => {
        const order = { main: 0, resort: 1, micro: 2, airport: 3 } as const;
        const ra = order[a.pin_category] ?? 9;
        const rb = order[b.pin_category] ?? 9;
        if (ra !== rb) return ra - rb;
        return a.name.localeCompare(b.name);
      });
    }
    return list;
  }

  const totalAreas = propertyAreas.length;

  return (
    <div className="sm-areas">
      {/* ──────────── HERO ──────────── */}
      <section className="sm-areas-hero">
        <div>
          <div className="crumb">
            <Link href="/">Home</Link>
            <span className="sep">/</span>
            <span>Costa del Sol</span>
            <span className="sep">/</span>Areas
          </div>
          <span className="eyebrow">Coast guide</span>
          <h1>
            The coast, broken into <em>specifics.</em>
          </h1>
          <p className="lede">
            <strong>Marbella isn&rsquo;t one market.</strong> It&rsquo;s a
            string of distinct towns, gated estates, and resort enclaves
            running from Sotogrande to Málaga, each with its own buyer,
            register, and price-per-square-metre. We cover{' '}
            <strong>{totalAreas}</strong> of them. Pick a place to start.
          </p>
          <div className="stats">
            <div>
              <div className="num">
                <em>{totalAreas}</em>
              </div>
              <div className="lbl">Locations covered</div>
            </div>
            <div>
              <div className="num">5</div>
              <div className="lbl">Region clusters</div>
            </div>
            <div>
              <div className="num">
                120<em>km</em>
              </div>
              <div className="lbl">Of coastline</div>
            </div>
            <div>
              <div className="num">11</div>
              <div className="lbl">Local advisors</div>
            </div>
          </div>
        </div>

        {/* Placeholder coastline glyph per Claude Design.
            User direction: keep this placeholder for now — to be swapped
            for a real map illustration or photograph later. */}
        <div className="coast">
          <div className="scale">120 km of coast</div>
          <svg
            className="coastline"
            viewBox="0 0 400 240"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              d="M0,120 C40,110 70,135 110,128 C150,120 175,100 210,108 C250,116 280,140 320,132 C355,124 380,135 400,130 L400,240 L0,240 Z"
              fill="rgba(74,108,128,.7)"
              stroke="rgba(255,255,255,.55)"
              strokeWidth="1"
            />
            <circle cx="32" cy="118" r="3" fill="#e8d4a2" />
            <circle cx="84" cy="129" r="3" fill="#e8d4a2" />
            <circle cx="142" cy="118" r="4" fill="#fff" />
            <circle cx="190" cy="106" r="3" fill="#e8d4a2" />
            <circle cx="238" cy="115" r="3" fill="#e8d4a2" />
            <circle cx="286" cy="138" r="3" fill="#e8d4a2" />
            <circle cx="334" cy="129" r="3" fill="#e8d4a2" />
            <circle cx="380" cy="131" r="3" fill="#e8d4a2" />
          </svg>
          <div className="label">
            <div className="ttl">
              Sotogrande
              <br />
              to Málaga
            </div>
            <div className="meta">
              36.51° N
              <br />
              4.88° W
            </div>
          </div>
        </div>
      </section>

      {/* ──────────── MAP SECTION ──────────── */}
      <section className="sm-areas-mapsec">
        <div className="head">
          <div>
            <span className="eyebrow">The coast at a glance</span>
            <h2>
              One coastline, <em>five distinct markets.</em>
            </h2>
          </div>
          <p>
            Use the region pills below to filter the map and the directory
            together. Click any pin to load that area on the right.
          </p>
          <div className="meta-callout">
            <span className="num">
              <em>{totalAreas}</em> areas
            </span>
            Plotted, named, ready
          </div>
        </div>

        {/* Filter row — sits BELOW the dark head and ABOVE the map.
            Sticky (top: 72px) so it remains accessible while the user
            interacts with the map. Filters drive both the map (pin
            set) and the directory below (cluster visibility). Sort
            affects the directory only. */}
        <div className="sm-areas-filter">
          <div className="label">Filter by region</div>
          <div className="pills">
            <button
              type="button"
              className={`pill${activeCluster === 'all' ? ' on' : ''}`}
              onClick={() => { setActiveCluster('all'); setSelectedSlug(null); }}
            >
              All <span className="ct">{totalAreas}</span>
            </button>
            {CLUSTERS.map((c) => (
              <button
                key={c.key}
                type="button"
                className={`pill${activeCluster === c.key ? ' on' : ''}`}
                onClick={() => { setActiveCluster(c.key); setSelectedSlug(null); }}
              >
                {c.label}{' '}
                <span className="ct">{(clusterAreas[c.key] ?? []).length}</span>
              </button>
            ))}
          </div>
          <div className="secondary">
            <button
              type="button"
              className={sortMode === 'region' ? 'on' : ''}
              onClick={() => setSortMode('region')}
            >
              By region
            </button>
            <button
              type="button"
              className={sortMode === 'alpha' ? 'on' : ''}
              onClick={() => setSortMode('alpha')}
            >
              A → Z
            </button>
            <button
              type="button"
              className={sortMode === 'price' ? 'on' : ''}
              onClick={() => setSortMode('price')}
            >
              By price
            </button>
          </div>
        </div>

        <div className="stage">
          <div className="sm-areas-map-wrap">
            <AreasLeafletMap
              areas={mappedAreas}
              selectedSlug={selectedSlug}
              onAreaSelect={(slug) => setSelectedSlug(slug)}
            />
          </div>

          <aside className="sm-areas-rail">
            {railPhoto && (
              <div className="r-photo">
                <Image
                  src={railPhoto.src}
                  alt={railPhoto.alt}
                  fill
                  sizes="380px"
                  priority={false}
                />
              </div>
            )}

            {railArea ? (
              /* ─── AREA mode — a pin was clicked ─── */
              <>
                <div className="r-eyebrow">{railArea.region} · Now showing</div>
                <h3>{nameWithItalic(railArea.name)}</h3>

                <div className="r-tags">
                  {railArea.pin_category === 'resort' && (
                    <span className="gold">Resort</span>
                  )}
                  {railArea.pin_category === 'main' && railArea.parent_area && (
                    <span className="gold">Main · nested</span>
                  )}
                  {railArea.pin_category === 'micro' && (
                    <span>Neighbourhood</span>
                  )}
                  {(railArea.property_types ?? []).slice(0, 2).map((t) => (
                    <span key={t}>{t}</span>
                  ))}
                </div>

                <p className="r-blurb">
                  {railArea.subheading || railArea.meta_description}
                </p>

                <div className="r-stats">
                  <div>
                    <div className="lbl">Listings</div>
                    <div className="val">
                      <em>{railCount}</em> active
                    </div>
                  </div>
                  <div>
                    <div className="lbl">From</div>
                    <div className="val">
                      {railFrom ?? <span className="txt">On request</span>}
                    </div>
                  </div>
                  <div>
                    <div className="lbl">Region</div>
                    <div className="val txt">{railArea.region}</div>
                  </div>
                  <div>
                    <div className="lbl">Type</div>
                    <div className="val txt">
                      {railArea.pin_category === 'resort'
                        ? 'Gated resort'
                        : railArea.pin_category === 'main'
                          ? 'Main town'
                          : 'Neighbourhood'}
                    </div>
                  </div>
                </div>

                <Link
                  href={{ pathname: '/areas/[slug]', params: { slug: railArea.slug } }}
                  className="r-cta"
                >
                  <span>
                    Explore{' '}
                    <em>
                      {railArea.name}
                      {railCount > 0 ? ` (${railCount})` : ''}
                    </em>
                  </span>
                  <span className="arrow">→</span>
                </Link>
                <button
                  type="button"
                  className="r-back"
                  onClick={() => setSelectedSlug(null)}
                >
                  ← Back to overview
                </button>
              </>
            ) : (
              /* ─── COAST mode — default, nothing selected ─── */
              <>
                <div className="r-eyebrow">Overview · All areas</div>
                <h3>
                  Costa del <em>Sol</em>
                </h3>

                <div className="r-tags">
                  <span className="gold">5 regions</span>
                  <span>{aggregate.totalAreas} locations</span>
                  <span>120 km coast</span>
                </div>

                <p className="r-blurb">
                  A 120-kilometre stretch from Sotogrande in the west to Málaga
                  in the east, split into five distinct markets and{' '}
                  {aggregate.totalAreas} towns, urbanisations, and gated
                  estates. Pick a region pill above or click any pin to read on.
                </p>

                <div className="r-stats">
                  <div>
                    <div className="lbl">Listings</div>
                    <div className="val">
                      <em>{aggregate.totalListings}</em> active
                    </div>
                  </div>
                  <div>
                    <div className="lbl">From</div>
                    <div className="val">
                      {railFrom ?? <span className="txt">On request</span>}
                    </div>
                  </div>
                  <div>
                    <div className="lbl">Areas covered</div>
                    <div className="val">
                      <em>{aggregate.totalAreas}</em>
                    </div>
                  </div>
                  <div>
                    <div className="lbl">Region clusters</div>
                    <div className="val">
                      <em>{aggregate.regions}</em>
                    </div>
                  </div>
                </div>

                <span className="r-cta r-cta--ghost">
                  <span>
                    Click a <em>pin</em> on the map
                  </span>
                  <span className="arrow">→</span>
                </span>
                <div className="r-hint">Hover for a name · click to load</div>
              </>
            )}
          </aside>
        </div>
      </section>

      {/* ──────────── FEATURED 6 ──────────── */}
      <section className="sm-areas-featured">
        <div className="head">
          <div>
            <span className="eyebrow muted">Where most of our buyers land</span>
            <h2>
              Six areas, <em>most of the demand.</em>
            </h2>
          </div>
          <p>
            The market isn&rsquo;t spread evenly. These six clusters absorb the
            majority of every cycle&rsquo;s transactions and almost all of the
            trophy stock. Start here, narrow later.
          </p>
        </div>

        <div className="sm-areas-feat-grid">
          {featuredResolved.map(({ spec, area }) => {
            const a = area!;
            const count = listingCounts[a.slug] ?? 0;
            const from = formatFrom(minPrices[a.slug]);
            return (
              <Link
                key={a.slug}
                href={{ pathname: '/areas/[slug]', params: { slug: a.slug } }}
                className="sm-areas-feat-card"
              >
                <div className="photo">
                  {a.hero_image && (
                    <Image
                      src={a.hero_image}
                      alt={a.hero_image_alt || a.name}
                      fill
                      sizes="(max-width: 1100px) 100vw, 33vw"
                    />
                  )}
                  <div className="num">{spec.num}</div>
                  <div className="badges">
                    {spec.badges.map((b) => (
                      <span
                        key={b.label}
                        className={`badge${b.gold ? ' gold' : ''}`}
                      >
                        {b.label}
                      </span>
                    ))}
                  </div>
                  <div className="ct-pill">
                    {count > 0 ? (
                      <>
                        <em>{count}</em> {count === 1 ? 'home' : 'homes'}
                      </>
                    ) : (
                      'Inventory on request'
                    )}
                  </div>
                </div>
                <div className="body">
                  <div className="municip">{spec.municip}</div>
                  <h3>{nameWithItalic(a.name, spec.italic)}</h3>
                  <p className="blurb">{spec.blurb}</p>
                  <div className="stats">
                    <div>
                      <div className="lbl">From</div>
                      <div className="val">
                        {from ? (
                          <em>{from}</em>
                        ) : (
                          a.price_range?.match(/€[\d,.]+[KMk]?/)?.[0] ?? '—'
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="lbl">Region</div>
                      <div className="val">{a.region}</div>
                    </div>
                    <div>
                      <div className="lbl">Type</div>
                      <div className="val">
                        {a.pin_category === 'resort' ? 'Resort' : 'Open'}
                      </div>
                    </div>
                  </div>
                  <div className="row">
                    <span />
                    <span className="cta">Explore →</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ──────────── DIRECTORY ──────────── */}
      <section className="sm-areas-dir">
        <div className="head">
          <div>
            <span className="eyebrow muted">
              {activeCluster === 'all'
                ? `All ${totalAreas} locations`
                : `${(clusterAreas[activeCluster] ?? []).length} locations · ${CLUSTERS.find((c) => c.key === activeCluster)?.label}`}
            </span>
            <h2>
              The full <em>directory.</em>
            </h2>
          </div>
          <p>
            Every town, urbanisation, and resort enclave we cover. Resort-flagged
            areas are private gated communities with their own access protocols.
            The region pills in the map section above filter what shows here.
          </p>
        </div>

        {/* Visible clusters follow the region pill in the map section
            above. "All" shows every cluster; any other pill narrows to
            just that one. The sort toggle reorders areas within each
            visible cluster. */}
        {CLUSTERS.filter((c) => activeCluster === 'all' || c.key === activeCluster).map((c, i) => {
          const list = sortedCluster(c);
          if (list.length === 0) return null;
          const totalInCluster = list.length;
          const minP = list
            .map((a) => minPrices[a.slug])
            .filter((p): p is number => typeof p === 'number')
            .sort((a, b) => a - b)[0];
          return (
            <div key={c.key} className="sm-areas-cluster">
              <div className="sm-areas-cluster-head">
                <div className="id">
                  <span className="num">{['i.','ii.','iii.','iv.','v.'][i] ?? `${i+1}.`}</span>
                  <h3>{c.italic ? nameWithItalic(c.label, c.italic) : c.label}</h3>
                </div>
                <p className="blurb">{c.blurb}</p>
                <div className="meta">
                  <span className="ct">
                    <em>{totalInCluster}</em> areas
                  </span>
                  {minP ? `From ${formatFrom(minP)}` : ''}
                </div>
              </div>
              <div className="sm-areas-cluster-grid">
                {list.map((a) => {
                  const count = listingCounts[a.slug] ?? 0;
                  const from = formatFrom(minPrices[a.slug]);
                  return (
                    <Link
                      key={a.slug}
                      href={{ pathname: '/areas/[slug]', params: { slug: a.slug } }}
                      className="sm-areas-area-row"
                    >
                      <div className="top">
                        <div className="nm">{nameWithItalic(a.name)}</div>
                        {a.pin_category === 'resort' && (
                          <span className="resort">Resort</span>
                        )}
                      </div>
                      <div className="stats">
                        <span className="ct">
                          {count > 0 ? (
                            <>
                              <em>{count}</em> {count === 1 ? 'home' : 'homes'}
                            </>
                          ) : (
                            'On request'
                          )}
                        </span>
                        {from && (
                          <span className="pf">
                            From <em>{from}</em>
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>

      {/* ──────────── FINAL CTA ──────────── */}
      <section className="sm-areas-cta">
        <div>
          <span className="eyebrow" style={{ color: 'var(--sm-gold-soft)' }}>
            Next step
          </span>
          <h2>
            {totalAreas} areas is a lot. Let us <em>narrow it.</em>
          </h2>
          <p>
            Most buyers come in convinced they want one place and leave with the
            keys to a different one. Both routes below shorten that journey. Pick
            whichever fits how you like to start.
          </p>
        </div>
        <div className="actions">
          <Link href="/" className="action">
            <div>
              <div className="icon">→</div>
              <div className="ttl">
                Book a 30-minute <em>orientation</em> call
              </div>
              <div className="desc">
                A short call with one of our regional leads. No listings shown.
                We ask what you&rsquo;re optimising for, then narrow you to two
                or three areas worth a longer look.
              </div>
            </div>
            <div className="arrow">→</div>
          </Link>
          <Link href="/" className="action">
            <div>
              <div className="icon">↓</div>
              <div className="ttl">
                Download the <em>area guide</em> (PDF)
              </div>
              <div className="desc">
                Market read on every area we cover: price-per-m² trends, typical
                buyer profiles, schooling notes, transaction volume.
              </div>
            </div>
            <div className="arrow">→</div>
          </Link>
        </div>
      </section>
    </div>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { Link } from '@/i18n/navigation';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { MapPin, ArrowRight } from 'lucide-react';
import { Area, AreaRegion } from '@/types/area';

function MapPlaceholder() {
  return (
    <div className="bg-white rounded-xl border border-ink/[0.06] h-[600px] flex items-center justify-center">
      <p className="text-[13px] text-ink/50">Loading map…</p>
    </div>
  );
}

// Browser-only: leaflet uses `window`, so SSR is disabled. Using `next/dynamic`
// (rather than React.lazy) plays nicer with Turbopack's HMR chunk graph and
// removes the need for a mount-state hack.
const AreasLeafletMap = dynamic(
  () => import('@/components/areas/AreasLeafletMap'),
  { ssr: false, loading: () => <MapPlaceholder /> }
);

interface Props {
  areas: Area[];
}

// Same Estepona / Marbella / Mijas order as the homepage podium row,
// so the brand's "three regional anchors" reads consistently across pages.
const FEATURED_SLUGS = ['estepona', 'marbella', 'mijas'];

/**
 * Macro regions for the map filter bar.
 * Each button filters pins to one or more DB regions, and the map zooms to fit.
 */
const MACRO_REGIONS: { label: string; regions: AreaRegion[] }[] = [
  { label: 'Marbella', regions: ['Marbella'] },
  { label: 'Benahav\u00eds', regions: ['Benahavis'] },
  { label: 'Estepona', regions: ['Estepona'] },
  { label: 'Western Coast', regions: ['Casares', 'Manilva', 'San Roque'] },
  { label: 'Mijas & East', regions: ['Mijas', 'Fuengirola', 'Torremolinos', 'Malaga'] },
];

export default function AreasIndexClient({ areas }: Props) {
  const [activeMacro, setActiveMacro] = useState<string | null>(null);

  const featured = useMemo(
    () => FEATURED_SLUGS.map(s => areas.find(a => a.slug === s)).filter(Boolean) as Area[],
    [areas]
  );

  // All non-airport areas (grid + map pins).
  const propertyAreas = useMemo(
    () => areas.filter(a => a.pin_category !== 'airport'),
    [areas]
  );

  const airports = useMemo(() => areas.filter(a => a.pin_category === 'airport'), [areas]);

  // Active macro region set for filtering.
  const activeRegionSet = useMemo(() => {
    if (!activeMacro) return null;
    const macro = MACRO_REGIONS.find(m => m.label === activeMacro);
    return macro ? new Set(macro.regions) : null;
  }, [activeMacro]);

  // Filtered areas for the map — when a macro is active only those regions show (plus airports always).
  const mapAreas = useMemo(() => {
    const filtered = activeRegionSet
      ? propertyAreas.filter(a => activeRegionSet.has(a.region))
      : propertyAreas;
    return [...filtered, ...airports];
  }, [propertyAreas, airports, activeRegionSet]);


  return (
    <div className="max-w-[1600px] mx-auto px-6 lg:px-12">
      {/* Featured Trio */}
      <section className="pb-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {featured.map((area) => (
            <FeaturedCard key={area.slug} area={area} />
          ))}
        </div>
      </section>

      {/* Map + macro region filter */}
      <section className="pb-12">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 className="font-display text-[22px] md:text-[26px] text-ink">
            Explore the Costa del Sol
          </h2>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setActiveMacro(null)}
              className={`px-3 py-1.5 text-[11px] font-semibold tracking-[0.05em] uppercase rounded-full border transition-all ${
                !activeMacro
                  ? 'bg-gold text-white border-gold'
                  : 'bg-white text-ink/60 border-ink/[0.08] hover:border-gold/30 hover:text-gold'
              }`}
            >
              All
            </button>
            {MACRO_REGIONS.map(m => (
              <button
                key={m.label}
                onClick={() => setActiveMacro(activeMacro === m.label ? null : m.label)}
                className={`px-3 py-1.5 text-[11px] font-semibold tracking-[0.05em] uppercase rounded-full border transition-all ${
                  activeMacro === m.label
                    ? 'bg-gold text-white border-gold'
                    : 'bg-white text-ink/60 border-ink/[0.08] hover:border-gold/30 hover:text-gold'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <AreasLeafletMap areas={mapAreas} />
      </section>

      {/* Compact directory — minimal text links grouped by region */}
      <section className="pb-16">
        <h3 className="font-display text-[18px] text-ink mb-4">
          All Locations
        </h3>
        <CompactDirectory areas={propertyAreas} />
      </section>
    </div>
  );
}

/* ───────── Featured card ───────── */

function FeaturedCard({ area }: { area: Area }) {
  return (
    <Link
      href={{ pathname: '/areas/[slug]', params: { slug: area.slug } }}
      className="group relative bg-white rounded-xl overflow-hidden border border-ink/[0.06] hover:border-gold/20 hover:shadow-xl transition-all duration-500"
    >
      <div className="relative aspect-[4/3] bg-[#f0ede9] overflow-hidden">
        {area.hero_image ? (
          <Image
            src={area.hero_image}
            alt={area.hero_image_alt || area.name}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-gold/20 to-gold/5 flex items-center justify-center">
            <MapPin className="w-10 h-10 text-gold/40" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-6">
          <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-white/80 mb-1">
            {area.region}
          </p>
          <h2 className="font-display text-[32px] text-white leading-tight mb-1">
            {area.name}
          </h2>
          <p className="text-[13px] text-white/70 line-clamp-1">
            {area.subheading}
          </p>
        </div>
      </div>
      <div className="p-5">
        <p className="text-[12px] font-semibold text-ink/50 mb-3">
          {area.price_range}
        </p>
        <span className="text-[12px] font-semibold tracking-[0.05em] uppercase text-gold flex items-center gap-1.5">
          Explore <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
        </span>
      </div>
    </Link>
  );
}

/* ───────── Directory (compact hierarchical text) ───────── */

const REGION_ORDER: AreaRegion[] = [
  'Marbella', 'Benahavis', 'Estepona', 'Casares', 'Manilva',
  'San Roque', 'Mijas', 'Fuengirola', 'Torremolinos', 'Malaga',
];

interface TreeNode {
  area: Area;
  children: Area[];
}

function CompactDirectory({ areas }: { areas: Area[] }) {
  const grouped = useMemo(() => {
    // Bucket by region
    const bucket: Record<string, Area[]> = {};
    for (const a of areas) {
      if (!bucket[a.region]) bucket[a.region] = [];
      bucket[a.region].push(a);
    }

    const order = { main: 0, resort: 1, micro: 2, airport: 3 };

    return REGION_ORDER
      .filter(r => bucket[r]?.length)
      .map(r => {
        const all = bucket[r];

        // Find the main area that matches the region name (used as header link)
        const mainArea = all.find(a => a.pin_category === 'main' && a.name === r) ?? null;

        // Top-level items: direct children of the main area,
        // or standalone roots if no main area exists for this region
        const topLevel = mainArea
          ? all.filter(a => a.parent_area === mainArea.slug)
          : all.filter(a => !a.parent_area || !all.find(x => x.slug === a.parent_area));

        const sorted = [...topLevel].sort((a, b) => {
          const ra = order[a.pin_category] ?? 4;
          const rb = order[b.pin_category] ?? 4;
          return ra !== rb ? ra - rb : a.name.localeCompare(b.name);
        });

        // Each top-level node carries its own children (grandchildren of the main area)
        const nodes: TreeNode[] = sorted.map(parent => ({
          area: parent,
          children: all
            .filter(a => a.parent_area === parent.slug)
            .sort((a, b) => a.name.localeCompare(b.name)),
        }));

        return { region: r, mainArea, nodes };
      });
  }, [areas]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-10 gap-y-6">
      {grouped.map(({ region, mainArea, nodes }) => (
        <div key={region}>
          {/* Region header — clickable if a matching main area exists */}
          {mainArea ? (
            <Link
              href={{ pathname: '/areas/[slug]', params: { slug: mainArea.slug } }}
              className="block text-[10px] font-semibold tracking-[0.12em] uppercase text-gold mb-2.5 pb-1.5 border-b border-ink/[0.06] hover:text-gold-deep transition-colors"
            >
              {region} →
            </Link>
          ) : (
            <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-ink/40 mb-2.5 pb-1.5 border-b border-ink/[0.06]">
              {region}
            </p>
          )}
          <ul className="space-y-1.5">
            {nodes.map(({ area: a, children }) => (
              <li key={a.slug}>
                <Link
                  href={{ pathname: '/areas/[slug]', params: { slug: a.slug } }}
                  className={`inline-flex items-center gap-1.5 underline decoration-transparent hover:decoration-current transition-all ${
                    a.pin_category === 'main'
                      ? 'text-[13px] font-semibold text-gold'
                      : a.pin_category === 'resort'
                        ? 'text-[13px] font-medium text-[#9a8568]'
                        : 'text-[13px] font-medium text-ink/70 hover:text-ink'
                  }`}
                >
                  {a.name}
                  {a.pin_category === 'resort' && (
                    <span className="text-[8px] font-bold tracking-[0.08em] uppercase opacity-60">Resort</span>
                  )}
                </Link>
                {/* Nested children */}
                {children.length > 0 && (
                  <ul className="mt-1 ml-3 space-y-0.5 border-l border-ink/[0.06] pl-3">
                    {children.map(c => (
                      <li key={c.slug}>
                        <Link
                          href={{ pathname: '/areas/[slug]', params: { slug: c.slug } }}
                          className={`text-[12px] underline decoration-transparent hover:decoration-current transition-all ${
                            c.pin_category === 'resort'
                              ? 'font-medium text-[#9a8568]'
                              : 'text-ink/60 hover:text-ink'
                          }`}
                        >
                          {c.name}
                          {c.pin_category === 'resort' && (
                            <span className="ml-1 text-[8px] font-bold tracking-[0.08em] uppercase opacity-60">Resort</span>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

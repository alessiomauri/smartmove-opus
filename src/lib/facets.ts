/**
 * Curated facet landing pages (Prompt 3 — "the serious SEO play").
 *
 * Each entry maps a pretty URL to a filter set + hand-tuned copy. ONLY
 * these slugs are indexed; every param-based /properties URL is
 * noindex,follow with a canonical pointing at the nearest facet (or
 * the base page). Adding a facet = adding an entry (admin UI later).
 *
 * Copy follows the AI SEARCH standard: `intro` is an ANSWER-FIRST
 * block (2–3 extractable sentences; the page injects live, dated
 * counts/prices around it), optional FAQ pairs become FAQPage schema.
 */
import type { SearchFilters } from '@/lib/search';

export interface FacetCopy {
  title: string;        // <title> — | Smartmove Marbella appended
  h1: string;
  meta: string;
  intro: string;        // answer-first block under the H1
  faq?: Array<{ q: string; a: string }>;
}

export interface FacetDef {
  slug: string;
  filters: Partial<Pick<SearchFilters, 'area' | 'type' | 'maxp' | 'feat' | 'beds'>>;
  en: FacetCopy;
  es: FacetCopy;
}

const f = (
  slug: string,
  filters: FacetDef['filters'],
  en: FacetCopy,
  es: FacetCopy
): FacetDef => ({ slug, filters, en, es });

export const FACETS: FacetDef[] = [
  f('villas-in-marbella', { type: 'villa', area: 'marbella' }, {
    title: 'Villas for Sale in Marbella',
    h1: 'Villas for sale in Marbella',
    meta: 'Every villa currently for sale in Marbella — Golden Mile, Sierra Blanca, Nagüeles and the hills. Live inventory, updated nightly from the local MLS.',
    intro: 'Marbella villas concentrate along the Golden Mile, in gated Sierra Blanca and on the Nagüeles hillside, with detached homes starting around €1.5M and trophy addresses far beyond. Inventory below is live — synced nightly with the Costa del Sol MLS.',
    faq: [
      { q: 'What does a villa in Marbella cost?', a: 'As of June 2026, entry-level detached villas in greater Marbella start around €1.2–1.5M; the Golden Mile and Sierra Blanca typically trade between €4M and €30M+.' },
      { q: 'Which Marbella areas are best for villas?', a: 'The Golden Mile and Sierra Blanca for prestige and walkability to the beach, Nagüeles and Cascada de Camoján for gated hillside privacy, and Marbella East (Elviria, Los Monteros) for more space per euro.' },
    ],
  }, {
    title: 'Villas en venta en Marbella',
    h1: 'Villas en venta en Marbella',
    meta: 'Todas las villas a la venta en Marbella — Milla de Oro, Sierra Blanca y las colinas. Inventario en vivo, actualizado cada noche.',
    intro: 'Las villas de Marbella se concentran en la Milla de Oro, Sierra Blanca y la ladera de Nagüeles, con precios desde aproximadamente €1,5M. El inventario se sincroniza cada noche con la MLS de la Costa del Sol.',
  }),
  f('apartments-in-marbella', { type: 'apartment', area: 'marbella' }, {
    title: 'Apartments for Sale in Marbella',
    h1: 'Apartments for sale in Marbella',
    meta: 'Apartments for sale across Marbella — old town, Golden Mile beachside and the hills. Live MLS inventory with prices and floor areas.',
    intro: 'Marbella apartments range from old-town walk-ups near the Plaza de los Naranjos to beachside communities on the Golden Mile. Two-bedroom units typically start around €350–450k in town and rise sharply toward the beach.',
  }, {
    title: 'Apartamentos en venta en Marbella',
    h1: 'Apartamentos en venta en Marbella',
    meta: 'Apartamentos a la venta en Marbella — casco antiguo, Milla de Oro y las colinas. Inventario MLS en vivo.',
    intro: 'Los apartamentos en Marbella van desde el casco antiguo hasta los complejos junto a la playa en la Milla de Oro. Las unidades de dos dormitorios parten de unos €350–450k en el centro.',
  }),
  f('penthouses-in-marbella', { type: 'penthouse', area: 'marbella' }, {
    title: 'Penthouses for Sale in Marbella',
    h1: 'Penthouses for sale in Marbella',
    meta: 'Marbella penthouses with terraces and sea views — live inventory from the local MLS, updated nightly.',
    intro: 'Penthouses are Marbella’s scarcest resale category: large terraces, sea views and lift-served buildings concentrate near the Golden Mile and the marina districts. Expect from roughly €700k in town to €10M+ frontline.',
  }, {
    title: 'Áticos en venta en Marbella',
    h1: 'Áticos en venta en Marbella',
    meta: 'Áticos en Marbella con terrazas y vistas al mar — inventario en vivo, actualizado cada noche.',
    intro: 'Los áticos son la categoría más escasa de Marbella: terrazas amplias y vistas al mar, concentrados cerca de la Milla de Oro. Desde unos €700k en el centro.',
  }),
  f('apartments-puerto-banus', { type: 'apartment', area: 'puerto-banus' }, {
    title: 'Apartments for Sale in Puerto Banús',
    h1: 'Apartments for sale in Puerto Banús',
    meta: 'Marina-side and second-line apartments in Puerto Banús — live inventory with prices, updated nightly from the MLS.',
    intro: 'Puerto Banús apartments split between frontline-marina addresses (Playas del Duque, Gray d’Albion) and the quieter second line toward Nueva Andalucía. Marina frontline trades at a premium; second-line two-beds start around €450–600k.',
  }, {
    title: 'Apartamentos en venta en Puerto Banús',
    h1: 'Apartamentos en venta en Puerto Banús',
    meta: 'Apartamentos en primera línea del puerto y segunda línea en Puerto Banús — inventario en vivo.',
    intro: 'Los apartamentos de Puerto Banús se dividen entre la primera línea del puerto y la segunda línea hacia Nueva Andalucía. Dos dormitorios en segunda línea desde unos €450–600k.',
  }),
  f('penthouses-puerto-banus', { type: 'penthouse', area: 'puerto-banus' }, {
    title: 'Penthouses for Sale in Puerto Banús',
    h1: 'Penthouses for sale in Puerto Banús',
    meta: 'Penthouses over the marina and beach in Puerto Banús — live MLS inventory, updated nightly.',
    intro: 'A Banús penthouse buys the marina skyline and walk-to-everything living. Supply is thin — a handful of buildings dominate — and pricing starts around €900k second-line, rising past €5M frontline.',
  }, {
    title: 'Áticos en venta en Puerto Banús',
    h1: 'Áticos en venta en Puerto Banús',
    meta: 'Áticos sobre el puerto y la playa de Puerto Banús — inventario en vivo.',
    intro: 'Un ático en Banús compra el horizonte del puerto. La oferta es escasa y los precios parten de unos €900k en segunda línea.',
  }),
  f('villas-nueva-andalucia', { type: 'villa', area: 'nueva-andalucia' }, {
    title: 'Villas for Sale in Nueva Andalucía',
    h1: 'Villas for sale in Nueva Andalucía',
    meta: 'Golf Valley villas in Nueva Andalucía — Los Naranjos, Las Brisas and Aloha. Live inventory updated nightly.',
    intro: 'Nueva Andalucía is the Golf Valley: villas wrap around Las Brisas, Los Naranjos and Aloha with mountain-and-course views ten minutes from Banús. Family-grade villas start around €1.5–2M; frontline-golf contemporary builds reach €8M+.',
    faq: [
      { q: 'Is Nueva Andalucía good for families?', a: 'Yes — it is Marbella’s most international family enclave, with Aloha College and several bilingual schools inside the valley, flat cycling streets and year-round community.' },
    ],
  }, {
    title: 'Villas en venta en Nueva Andalucía',
    h1: 'Villas en venta en Nueva Andalucía',
    meta: 'Villas del Valle del Golf en Nueva Andalucía — Los Naranjos, Las Brisas y Aloha. Inventario en vivo.',
    intro: 'Nueva Andalucía es el Valle del Golf: villas alrededor de Las Brisas, Los Naranjos y Aloha a diez minutos de Banús. Villas familiares desde €1,5–2M.',
  }),
  f('apartments-nueva-andalucia', { type: 'apartment', area: 'nueva-andalucia' }, {
    title: 'Apartments for Sale in Nueva Andalucía',
    h1: 'Apartments for sale in Nueva Andalucía',
    meta: 'Golf Valley apartments in Nueva Andalucía with course and mountain views — live MLS inventory.',
    intro: 'Apartment living in the Golf Valley means gated communities with mature gardens and course views, five–ten minutes above Puerto Banús. Two-beds typically run €350–700k depending on community and orientation.',
  }, {
    title: 'Apartamentos en venta en Nueva Andalucía',
    h1: 'Apartamentos en venta en Nueva Andalucía',
    meta: 'Apartamentos del Valle del Golf con vistas — inventario en vivo.',
    intro: 'Vivir en apartamento en el Valle del Golf significa urbanizaciones cerradas con jardines maduros a cinco–diez minutos de Puerto Banús. Dos dormitorios entre €350–700k.',
  }),
  f('villas-in-estepona', { type: 'villa', area: 'estepona' }, {
    title: 'Villas for Sale in Estepona',
    h1: 'Villas for sale in Estepona',
    meta: 'Villas across Estepona — town outskirts, the New Golden Mile and the hills. Live inventory, better value than central Marbella.',
    intro: 'Estepona delivers the coast’s best villa value-per-metre: detached homes from around €700k inland, €1.2M+ near the New Golden Mile beaches. The old town’s flower-lined streets anchor a genuinely Spanish year-round community.',
  }, {
    title: 'Villas en venta en Estepona',
    h1: 'Villas en venta en Estepona',
    meta: 'Villas en Estepona — afueras del pueblo, Nueva Milla de Oro y las colinas. Mejor valor que Marbella centro.',
    intro: 'Estepona ofrece el mejor valor por metro en villas de la costa: desde unos €700k hacia el interior y €1,2M+ cerca de las playas de la Nueva Milla de Oro.',
  }),
  f('apartments-in-estepona', { type: 'apartment', area: 'estepona' }, {
    title: 'Apartments for Sale in Estepona',
    h1: 'Apartments for sale in Estepona',
    meta: 'Apartments in Estepona old town, the port and the New Golden Mile — live MLS inventory updated nightly.',
    intro: 'Estepona apartments span the whitewashed old town, the working port and the resort communities of the New Golden Mile. Entry pricing from roughly €250k in town makes it the strongest first-purchase market west of Marbella.',
  }, {
    title: 'Apartamentos en venta en Estepona',
    h1: 'Apartamentos en venta en Estepona',
    meta: 'Apartamentos en el casco antiguo, el puerto y la Nueva Milla de Oro de Estepona — inventario en vivo.',
    intro: 'Los apartamentos de Estepona abarcan el casco antiguo, el puerto y la Nueva Milla de Oro. Precios de entrada desde unos €250k.',
  }),
  f('villas-in-benahavis', { type: 'villa', area: 'benahavis' }, {
    title: 'Villas for Sale in Benahavís',
    h1: 'Villas for sale in Benahavís',
    meta: 'Hillside and gated-community villas in Benahavís — La Zagaleta, El Madroñal, Los Flamingos. Live inventory.',
    intro: 'Benahavís is the hillside municipality behind the Golden Triangle, home to La Zagaleta, El Madroñal and Los Flamingos. Villas start around €1.5M in the village folds and run to €30M+ behind La Zagaleta’s gates.',
    faq: [
      { q: 'Why do buyers choose Benahavís over beachside Marbella?', a: 'Privacy, panoramic elevation and gated security — the estates above Benahavís offer plot sizes and views the beachside cannot, fifteen minutes from Puerto Banús.' },
    ],
  }, {
    title: 'Villas en venta en Benahavís',
    h1: 'Villas en venta en Benahavís',
    meta: 'Villas en las colinas y urbanizaciones cerradas de Benahavís — La Zagaleta, El Madroñal, Los Flamingos.',
    intro: 'Benahavís es el municipio de las colinas detrás del Triángulo de Oro: La Zagaleta, El Madroñal y Los Flamingos. Villas desde €1,5M.',
  }),
  f('penthouses-nueva-andalucia', { type: 'penthouse', area: 'nueva-andalucia' }, {
    title: 'Penthouses for Sale in Nueva Andalucía',
    h1: 'Penthouses for sale in Nueva Andalucía',
    meta: 'Golf Valley penthouses with terrace views over the courses — live inventory updated nightly.',
    intro: 'Golf Valley penthouses pair big terraces with La Concha and course views at notably better pricing than the beachside — typically €500k–€2M depending on community.',
  }, {
    title: 'Áticos en venta en Nueva Andalucía',
    h1: 'Áticos en venta en Nueva Andalucía',
    meta: 'Áticos del Valle del Golf con terrazas sobre los campos — inventario en vivo.',
    intro: 'Los áticos del Valle del Golf combinan terrazas amplias con vistas a La Concha, normalmente entre €500k y €2M.',
  }),
  f('villas-under-2m-marbella', { type: 'villa', area: 'marbella', maxp: 2_000_000 }, {
    title: 'Villas under €2M in Marbella',
    h1: 'Villas under €2 million in Marbella',
    meta: 'Every detached villa under €2M currently for sale in Marbella — live inventory, updated nightly.',
    intro: 'Under €2M, Marbella villas cluster in Marbella East (Elviria, El Rosario), the town’s hillside fringes and older urbanisations ripe for reform. This is the segment where local knowledge pays most — the same money buys very different outcomes street to street.',
  }, {
    title: 'Villas por menos de 2M€ en Marbella',
    h1: 'Villas por menos de €2 millones en Marbella',
    meta: 'Todas las villas independientes por debajo de 2M€ a la venta en Marbella — inventario en vivo.',
    intro: 'Por debajo de €2M, las villas de Marbella se agrupan en Marbella Este y las zonas altas del municipio. Es el segmento donde el conocimiento local más importa.',
  }),
  f('villas-under-3m-marbella', { type: 'villa', area: 'marbella', maxp: 3_000_000 }, {
    title: 'Villas under €3M in Marbella',
    h1: 'Villas under €3 million in Marbella',
    meta: 'Detached villas under €3M for sale across Marbella — live MLS inventory with prices and plots.',
    intro: 'The €2–3M band is Marbella’s sweet spot: renovated family villas in Elviria and Nueva Andalucía’s edges, and entry tickets to addresses that resell well. Below, every option currently on the market.',
  }, {
    title: 'Villas por menos de 3M€ en Marbella',
    h1: 'Villas por menos de €3 millones en Marbella',
    meta: 'Villas independientes por debajo de 3M€ en Marbella — inventario MLS en vivo.',
    intro: 'La franja de €2–3M es el punto dulce de Marbella: villas familiares renovadas y entradas a zonas que revenden bien.',
  }),
  f('villas-under-2m-estepona', { type: 'villa', area: 'estepona', maxp: 2_000_000 }, {
    title: 'Villas under €2M in Estepona',
    h1: 'Villas under €2 million in Estepona',
    meta: 'Detached villas under €2M in Estepona and the New Golden Mile — the coast’s strongest villa value.',
    intro: 'Estepona under €2M buys what costs double in central Marbella: detached homes with pools near the New Golden Mile, and village-edge villas walkable to the old town.',
  }, {
    title: 'Villas por menos de 2M€ en Estepona',
    h1: 'Villas por menos de €2 millones en Estepona',
    meta: 'Villas independientes por debajo de 2M€ en Estepona y la Nueva Milla de Oro.',
    intro: 'Estepona por debajo de €2M compra lo que cuesta el doble en Marbella centro: villas con piscina cerca de la Nueva Milla de Oro.',
  }),
  f('apartments-under-2m-puerto-banus', { type: 'apartment', area: 'puerto-banus', maxp: 2_000_000 }, {
    title: 'Apartments under €2M in Puerto Banús',
    h1: 'Apartments under €2 million in Puerto Banús',
    meta: 'Puerto Banús apartments under €2M — second-line and select marina addresses. Live inventory.',
    intro: 'Under €2M in Banús means the second line and the better lateral buildings — full marina lifestyle without frontline pricing. Stock turns fast in this band; the list below is synced nightly.',
  }, {
    title: 'Apartamentos por menos de 2M€ en Puerto Banús',
    h1: 'Apartamentos por menos de €2 millones en Puerto Banús',
    meta: 'Apartamentos en Puerto Banús por debajo de 2M€ — segunda línea y edificios laterales.',
    intro: 'Por debajo de €2M en Banús: la segunda línea y los mejores edificios laterales. El stock rota rápido en esta franja.',
  }),
  // The old site's /golf-properties/ page carries 7 years of equity and
  // 301s here on migration day — keep this slug stable.
  f('golf-properties', { feat: 'golf' }, {
    title: 'Golf Properties for Sale — Costa del Sol',
    h1: 'Golf properties on the Costa del Sol',
    meta: 'Frontline and golf-side homes across Marbella, Nueva Andalucía, Benahavís, Mijas and Estepona — 70+ courses within an hour. Live inventory.',
    intro: 'The Costa del Sol packs 70+ courses into one coastline — the highest golf density in continental Europe. Frontline-golf homes concentrate in Nueva Andalucía’s Golf Valley, La Cala Resort, Los Flamingos and Mijas Golf, typically pricing 10–20% above equivalent non-golf stock and renting strongly in winter.',
    faq: [
      { q: 'Where are the best frontline golf homes near Marbella?', a: 'Nueva Andalucía’s Golf Valley (Las Brisas, Los Naranjos, Aloha) for prestige; Los Flamingos for modern gated resort living; La Cala and Mijas Golf for value and rental yield.' },
      { q: 'Do golf properties rent well?', a: 'Yes — winter golf season (October–April) complements summer beach demand, giving golf-side homes the most balanced year-round occupancy on the coast, as of the 2025–26 season.' },
    ],
  }, {
    title: 'Propiedades de golf en venta — Costa del Sol',
    h1: 'Propiedades de golf en la Costa del Sol',
    meta: 'Viviendas en primera línea de golf en Marbella, Nueva Andalucía, Benahavís, Mijas y Estepona — más de 70 campos en una hora.',
    intro: 'La Costa del Sol concentra más de 70 campos: la mayor densidad de golf de Europa continental. Las viviendas en primera línea se concentran en el Valle del Golf, Los Flamingos y Mijas Golf.',
  }),
];

export function getFacet(slug: string): FacetDef | undefined {
  return FACETS.find((x) => x.slug === slug);
}

/**
 * Nearest curated facet for a param-based search — its canonical home.
 * Exact type+area+price match first, then type+area, then type-only
 * (golf via feature), else null (canonical → base /properties).
 */
export function nearestFacet(filters: {
  area?: string;
  type?: string;
  maxp?: number;
  feat?: string;
}): FacetDef | null {
  const norm = (s?: string) =>
    (s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-');
  // Facet areas are canonical slugs; the param may be a slug or a name.
  const areaMatch = (fa?: string) => !!fa && norm(filters.area) === norm(fa);

  let best: FacetDef | null = null;
  let bestScore = 0;
  for (const facet of FACETS) {
    let score = 0;
    if (facet.filters.type && facet.filters.type === filters.type) score += 4;
    else if (facet.filters.type) continue; // wrong type — never canonical
    if (facet.filters.area) {
      if (areaMatch(facet.filters.area)) score += 4;
      else continue;
    }
    if (facet.filters.maxp) {
      if (filters.maxp && filters.maxp <= facet.filters.maxp) score += 1;
      else continue;
    }
    if (facet.filters.feat) {
      if (filters.feat && norm(filters.feat).includes(norm(facet.filters.feat))) score += 4;
      else continue;
    }
    if (score > bestScore) {
      best = facet;
      bestScore = score;
    }
  }
  return best;
}

/** Lateral cross-links: same area or same type, excluding self. */
export function siblingFacets(slug: string, max = 6): FacetDef[] {
  const self = getFacet(slug);
  if (!self) return [];
  return FACETS.filter(
    (x) =>
      x.slug !== slug &&
      ((x.filters.area && x.filters.area === self.filters.area) ||
        (x.filters.type && x.filters.type === self.filters.type) ||
        (x.filters.feat && x.filters.feat === self.filters.feat))
  ).slice(0, max);
}

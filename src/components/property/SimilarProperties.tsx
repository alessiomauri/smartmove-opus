import PropertyCard from '@/components/PropertyCard';
import { getSimilarProperties } from '@/lib/similar';
import type { Property } from '@/types/property';

/**
 * "Similar properties" carousel on every detail page — geo-ranked when
 * the listing carries coordinates, same-area otherwise. Server
 * component: rides the page's ISR; renders nothing when no candidates.
 */
export default async function SimilarProperties({ property }: { property: Property }) {
  const similar = await getSimilarProperties(property);
  if (similar.length === 0) return null;

  return (
    <section className="py-16 lg:py-20 bg-paper relative overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-8 lg:px-16">
        <header className="flex items-end justify-between gap-6 mb-8">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-gold mb-3">
              Keep looking
            </p>
            <h2 className="font-display text-[28px] md:text-[38px] leading-[1.05] tracking-tight text-ink">
              Similar properties
            </h2>
          </div>
          <p className="hidden md:block text-[12.5px] text-ink/50 pb-1">
            Same type · comparable price{property.area ? ` · near ${property.area}` : ''}
          </p>
        </header>

        {/* Snap carousel on mobile, 3-up grid from lg */}
        <div className="flex gap-5 overflow-x-auto snap-x snap-mandatory pb-3 -mx-8 px-8 lg:mx-0 lg:px-0 lg:grid lg:grid-cols-3 lg:overflow-visible">
          {similar.map((p, i) => (
            <div key={p.id} className="snap-start shrink-0 w-[82%] sm:w-[46%] lg:w-auto">
              <PropertyCard property={p} index={i} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

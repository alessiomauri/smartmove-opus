import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, MapPin, BookOpen, BarChart3, MessageCircle, Instagram, Linkedin, Mail } from 'lucide-react';
import { getPublishedAreas } from '@/lib/actions/areas';
import { getPublishedBlogPosts } from '@/lib/actions/blog';
import { BLOG_CATEGORY_LABELS } from '@/types/blog';
import { Area } from '@/types/area';
import NewsletterForm from '@/components/NewsletterForm';
import AreaCarousel from '@/components/AreaCarousel';
import HeroScrollCue from '@/components/HeroScrollCue';
import { LEAD_CAPTURE_ENABLED } from '@/lib/feature-flags';

/**
 * INFO-MODE HOMEPAGE.
 *
 * Public-facing pre-launch homepage. Positions Marbella Live as an
 * editorial / research publication for Costa del Sol property — not a
 * brokerage. Drives SEO + email capture without revealing the listings
 * direction.
 *
 * Server Component — zero client JS for the static parts. The newsletter
 * form is the only client island.
 */

// Featured areas — two-tier layout:
//   Anchor row: Estepona (left) · Marbella (centre, wider/taller — "in front") · Mijas (right)
//   Carousel:   continuously-scrolling marquee of every other published area
//               (micro-locations + resorts, all regions). Pulled dynamically
//               from getPublishedAreas() so new admin uploads appear automatically.
const ANCHOR_AREA_SLUGS = ['estepona', 'marbella', 'mijas'];

// Carousel priority order — these slugs appear FIRST in the carousel, in
// this exact order. Everything else follows in the natural DB order
// (display_order, then name). Edit this list to re-order the lead slots.
const CAROUSEL_PRIORITY_SLUGS = [
  'golden-mile',
  'nueva-andalucia',
  'la-zagaleta',
  'puerto-banus',
  'marbella-east',
  'puente-romano',
  'la-cala-de-mijas',
  'finca-cortesin',
  'real-de-la-quinta',
  'los-flamingos',
  'aloha',
  'sierra-blanca',
];

const HERO_IMAGE = 'https://tvuhxqcpunavphakuzhm.supabase.co/storage/v1/object/public/area-images/hero/marbella.jpg?v=3';

const HEADER_NAV = [
  { href: '/areas', label: 'Areas' },
  { href: '/blog', label: 'Guides' },
];

export default async function HomeInfo() {
  const [allAreas, blogPosts] = await Promise.all([
    getPublishedAreas(),
    getPublishedBlogPosts(),
  ]);

  const lookupArea = (slug: string) => allAreas.find((a) => a.slug === slug);
  const anchorAreas = ANCHOR_AREA_SLUGS.map(lookupArea).filter(Boolean) as typeof allAreas;

  // Carousel content: every published area except the three anchors (already
  // shown above as the podium row) and the airport (transit reference, not
  // a property destination). Includes both the prime micro-addresses AND
  // the rest — the full atlas in motion.
  const eligible = allAreas.filter(
    (a) =>
      !ANCHOR_AREA_SLUGS.includes(a.slug) &&
      a.pin_category !== 'airport' &&
      !!a.hero_image
  );

  // Apply the priority ordering — slugs in CAROUSEL_PRIORITY_SLUGS come
  // first in their declared order; everything else preserves the natural
  // DB order returned by getPublishedAreas() (display_order, then name).
  const prioritised = CAROUSEL_PRIORITY_SLUGS
    .map((slug) => eligible.find((a) => a.slug === slug))
    .filter(Boolean) as typeof eligible;
  const remaining = eligible.filter(
    (a) => !CAROUSEL_PRIORITY_SLUGS.includes(a.slug)
  );
  const carouselAreas = [...prioritised, ...remaining];

  // Parent labels — for each carousel area, the name of its parent area
  // (e.g. "Marbella" for Golden Mile, "Nueva Andalucía" for Aloha) so the
  // carousel can show context. Falls back to the region when the area has
  // no parent. Computed server-side so it ships in initial HTML.
  const parentLabels: Record<string, string> = {};
  for (const area of carouselAreas) {
    if (area.parent_area) {
      const parent = allAreas.find((p) => p.slug === area.parent_area);
      parentLabels[area.slug] = parent?.name ?? area.region;
    } else {
      parentLabels[area.slug] = area.region;
    }
  }

  // Stats for the hero data sub-line
  const totalAreas = allAreas.filter((a) => a.pin_category !== 'airport').length;
  const totalRegions = new Set(allAreas.map((a) => a.region)).size;

  // Latest blog content (1 hero + 2 cards)
  const latestPosts = blogPosts.slice(0, 3);

  return (
    <div className="min-h-screen bg-[#faf9f8]">
      {/* ─────────────── Header ─────────────── */}
      <header className="absolute top-0 inset-x-0 z-30">
        <div className="max-w-[1600px] mx-auto px-6 lg:px-12 pt-7 lg:pt-9">
          <div className="flex items-center justify-between">
            {/* Wordmark — restored hover underline animation */}
            <Link href="/" className="group relative inline-block">
              <span className="text-[24px] lg:text-[26px] font-gloock text-white tracking-[-0.02em] drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] transition-opacity group-hover:opacity-90">
                Marbella Live
              </span>
              <span className="absolute -bottom-0.5 left-0 h-[1px] w-0 bg-white/80 transition-all duration-500 ease-out group-hover:w-full" />
            </Link>
            <nav className="flex items-center gap-6 lg:gap-8">
              {HEADER_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-[12px] font-semibold tracking-[0.12em] uppercase text-white/90 hover:text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </header>

      {/* ─────────────── Hero ─────────────── */}
      <section className="relative h-[78vh] min-h-[560px] max-h-[900px] overflow-hidden">
        <Image
          src={HERO_IMAGE}
          alt="Marbella, Costa del Sol coastal view"
          fill
          priority
          sizes="100vw"
          quality={80}
          className="object-cover"
        />
        {/* Layered gradient overlays for text legibility + cinematic feel.
            The dedicated top strip ensures the header (wordmark + nav) reads
            cleanly even against bright skies. */}
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/45 to-transparent pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/15 to-black/65 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/35 via-transparent to-transparent pointer-events-none" />

        <div className="relative h-full max-w-[1600px] mx-auto px-6 lg:px-12 flex flex-col justify-end pb-16 lg:pb-24">
          <div className="max-w-3xl">
            <p className="text-[10px] md:text-[11px] font-semibold tracking-[0.25em] uppercase text-white/85 mb-5 lg:mb-7 drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]">
              Costa del Sol · Andalucía
            </p>
            {/* H1 — capped at lg (88px instead of 104) so it leaves more
                breathing room from the header even on large screens. */}
            <h1 className="font-gloock text-white text-[44px] sm:text-[60px] md:text-[76px] lg:text-[88px] leading-[0.95] tracking-[-0.02em] mb-6 drop-shadow-[0_2px_12px_rgba(0,0,0,0.4)]">
              Marbella, properly
              <br />
              understood.
            </h1>
            <p className="text-[15px] md:text-[18px] text-white/90 max-w-xl leading-relaxed mb-8 drop-shadow-[0_1px_4px_rgba(0,0,0,0.4)]">
              The clearest, calmest view of one of Europe&apos;s most coveted
              property markets. Area guides, market data and buyer&apos;s
              handbooks, without the sales pitch.
            </p>
            <div className="flex items-center gap-4 text-[11px] text-white/80 tracking-[0.08em] drop-shadow-[0_1px_4px_rgba(0,0,0,0.4)]">
              <span className="h-px w-10 bg-white/50" />
              <span className="uppercase">
                Tracking {totalAreas} areas · {totalRegions} regions
              </span>
            </div>
          </div>

          {/* Scroll cue — same "Discover" label + chevron pattern used on
              the property detail hero, for design language consistency.
              Smooth-scrolls to the trio section. */}
          <HeroScrollCue targetId="where-to-start" />
        </div>
      </section>

      {/* ─────────────── Where to start (trio) ─────────────── */}
      <section
        id="where-to-start"
        className="max-w-[1600px] mx-auto px-6 lg:px-12 py-14 lg:py-18 scroll-mt-8"
      >
        <p className="text-[10px] font-semibold tracking-[0.25em] uppercase text-[#3c9ba7] mb-3 text-center">
          Where to start
        </p>
        <h2 className="font-gloock text-[28px] md:text-[36px] text-[#2e2e2e] text-center mb-12 lg:mb-16 leading-tight">
          Three ways into the Costa del Sol.
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6">
          <TrioCard
            href="/areas"
            icon={<MapPin className="w-5 h-5" />}
            heading="Explore the areas"
            sub={`${totalAreas} places, one map`}
            description="From the Golden Mile to Sotogrande. Every neighbourhood, urbanisation and resort that shapes the Costa del Sol property market."
          />
          <TrioCard
            href="/blog"
            icon={<BookOpen className="w-5 h-5" />}
            heading="Read the guides"
            sub="Buyer's handbooks"
            description="Plain-English explainers on the buying process, taxes, visas and lifestyle. Written for international buyers, not industry insiders."
          />
          <TrioCard
            href="/blog?category=market-report"
            icon={<BarChart3 className="w-5 h-5" />}
            heading="See the numbers"
            sub="Quarterly market reports"
            description="Independent price trends, transaction volumes and buyer-nationality data. Updated each quarter, free to read."
          />
        </div>
      </section>

      {/* Sleek divider */}
      <div className="max-w-[1600px] mx-auto px-6 lg:px-12">
        <div className="h-px bg-gradient-to-r from-transparent via-[#2e2e2e]/10 to-transparent" />
      </div>

      {/* ─────────────── Featured areas — anchor row + micro chips ─────────────── */}
      {anchorAreas.length > 0 && (
        <section className="max-w-[1600px] mx-auto px-6 lg:px-12 py-14 lg:py-18">
          <div className="flex items-end justify-between mb-10 lg:mb-12 gap-6">
            <div>
              <p className="text-[10px] font-semibold tracking-[0.25em] uppercase text-[#3c9ba7] mb-3">
                Featured areas
              </p>
              <h2 className="font-gloock text-[28px] md:text-[36px] text-[#2e2e2e] leading-tight">
                Where buyers look first.
              </h2>
            </div>
            <Link
              href="/areas"
              className="hidden md:inline-flex items-center gap-2 text-[12px] font-semibold tracking-[0.08em] uppercase text-[#2e2e2e]/60 hover:text-[#3c9ba7] transition-colors"
            >
              All areas <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Cards container — constrained to 90% width on md+ so the whole
              cards UI feels less heavy. Header above stays full-width.
              Mobile: full width (no constraint) so cards remain readable. */}
          <div className="md:max-w-[90%] md:mx-auto">
            {/* Anchor row — Estepona / Marbella (centre, wider+taller) / Mijas.
                .anchor-grid-13 (defined in globals.css) is a 13-column grid
                with col-spans 4/5/4 → Marbella is 1.25× larger in BOTH
                dimensions (down from 1.33×) — softer hierarchy where all
                three feel important, Marbella simply the first among equals.
                Vertically centred so Marbella's extra height extends equally
                above AND below the side cards. */}
            <div className="anchor-grid-13 gap-5 lg:gap-6 mb-12 lg:mb-14">
              <div className="md:col-span-4">
                <AnchorCard area={anchorAreas[0]} elevated={false} />
              </div>
              <div className="md:col-span-5">
                <AnchorCard area={anchorAreas[1]} elevated={true} />
              </div>
              <div className="md:col-span-4">
                <AnchorCard area={anchorAreas[2]} elevated={false} />
              </div>
            </div>

          </div>

          {/* Carousel — auto-scrolling row of every other area on the Costa
              del Sol. Drag/swipe to scrub manually; prev/next nudge buttons;
              pauses on hover; loops infinitely. Each card shows its parent
              area as context (e.g. "MARBELLA · Golden Mile"). */}
          {carouselAreas.length > 0 && (
            <div className="mt-12 lg:mt-16">
              <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[#2e2e2e]/45 mb-5 text-center">
                And the most coveted addresses
              </p>
              <AreaCarousel areas={carouselAreas} parentLabels={parentLabels} />
            </div>
          )}

          {/* Mobile-only "all areas" link */}
          <div className="md:hidden mt-10 text-center">
            <Link
              href="/areas"
              className="inline-flex items-center gap-2 text-[12px] font-semibold tracking-[0.08em] uppercase text-[#3c9ba7]"
            >
              All areas <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </section>
      )}

      {/* ─────────────── Latest insight — 3 equal cards, slimmer rhythm ───────────────
          Switched from the 1-hero + 2-small layout to 3 equal cards: cleaner,
          more scannable, less heavy. Smaller image aspect (16:10) keeps the
          section compact. */}
      {latestPosts.length > 0 && (
        <section className="bg-white py-12 lg:py-14">
          <div className="max-w-[1600px] mx-auto px-6 lg:px-12">
            <div className="flex items-end justify-between mb-8 lg:mb-10 gap-6">
              <div>
                <p className="text-[10px] font-semibold tracking-[0.25em] uppercase text-[#3c9ba7] mb-2">
                  Latest insight
                </p>
                <h2 className="font-gloock text-[26px] md:text-[32px] text-[#2e2e2e] leading-tight">
                  From the editorial.
                </h2>
              </div>
              <Link
                href="/blog"
                className="hidden md:inline-flex items-center gap-2 text-[12px] font-semibold tracking-[0.08em] uppercase text-[#2e2e2e]/60 hover:text-[#3c9ba7] transition-colors"
              >
                All articles <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-7">
              {latestPosts.map((post) => (
                <Link
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className="group block"
                >
                  <div className="relative aspect-[16/10] rounded-[6px] overflow-hidden bg-[#f0ede9] mb-4">
                    {post.hero_image && (
                      <Image
                        src={post.hero_image}
                        alt={post.hero_image_alt || post.title}
                        fill
                        className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                    )}
                    {/* Subtle "Featured" badge — small, glassy, top-left.
                        Only on featured posts. Tasteful magazine treatment,
                        not a banner. */}
                    {post.featured && (
                      <span className="absolute top-3 left-3 inline-flex items-center gap-1 px-2.5 py-1 text-[9px] font-semibold tracking-[0.14em] uppercase text-white bg-black/35 backdrop-blur-md rounded-full border border-white/15">
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                        Featured
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-[#3c9ba7] mb-2">
                    {BLOG_CATEGORY_LABELS[post.category]}
                  </p>
                  <h3 className="font-gloock text-[#2e2e2e] group-hover:text-[#3c9ba7] transition-colors leading-tight mb-2 text-[19px] md:text-[21px]">
                    {post.title}
                  </h3>
                  {post.excerpt && (
                    <p className="text-[13px] text-[#2e2e2e]/60 leading-relaxed line-clamp-2">
                      {post.excerpt}
                    </p>
                  )}
                </Link>
              ))}
            </div>
            <div className="md:hidden mt-8 text-center">
              <Link
                href="/blog"
                className="inline-flex items-center gap-2 text-[12px] font-semibold tracking-[0.08em] uppercase text-[#3c9ba7]"
              >
                All articles <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ─────────────── About — text + at-a-glance stats ───────────────
          The text earns its space by sitting next to a quiet data block
          that demonstrates the depth of coverage. Numbers communicate
          competence faster than adjectives; the "0 sales pitches" line
          turns the brand ethos into a memorable factoid. */}
      <section className="max-w-[1600px] mx-auto px-6 lg:px-12 py-14 lg:py-18">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-16 items-start">
          {/* Text side — 2/3 of the row on lg+ */}
          <div className="lg:col-span-2 max-w-2xl">
            <p className="text-[10px] font-semibold tracking-[0.25em] uppercase text-[#3c9ba7] mb-3">
              About Marbella Live
            </p>
            <h2 className="font-gloock text-[28px] md:text-[36px] text-[#2e2e2e] leading-tight mb-6">
              Independent. Calm. Useful.
            </h2>
            <p className="text-[16px] md:text-[17px] text-[#2e2e2e]/70 leading-relaxed mb-5">
              Marbella Live is an independent guide to property and life on
              the Costa del Sol. We publish area research, market data and
              buyer&apos;s handbooks for anyone considering this stretch of
              coast as a home or an investment, without the sales pitch.
            </p>
            <p className="text-[15px] text-[#2e2e2e]/55 leading-relaxed">
              No commissions disguised as opinion, no listings dressed as
              articles. Just clear information, updated each quarter.
            </p>
          </div>

          {/* Stats side — 1/3 on lg+, beneath text on smaller screens.
              2 cols × 3 rows. Subtle vertical hairline divider on lg+.
              Order groups: site coverage (areas, regions) → place facts
              (golf, sun, airport) → brand statement (sales pitches). */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-9 lg:pl-10 lg:border-l lg:border-[#2e2e2e]/10">
            <Stat number={String(totalAreas)} label="Areas tracked" />
            <Stat number={String(totalRegions)} label="Regions covered" />
            <Stat number="70+" label="Golf courses" />
            <Stat number="320+" label="Days of sun / year" />
            <Stat number="25M" label="Airport / year" />
            <Stat number="0" label="Sales pitches" />
          </div>
        </div>
      </section>

      {/* ─────────────── Conversion zone — single combined CTA ───────────────
          Placed AFTER the About section so readers have built trust first.
          Combines newsletter + WhatsApp as parallel options (visitors
          self-select their channel) — research shows this outperforms two
          separate CTAs, and avoids the choice-paralysis penalty of
          multi-CTA pages. Gated behind LEAD_CAPTURE_ENABLED so the entire
          block can be hidden during pre-launch. */}
      {LEAD_CAPTURE_ENABLED && (
        <section className="max-w-[1600px] mx-auto w-full px-6 lg:px-12 pb-14 lg:pb-18">
          <div className="bg-white border border-[#2e2e2e]/[0.06] rounded-xl px-7 py-10 lg:px-12 lg:py-14 shadow-[0_4px_24px_-12px_rgba(60,155,167,0.15)]">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1px_1fr] gap-10 lg:gap-12 items-center">
              {/* Newsletter side — slow, deep, quarterly */}
              <div>
                <p className="text-[10px] font-semibold tracking-[0.25em] uppercase text-[#3c9ba7] mb-4">
                  Quarterly Report
                </p>
                <h3 className="font-gloock text-[22px] md:text-[26px] text-[#2e2e2e] leading-tight mb-3">
                  Get the property report by email.
                </h3>
                <p className="text-[14px] text-[#2e2e2e]/65 leading-relaxed mb-6">
                  Independent Marbella market data delivered each quarter.
                  No spam, ever.
                </p>
                <NewsletterForm
                  variant="inline"
                  label=""
                  helperText=""
                />
              </div>

              {/* Subtle vertical divider on lg+, becomes horizontal stack on mobile */}
              <div className="hidden lg:block h-full w-px bg-[#2e2e2e]/10" aria-hidden />

              {/* WhatsApp side — fast, immediate, casual */}
              <div>
                <p className="text-[10px] font-semibold tracking-[0.25em] uppercase text-[#3c9ba7] mb-4">
                  Live Updates
                </p>
                <h3 className="font-gloock text-[22px] md:text-[26px] text-[#2e2e2e] leading-tight mb-3">
                  Or join the WhatsApp community.
                </h3>
                <p className="text-[14px] text-[#2e2e2e]/65 leading-relaxed mb-6">
                  Quieter conversations: new area guides, market notes, the
                  occasional opinion. Leave anytime.
                </p>
                <a
                  href="https://chat.whatsapp.com/your-invite-link"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2.5 px-6 py-3 bg-[#25D366] text-white text-[12px] font-semibold tracking-[0.08em] uppercase rounded-full hover:bg-[#1fb755] transition-colors shadow-[0_4px_16px_-4px_rgba(37,211,102,0.35)] hover:shadow-[0_8px_24px_-4px_rgba(37,211,102,0.45)] hover:-translate-y-0.5 transition-all duration-300"
                >
                  <MessageCircle className="w-4 h-4" strokeWidth={2} />
                  Join the WhatsApp community
                </a>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ─────────────── Footer ─────────────── */}
      <footer className="border-t border-[#2e2e2e]/[0.06] py-12">
        <div className="max-w-[1600px] mx-auto px-6 lg:px-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10 mb-10 items-start">
            {/* Brand + tagline */}
            <div>
              <Link href="/" className="group relative inline-block">
                <span className="font-gloock text-[24px] text-[#3c9ba7] transition-colors group-hover:text-[#2d8a95]">
                  Marbella Live
                </span>
                <span className="absolute -bottom-0.5 left-0 h-[1px] w-0 bg-[#3c9ba7] transition-all duration-500 ease-out group-hover:w-full" />
              </Link>
              <p className="mt-3 text-[13px] text-[#2e2e2e]/55 leading-relaxed max-w-xs">
                An independent guide to property and life on the Costa del Sol.
              </p>
            </div>

            {/* Browse links */}
            <div>
              <p className="text-[10px] font-semibold tracking-[0.25em] uppercase text-[#2e2e2e]/45 mb-4">
                Browse
              </p>
              <nav className="flex flex-col gap-2 text-[13px] text-[#2e2e2e]/70">
                <Link href="/areas" className="hover:text-[#3c9ba7] transition-colors w-fit">Areas</Link>
                <Link href="/blog" className="hover:text-[#3c9ba7] transition-colors w-fit">Guides</Link>
                <Link href="/blog?category=market-report" className="hover:text-[#3c9ba7] transition-colors w-fit">Market reports</Link>
              </nav>
            </div>

            {/* Connect — socials */}
            <div>
              <p className="text-[10px] font-semibold tracking-[0.25em] uppercase text-[#2e2e2e]/45 mb-4">
                Connect
              </p>
              <div className="flex items-center gap-3">
                <a
                  href="https://instagram.com/marbella.live"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Marbella Live on Instagram"
                  className="w-10 h-10 flex items-center justify-center rounded-full border border-[#2e2e2e]/15 text-[#2e2e2e]/60 hover:text-[#3c9ba7] hover:border-[#3c9ba7]/40 transition-colors"
                >
                  <Instagram className="w-4 h-4" strokeWidth={1.5} />
                </a>
                <a
                  href="https://linkedin.com/company/marbella-live"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Marbella Live on LinkedIn"
                  className="w-10 h-10 flex items-center justify-center rounded-full border border-[#2e2e2e]/15 text-[#2e2e2e]/60 hover:text-[#3c9ba7] hover:border-[#3c9ba7]/40 transition-colors"
                >
                  <Linkedin className="w-4 h-4" strokeWidth={1.5} />
                </a>
                <a
                  href="https://chat.whatsapp.com/your-invite-link"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Marbella Live WhatsApp community"
                  className="w-10 h-10 flex items-center justify-center rounded-full border border-[#2e2e2e]/15 text-[#2e2e2e]/60 hover:text-[#3c9ba7] hover:border-[#3c9ba7]/40 transition-colors"
                >
                  <MessageCircle className="w-4 h-4" strokeWidth={1.5} />
                </a>
                <a
                  href="mailto:hello@marbella.live"
                  aria-label="Email Marbella Live"
                  className="w-10 h-10 flex items-center justify-center rounded-full border border-[#2e2e2e]/15 text-[#2e2e2e]/60 hover:text-[#3c9ba7] hover:border-[#3c9ba7]/40 transition-colors"
                >
                  <Mail className="w-4 h-4" strokeWidth={1.5} />
                </a>
              </div>
            </div>
          </div>

          {/* Bottom strip */}
          <div className="pt-6 border-t border-[#2e2e2e]/[0.06] flex flex-col md:flex-row items-center md:justify-between gap-2">
            <p className="text-[11px] text-[#2e2e2e]/40 tracking-[0.1em] uppercase">
              © {new Date().getFullYear()} · Marbella Live · Costa del Sol · Andalucía · Spain
            </p>
            <p className="text-[11px] text-[#2e2e2e]/30 tracking-[0.05em]">
              Independent property research and guides.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ───────── Sub-components ───────── */

function TrioCard({
  href,
  icon,
  heading,
  sub,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  heading: string;
  sub: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group block bg-white border border-[#2e2e2e]/[0.06] rounded-[6px] p-7 lg:p-8 transition-all duration-500 hover:-translate-y-1.5 hover:shadow-[0_20px_50px_-15px_rgba(60,155,167,0.18)] hover:border-[#3c9ba7]/20"
    >
      <div className="flex items-center gap-2 text-[#3c9ba7] mb-5">
        {icon}
        <span className="text-[10px] font-semibold tracking-[0.18em] uppercase">
          {sub}
        </span>
      </div>
      <h3 className="font-gloock text-[24px] md:text-[28px] text-[#2e2e2e] group-hover:text-[#3c9ba7] transition-colors leading-tight mb-3">
        {heading}
      </h3>
      <p className="text-[14px] text-[#2e2e2e]/65 leading-relaxed mb-5">
        {description}
      </p>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.12em] uppercase text-[#3c9ba7]">
        Begin
        <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-1" />
      </div>
    </Link>
  );
}

/**
 * Stat — used in the About section's "at a glance" block. Big Gloock
 * numeral in brand teal, small uppercase label underneath. Communicates
 * data-driven competence in two lines, no chrome.
 */
function Stat({ number, label }: { number: string; label: string }) {
  return (
    <div>
      <p className="font-gloock text-[36px] md:text-[44px] text-[#3c9ba7] leading-none mb-2 tracking-tight tabular-nums">
        {number}
      </p>
      <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-[#2e2e2e]/55 leading-tight">
        {label}
      </p>
    </div>
  );
}

/**
 * Anchor card — the three regional centres (Estepona, Marbella, Mijas).
 * `elevated=true` adds a subtle always-on shadow to make the centre card
 * (Marbella) feel "in front" of the side cards. Combined with the parent
 * grid's wider middle column, it creates a podium effect.
 */
function AnchorCard({ area, elevated = false }: { area: Area; elevated?: boolean }) {
  // Mobile (single column): wider 16:10 so cards don't dominate viewport.
  // Desktop podium row: ALL cards share aspect-[6/5] (slightly landscape).
  // Combined with the 90% container width, cards are ~6% wider than the
  // previous aspect-[8/7] + 85% container while keeping essentially the
  // same height. Marbella's hierarchy comes purely from the col-spans 4/5/4
  // in the 13-col grid → 1.25× larger in both dimensions.
  const aspectClass = 'aspect-[16/10] md:aspect-[6/5]';

  return (
    <Link href={`/areas/${area.slug}`} className="group block w-full">
      <div
        className={`relative ${aspectClass} rounded-[6px] overflow-hidden bg-[#f0ede9] transition-all duration-500 ${
          elevated
            ? 'shadow-[0_20px_50px_-18px_rgba(60,155,167,0.35)] group-hover:shadow-[0_30px_60px_-18px_rgba(60,155,167,0.45)] group-hover:-translate-y-1.5'
            : 'group-hover:-translate-y-1 group-hover:shadow-[0_18px_40px_-15px_rgba(0,0,0,0.18)]'
        }`}
      >
        {area.hero_image && (
          <Image
            src={area.hero_image}
            alt={area.hero_image_alt || area.name}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
            sizes={
              elevated
                ? '(max-width: 1024px) 100vw, 45vw'
                : '(max-width: 1024px) 100vw, 28vw'
            }
            {...(area.hero_image_blur
              ? { placeholder: 'blur' as const, blurDataURL: area.hero_image_blur }
              : {})}
          />
        )}
        {/* Gradient for text legibility at the bottom */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />

        {/* Caption inside the card — name only, no region tag (the three
            anchors ARE regional centres so the tag would just duplicate
            the name). Sized so even longer names like "Sotogrande" or
            "Nueva Andalucía" never clip at any breakpoint. */}
        <div className="absolute bottom-0 inset-x-0 p-5 lg:p-6 overflow-hidden">
          <h3
            className={`font-gloock text-white leading-[0.95] tracking-tight break-words ${
              elevated
                ? 'text-[26px] sm:text-[32px] md:text-[36px] lg:text-[42px]'
                : 'text-[22px] sm:text-[24px] md:text-[26px] lg:text-[28px]'
            }`}
          >
            {area.name}
          </h3>
        </div>
      </div>
    </Link>
  );
}

// (Removed MicroChip — replaced by the Embla-powered AreaCarousel which
// renders its own card markup.)

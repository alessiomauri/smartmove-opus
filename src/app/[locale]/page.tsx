import Link from 'next/link';
import { createStaticSupabaseClient } from '@/lib/supabase-static';
import SiteHeader from '@/components/sm/SiteHeader';
import SiteFooter from '@/components/sm/SiteFooter';
import { DubaiCountdown, DubaiWaitlist } from '@/components/sm/DubaiWidgets';
import { TESTIMONIALS, PRESS, GUIDES_FALLBACK, REGIONS, type GuideCard } from '@/lib/home-content';
import { getHomepageStats, yearsSince, numberToWords } from '@/lib/home-stats';
import { countPublishedInArea } from '@/lib/search';
import { getExplorePicks } from '@/lib/home-explore';
import { getServiceRoleClient } from '@/lib/supabase-service';
import '../../styles/sm-skin.css';
import '../../styles/sm-skin-extra.css';

export const revalidate = 3600;

const ArrowR = ({ w = 14, h = 10 }: { w?: number; h?: number }) => (
  <svg width={w} height={h} viewBox="0 0 14 10" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 5h12M9 1l4 4-4 4" /></svg>
);

export default async function Home() {
  const sb = createStaticSupabaseClient();

  // DYNAMIC proof numbers — live counts (no hardcoded figures).
  const [villas, devs, hoods, stats, regionCounts, quizRows, explore] = await Promise.all([
    sb.from('properties').select('id', { count: 'exact', head: true }).eq('published', true).eq('property_type', 'villa'),
    sb.from('developments').select('id', { count: 'exact', head: true }).eq('published', true),
    sb.from('areas').select('slug', { count: 'exact', head: true }).eq('published', true),
    getHomepageStats(),
    Promise.all(REGIONS.map((r) => countPublishedInArea(r.slug))),
    // Service-role: question counts must reflect the real questions length even
    // for a draft quiz (anon RLS only exposes 'live'). Server-only read.
    getServiceRoleClient().from('quizzes').select('slug, questions').in('slug', ['which-coast', 'which-development']),
    getExplorePicks(),
  ]);
  const villaCount = villas.count ?? 0;
  const devCount = devs.count ?? 0;
  const hoodCount = hoods.count ?? 0;
  const qLen = (slug: string) => { const q = (quizRows.data ?? []).find((x) => x.slug === slug); return Array.isArray(q?.questions) ? q!.questions.length : 0; };
  const coastQ = qLen('which-coast');
  const devQ = qLen('which-development');

  // EDITORIAL figures — unset ⇒ hidden (nothing fake).
  const sold = stats.soldVolume?.trim() || '';
  const rating = stats.rating?.trim() || '';
  const reviews = stats.reviewsCount?.trim() || '';
  const quizStarts = stats.quizStarts?.trim() || '';
  const founded = stats.foundedYear?.trim() || '';
  const years = yearsSince(founded);

  // Guides → blog_posts in guide categories; design placeholders if none yet.
  let guides: GuideCard[] = GUIDES_FALLBACK;
  try {
    const { data } = await sb
      .from('blog_posts')
      .select('slug, title, excerpt, category, cover_image')
      .in('category', ['buying-guide', 'selling-guide', 'area-guide', 'market-report'])
      .eq('published', true)
      .order('published_at', { ascending: false })
      .limit(3);
    if (data && data.length) {
      guides = data.map((p) => ({
        title: p.title, titleEm: '', blurb: p.excerpt ?? '', tag: (p.category ?? 'Guide').replace('-', ' '),
        image: p.cover_image ?? '/sm/listing-2.jpg', href: `/blog/${p.slug}`,
      }));
    }
  } catch { /* fall back to design placeholders */ }

  return (
    <div className="sm-skin">
      <SiteHeader variant="glass" />

      {/* ================== 01 HERO ================== */}
      <section className="home-hero" data-screen-label="01 Hero">
        <div className="center">
          <div className="hero-lead">
            <div className="eyebrow">Marbella · Costa del Sol{founded ? ` · Est. ${founded}` : ''}</div>
            <h1>Homes that <em>change the rhythm</em><br />of an entire summer.</h1>
          </div>
          <div className="hero-search">
            <div className="hs-field"><span className="l">Where</span><span className="v">All of the coast <svg viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M1 1l4 4 4-4" /></svg></span></div>
            <span className="hs-sep" />
            <div className="hs-field"><span className="l">Property type</span><span className="v">Any type <svg viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M1 1l4 4 4-4" /></svg></span></div>
            <span className="hs-sep" />
            <div className="hs-field"><span className="l">Budget</span><span className="v">Any price <svg viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M1 1l4 4 4-4" /></svg></span></div>
            <Link className="hs-go" href="/properties" aria-label="Search">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="9" cy="9" r="6" /><path d="M14 14l4 4" /></svg>
              <span>Search</span>
            </Link>
          </div>
          <div className="hero-quick">
            <span className="hq-l">Or browse</span>
            <Link href="/properties">{villaCount.toLocaleString()} villas</Link>
            <span className="hq-dot">·</span>
            <Link href="/new-developments">{devCount.toLocaleString()} new development{devCount === 1 ? '' : 's'}</Link>
            <span className="hq-dot">·</span>
            <Link href="/properties">Off-market</Link>
          </div>
        </div>
        <div className="scrolltip">Scroll · Marbella, June 2026</div>
      </section>

      {/* ================== 02 ABOUT + AWARDS ================== */}
      <section className="about" data-screen-label="02 About us">
        <div className="wrap">
          <div className="about-grid">
            <div className="about-image">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <div className="ai-frame"><img className="ai-photo" src="/sm/team-photo.png" alt="The Smartmove Marbella team" /></div>
              <div className="ai-meta">{founded && (<><span className="ai-num">Est. <em>{founded}</em></span><span className="ai-sep" /></>)}<span className="ai-loc">Marbella · Costa del Sol</span></div>
            </div>
            <div className="about-body">
              <div className="about-kicker">About Smartmove Marbella</div>
              <h2>On the buyer&rsquo;s side of the table, <em>end to end.</em></h2>
              <p>We don&rsquo;t push a small stable of in-house listings. We help families navigate the <strong>entire coast</strong>: every agency, every off-market whisper, every honest collaboration. Then we stay with you through legal, mortgage, renovation, and the first year of ownership.</p>
              <div className="about-actions">
                <Link href="/about" className="btn-gold">Read more <ArrowR /></Link>
                <Link href="/about" className="btn-link">Meet the team</Link>
              </div>
            </div>
          </div>
          <div className="about-awards">
            <div className="aa-cell">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/sm/award-luxury-lifestyle.png" alt="Luxury Lifestyle Awards" />
              <div className="aa-tx"><div className="n">Best Luxury Real Estate Boutique</div><div className="y">Luxury Lifestyle Awards · Spain · 2024</div><div className="d">Judged on service, discretion and client outcomes across 400+ boutiques.</div></div>
            </div>
            <span className="aa-div" />
            <div className="aa-cell">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/sm/award-top100-lreb.png" alt="Top 100 LREB" />
              <div className="aa-tx"><div className="n">Top 100 Brokers of the World</div><div className="y">Luxury Real Estate Brokers · 2023 · 2024 · 2025</div><div className="d">Ranked among the world&rsquo;s leading independent luxury brokerages, three years running.</div></div>
            </div>
            {(rating || reviews) && (
              <div className="aa-rating">{rating && <div className="stars">★★★★★</div>}<div className="aa-rt">{rating && <strong>{rating} / 5</strong>}{reviews && <span>{reviews} verified buyer reviews</span>}</div></div>
            )}
          </div>
        </div>
      </section>

      {/* ================== 03 EXPLORE ================== */}
      <section className="explore" data-screen-label="03 Explore">
        <div className="wrap">
          <div className="explore-head">
            <div className="ex-headl"><div className="ex-k">Find your home</div><h2>Two ways <em>in.</em></h2></div>
            <p className="ex-lede">Take a 2-minute quiz, or go straight to the collection. Either way, a real advisor picks it up from there.</p>
          </div>
          <div className="quiz-strip">
            <div className="qs-lead">
              <div className="qs-eyebrow">★ The easiest way to start</div>
              <div className="qs-t">Not sure yet?</div>
              <p>Take a 2-minute quiz and we&rsquo;ll match you to the right areas and homes. No email needed to see results.</p>
              {quizStarts && <div className="qs-proof"><span className="qs-stars">★★★★★</span><span><strong>{quizStarts} buyers</strong> started here this year</span></div>}
            </div>
            <Link className="qs-tile" href="/quiz/which-coast">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <span className="qs-thumb"><img src="/sm/coast-quiz.png" alt="" style={{ objectPosition: '80% center' }} /><span className="qs-pill">Area quiz</span></span>
              <span className="qs-tx"><span className="qs-cat">{coastQ} questions · 2 minutes</span><span className="qs-q">Which stretch of coast <em>is for you?</em></span><span className="qs-foot"><span className="qs-go">Start the quiz</span><span className="qs-arrow"><svg viewBox="0 0 16 12" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M1 6h13M10 1l4.5 5-4.5 5" /></svg></span></span></span>
            </Link>
            <Link className="qs-tile" href="/quiz/which-development">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <span className="qs-thumb"><img src="/sm/development-quiz.png" alt="" /><span className="qs-pill">Development quiz</span></span>
              <span className="qs-tx"><span className="qs-cat">{devQ} questions · 2 minutes</span><span className="qs-q">Which development <em>fits your brief?</em></span><span className="qs-foot"><span className="qs-go">Start the quiz</span><span className="qs-arrow"><svg viewBox="0 0 16 12" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M1 6h13M10 1l4.5 5-4.5 5" /></svg></span></span></span>
            </Link>
          </div>
          {/* Section stays whole. Each slot independently: curated/featured pick,
              else the DESIGN PLACEHOLDER (build-time stand-in — see CUTOVER.md §6). */}
          <div className="explore-or"><span>Or, if you already know</span></div>
          <div className="svd-row">
            {explore.villa ? (
            <Link className="svd-card" href={explore.villa.href}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <div className="svd-photo">{explore.villa.image && <img src={explore.villa.image} alt={explore.villa.name} />}<span className="svd-badge">Featured villa</span></div>
              <div className="svd-panel"><div className="svd-k">Resale &amp; signature villas</div><h3>{explore.villa.name}</h3><div className="svd-meta">{explore.villa.priceLabel && <span><em>{explore.villa.priceLabel}</em></span>}{explore.villa.beds && <span>{explore.villa.beds}</span>}{explore.villa.location && <span>{explore.villa.location}</span>}</div><span className="svd-go">View this villa <svg width="15" height="11" viewBox="0 0 15 11" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M1 5.5h12M9 1l4.5 4.5L9 10" /></svg></span></div>
            </Link>
            ) : (
            <Link className="svd-card" href="/properties">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <div className="svd-photo"><img src="/sm/listing-1.jpg" alt="Signature villas across the coast" /><span className="svd-badge">Villas</span></div>
              <div className="svd-panel"><div className="svd-k">Resale &amp; signature villas</div><h3>Villas <em>across the coast.</em></h3><p>Every agency, every off-market whisper, in one honest list, walked personally before we ever show you.</p><span className="svd-go">Browse all villas <svg width="15" height="11" viewBox="0 0 15 11" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M1 5.5h12M9 1l4.5 4.5L9 10" /></svg></span></div>
            </Link>
            )}
            {explore.dev ? (
            <Link className="svd-card" href={explore.dev.href}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <div className="svd-photo">{explore.dev.image && <img src={explore.dev.image} alt={explore.dev.name} />}<span className="svd-badge">New development</span></div>
              <div className="svd-panel"><div className="svd-k">Off-plan &amp; under construction</div><h3>{explore.dev.name}</h3><div className="svd-meta">{explore.dev.priceLabel && <span><em>{explore.dev.priceLabel}</em></span>}{explore.dev.beds && <span>{explore.dev.beds}</span>}{explore.dev.location && <span>{explore.dev.location}</span>}</div><span className="svd-go">View this development <svg width="15" height="11" viewBox="0 0 15 11" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M1 5.5h12M9 1l4.5 4.5L9 10" /></svg></span></div>
            </Link>
            ) : (
            <Link className="svd-card" href="/new-developments">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <div className="svd-photo"><img src="/sm/dev-marquee.jpg" alt="New developments on the coast" /><span className="svd-badge">New development</span></div>
              <div className="svd-panel"><div className="svd-k">Off-plan &amp; under construction</div><h3>New <em>developments.</em></h3><p>The coast&rsquo;s most architecturally ambitious builds, often before they reach the open market.</p><span className="svd-go">See new developments <svg width="15" height="11" viewBox="0 0 15 11" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M1 5.5h12M9 1l4.5 4.5L9 10" /></svg></span></div>
            </Link>
            )}
          </div>
          <Link className="explore-cta" href="/properties">
            <div className="ec-tx"><span className="ec-k">Prefer to see everything at once?</span><span className="ec-h">Open the <em>full property search</em></span></div>
            <span className="ec-go">Thousands of listings · every region <svg width="20" height="12" viewBox="0 0 20 12" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M1 6h17M13 1l5 5-5 5" /></svg></span>
          </Link>
        </div>
      </section>

      {/* ================== 05 AREAS ================== */}
      <section className="areas-tease" data-screen-label="05 Areas">
        <div className="wrap">
          <div className="head">
            <div><div className="kicker">Across the coast</div><h2>Five regions. <em>{numberToWords(hoodCount)} neighbourhoods.</em></h2></div>
            <div><p className="lede">Each region has its own rhythm, its own buyer, its own price floor. The right home almost always starts with the right region.</p><Link href="/areas">Explore the area atlas <ArrowR /></Link></div>
          </div>
          <div className="region-grid">
            {REGIONS.map((r, i) => (
              <Link key={r.slug} className={`region-tile${r.feature ? ' feature' : ''}`} href={`/properties?area=${r.slug}`}>
                <div className={`bg ${r.bg}`} />
                <span className="index">{r.index}{r.indexEm && <em>{r.indexEm}</em>}</span>
                <div className="meta"><h3>{r.name}{r.nameEm && <em>{r.nameEm}</em>}</h3>{regionCounts[i] > 0 && <div className="ct"><strong>{regionCounts[i].toLocaleString()}</strong>listings</div>}</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ================== 07 SELL WITH US ================== */}
      <section className="sell" data-screen-label="07 Sell with us">
        <div className="wrap">
          <div className="sell-grid">
            <div className="sell-body">
              <div className="sell-kicker">Sell with Smartmove</div>
              <h2>Quietly placed in front of <em>the right buyer.</em></h2>
              <p>We list selectively and market discreetly. Your home is shown to a vetted, international network, not broadcast across forty portals. Honest pricing, professional film and stills, and a single advisor from valuation to completion.</p>
              <div className="sell-points">
                <div className="sp-pt"><span className="n">01</span><div><strong>Discreet, international reach</strong>Private database of active buyers across Europe, the Gulf and North America.</div></div>
                <div className="sp-pt"><span className="n">02</span><div><strong>Film, stills &amp; staging</strong>Every home presented to the standard of the listings on this site.</div></div>
                <div className="sp-pt"><span className="n">03</span><div><strong>One advisor, start to finish</strong>Valuation, legal, negotiation, completion, handled by one person who knows your home.</div></div>
              </div>
              <div className="sell-actions"><Link href="/contact" className="btn-gold">Request a valuation <ArrowR /></Link><Link href="/contact" className="btn-link">How we sell</Link></div>
            </div>
            <div className="sell-media">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/sm/listing-3.jpg" alt="A Smartmove-listed home" />
              {sold && (<div className="sell-badge"><div className="sb-n">{sold}</div><div className="sb-l">placed across the coast{founded ? ` since ${founded}` : ''}</div></div>)}
            </div>
          </div>
        </div>
      </section>

      {/* ================== 08 OUR GUIDES ================== */}
      <section className="guides" data-screen-label="08 Our guides">
        <div className="wrap">
          <div className="guides-head">
            <div><div className="gd-kicker">Buy with your eyes open</div><h2>The guides we <em>wish every buyer read first.</em></h2></div>
            <p className="gd-lede">Free, no email wall to read them. The honest version of buying on the Costa del Sol, written by the people who do it every week.</p>
          </div>
          <div className="guide-grid">
            {guides.map((g, i) => (
              <Link key={i} className="guide-card" href={g.href}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <div className="gc-photo"><img src={g.image} alt="" /><span className="gc-tagp">{g.tag}</span></div>
                <div className="gc-info"><h3>{g.title}{g.titleEm && <em>{g.titleEm}</em>}</h3><p>{g.blurb}</p><span className="gc-go">Read the guide <ArrowR /></span></div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ================== 06 TESTIMONIALS + PRESS ================== */}
      <section className="voices" data-screen-label="06 Testimonials & press">
        <div className="wrap">
          <div className="voices-head">
            <div><div className="vc-kicker">Trusted, and talked about</div><h2>The opinions that <em>matter most.</em></h2></div>
            {(rating || reviews) && (
              <div className="vc-rating">{rating && <div className="stars">★★★★★</div>}<div className="vc-rt">{rating && <>{rating} / 5{reviews ? ' · ' : ''}</>}{reviews && <span>{reviews} verified buyer reviews</span>}</div></div>
            )}
          </div>
          <div className="testi-grid">
            {TESTIMONIALS.map((t, i) => (
              <blockquote className="testi" key={i}><div className="stars">★★★★★</div><p>{t.quote}</p><div className="who"><span className="nm">{t.name}</span><span className="loc">{t.loc}</span></div></blockquote>
            ))}
          </div>
          <div className="press">
            <span className="press-l">As featured in</span>
            <div className="press-row">
              {PRESS.map((p, i) => (
                <Link className="press-item" href={p.href} key={i}><span className="pi-pub">{p.pub}</span><span className="pi-t">{p.quote}</span></Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ================== 09 SMARTMOVE DUBAI ================== */}
      <section className="dubai" data-screen-label="09 Smartmove Dubai">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="dubai-bg" src="/sm/dubai-burj.jpg" alt="Burj Al Arab, Dubai" />
        <div className="dubai-veil" />
        <div className="wrap">
          <div className="dubai-inner">
            <div className="dubai-body">
              <div className="dubai-kicker">Smartmove · Coming soon</div>
              <h2>The same hand on the table, <em>now in Dubai.</em></h2>
              <p>Our way of buying, honest, buyer-side, end to end, arrives on the Palm and beyond this autumn. Join the waitlist for first access to off-market homes and launch developments.</p>
              <DubaiCountdown />
              <div className="cd-target">Launching 1 September 2026</div>
            </div>
            <div className="dubai-waitlist">
              <div className="wl-card">
                <div className="wl-k">Join the waitlist</div>
                <h3>Be first <em>through the door.</em></h3>
                <DubaiWaitlist />
                <div className="wl-fine">No spam. One note when we open the doors.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter foundedYear={founded} years={years} />
    </div>
  );
}

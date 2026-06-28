/**
 * Static homepage content that isn't in the DB yet — testimonials, press
 * extracts, and the Guides fallback cards. Structured so it can be swapped
 * for a DB-backed source later (admin CRUD is a separate chunk). Copy is the
 * design's placeholder copy from Homepage v6.
 */

export interface Testimonial { quote: string; name: string; loc: string; }
export interface PressItem { pub: string; quote: string; href: string; }
export interface GuideCard { title: string; titleEm: string; blurb: string; tag: string; image: string; href: string; }

export const TESTIMONIALS: Testimonial[] = [
  {
    quote: 'They told us, on day one, that the home we were describing wasn’t for sale, then spent four months finding the one that was.',
    name: 'Henrik & Astrid L.',
    loc: 'Stockholm · Sierra Blanca',
  },
  {
    quote: 'The only agency that stayed on our side of the table. No pressure, no portal noise, just honest advice through to completion.',
    name: 'The Al-Rashid Family',
    loc: 'Dubai · Golden Mile',
  },
  {
    quote: 'A year after the keys they still take our calls, plumbers, paperwork, schools. That’s not normal here, and it mattered.',
    name: 'Charlotte & James W.',
    loc: 'London · Benahavís',
  },
];

export const PRESS: PressItem[] = [
  { pub: 'The Olive Press', quote: '“How a buyer-side agency is quietly reshaping Marbella’s top end.”', href: '#' },
  { pub: 'SUR in English', quote: '“Smartmove named Best Luxury Real Estate Boutique in Spain.”', href: '#' },
  { pub: 'Marbella Now', quote: '“The advisors the Costa’s repeat buyers keep coming back to.”', href: '#' },
];

/** Rendered when blog_posts has no guide-category posts yet. */
export const GUIDES_FALLBACK: GuideCard[] = [
  { title: 'Buying on the Costa del Sol, ', titleEm: 'end to end.', blurb: 'Every step from first viewing to the keys, plus the costs nobody quotes up front.', tag: 'Buyer’s guide', image: '/sm/listing-2.jpg', href: '/blog' },
  { title: 'Taxes, NIE, and the ', titleEm: 'true cost of ownership.', blurb: 'Transfer tax, notary, lawyer, IBI and the annual running costs, in plain numbers.', tag: 'Tax & legal', image: '/sm/region-marbella.webp', href: '/blog' },
  { title: 'Which region ', titleEm: 'actually fits your life.', blurb: 'Schools, flight times, summer crowds and winter quiet, region by region.', tag: 'Area atlas', image: '/sm/region-estepona.jpg', href: '/blog' },
];

/** Five fixed regions for the Areas tease — each links to /areas/[slug]. */
// Counts are computed live (countPublishedInArea) so the tile equals the
// /properties?area=… click-through; no hardcoded per-tile numbers here.
export const REGIONS = [
  { slug: 'marbella', bg: 'r-marbella', index: 'I · ', indexEm: 'flagship', name: 'Marbella ', nameEm: 'Centro & Golden Mile', feature: true },
  { slug: 'estepona', bg: 'r-estepona', index: 'II', indexEm: '', name: 'Estepona', nameEm: '', feature: false },
  { slug: 'mijas', bg: 'r-sotogrande', index: 'III', indexEm: '', name: 'Mijas ', nameEm: '& East', feature: false },
  { slug: 'benahavis', bg: 'r-benahavis', index: 'IV', indexEm: '', name: 'Benahavís', nameEm: '', feature: false },
  { slug: 'nueva-andalucia', bg: 'r-fuengirola', index: 'V', indexEm: '', name: 'Nueva ', nameEm: 'Andalucía', feature: false },
] as const;

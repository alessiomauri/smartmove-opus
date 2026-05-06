/**
 * Site-wide feature flags.
 *
 * The site is built in two modes:
 *
 *   1. INFO MODE (default, current state):
 *      - Site is a Marbella real estate information source
 *      - Tools, calculators, area guides, blog, market reports — all public
 *      - Property listings + property detail pages + favourites = HIDDEN
 *      - Admin is unaffected (you keep adding inventory)
 *      - The /property/[slug] URLs return 404 to public visitors
 *      - Logged-in admins see the property pages as a live "preview"
 *
 *   2. REAL ESTATE MODE (after launch):
 *      - Property listings are public
 *      - Homepage shows the property grid
 *      - Favourites + share works
 *      - Property URLs work
 *      - Sitemap includes property URLs
 *      - robots.txt allows /property/*
 *
 * To go live with property listings, follow `docs/GOING_PUBLIC_CHECKLIST.md`.
 * The TL;DR is: flip `PROPERTIES_PUBLIC` to `true` and deploy. The checklist
 * covers the few cleanup items (sitemap entries become live automatically;
 * robots disallow is conditional on this flag and clears automatically too).
 *
 * THE CURRENT HOMEPAGE + PROPERTY DETAIL CODE IS PRESERVED EXACTLY AS IT WAS.
 * Nothing was deleted — only gated. Flipping the flag restores everything
 * bit-for-bit.
 */
export const PROPERTIES_PUBLIC = false;

/**
 * Lead capture (newsletter + WhatsApp combined CTA on the homepage).
 *
 * When `false` (default for pre-launch):
 *   - The conversion card after the About section is hidden entirely
 *   - Footer social icons remain (they're brand presence, not lead capture)
 *   - Site reads as 100% informational — no asks anywhere
 *
 * When `true`:
 *   - Single combined Newsletter + WhatsApp card renders
 *   - Positioned after About so readers have built trust before being asked
 *
 * Conversion-research-driven placement: ONE primary CTA, end-of-content,
 * post-trust-section. Avoids the multi-CTA choice paralysis that hurts
 * editorial sites.
 */
export const LEAD_CAPTURE_ENABLED = true;

/**
 * Other future flags that may live here. Consolidating in one file makes
 * pre-launch checklists simple — review this file before going live.
 */
// export const COLLECTIONS_PUBLIC = true;     // already public
// export const NEW_DEVELOPMENTS_PUBLIC =       // see src/app/new-developments/feature-flag.ts

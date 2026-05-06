# Marbella Live — Design System

The brand language for Marbella Live: **understated luxury, modernist serenity, Mediterranean colour palette**. The site should feel like a high-end boutique brochure, not a real-estate listing portal. Generous whitespace, refined typography, slow elegant animations.

---

## 1. Colour Palette

All canonical colours live as CSS variables in `src/app/globals.css` and as exported tokens in `@theme inline`.

### Brand colours

| Token | Hex | RGB | Use |
|---|---|---|---|
| `--teal` | `#3c9ba7` | `60, 155, 167` | Primary brand. Logos, links, focus rings, CTAs, headings on white, hover accents |
| `--teal-dark` | `#358d98` | `53, 141, 152` | Hover state for teal CTAs / links |
| `--teal-light` | `#4aabb7` | `74, 171, 183` | Gradient stops, subtle highlights |
| `--bone` | `#faf9f8` | `250, 249, 248` | Page background — slightly warm off-white, never pure white |
| `--bone-light` | `#faf9f7` | `250, 249, 247` | Card surfaces inside bone backgrounds |
| `--text-dark` | `#2e2e2e` | `46, 46, 46` | All body and heading text. **Never pure black.** |
| `--text-gray` | `#666666` | `102, 102, 102` | Secondary text |
| `--text-light` | `#999999` | `153, 153, 153` | Tertiary, captions, helper text |
| `--border-light` | `#e5e5e5` | `229, 229, 229` | Subtle hairlines |

### Map pin palette (`AreasLeafletMap`)

Defined in `src/components/areas/AreasLeafletMap.tsx`:

| Category | Fill | Stroke | Radius | Weight |
|---|---|---|---|---|
| `main` (towns / headline areas) | `#3c9ba7` | `#ffffff` | 10 | 2 |
| `micro` (neighbourhoods / urbanisations) | `#ffffff` | `#3c9ba7` | 4.5 | 1.75 |
| `resort` (Puente Romano, La Zagaleta, etc.) | `#9a8568` | `#ffffff` | 6.5 | 1.75 |
| `airport` (transit reference, Malaga) | `#546d85` | `#ffffff` | 7 (22px icon) | 2 |

### Status colours (property state)

Properties carry one of five `status` values; these are styled with low-opacity backgrounds + the body text colour:

| Status | Tone | Visual treatment |
|---|---|---|
| `available` | Default | No tinting |
| `sold` | Warm grey overlay | Card image gets `saturate-[0.3] brightness-[0.85]` |
| `under_offer` | Same as sold | Same desaturation |
| `reserved` | Same as sold | Same desaturation |
| `coming_soon` | Default | No tinting; status badge in top-right |

The status badge sits top-right on every PropertyCard; in unavailable states it switches from teal-on-hover to dark-glass.

---

## 2. Typography

Three families, loaded via `next/font/google` in `src/app/layout.tsx` with `display: 'swap'` so text never blocks render.

| Font | CSS variable | When to use |
|---|---|---|
| **Gloock** (serif, display) | `--font-gloock` (alias `font-gloock`) | All headings, property names, area headings, brand wordmark |
| **Jost** (sans, body) | `--font-jost` | Default body text |
| **Geist** (sans, ui) | `--font-sans` | Form inputs, admin UI, where Jost would feel too character-rich |
| **Inter** | `--font-inter` (`font-sans` fallback alias) | Loaded but used sparingly; same role as Geist |

### Type scale (rough convention)

These are the recurring sizes. They're not codified as Tailwind tokens — most components use one-off arbitrary values for fine control.

- **Hero / display**: `text-[110px]` desktop → `text-5xl` mobile (Gloock, leading `0.9`, tracking `-0.02em`)
- **Section heading**: `text-[28px]` → `text-[44px]` (Gloock)
- **Property name (card)**: `text-[22px]` → `text-[26px]` (Gloock)
- **Body**: `text-[14px]` to `text-[16px]` (Jost)
- **Eyebrow / overline**: `text-[10px]` to `text-[11px]` uppercase, `tracking-[0.1em]` to `tracking-[0.25em]`
- **Caption / specs**: `text-[13px]` to `text-[15px]`, often with `font-semibold` numerals

### Letter-spacing convention

- Display headings: `tracking-tight` or `tracking-[-0.02em]`
- Body: default
- Eyebrows and uppercase labels: `tracking-[0.1em]` to `tracking-[0.25em]` (the wider the more luxurious-feeling)

---

## 3. Spacing & Layout

### Container widths

The site has one canonical max-width: **1600px**. Always use `max-w-[1600px] mx-auto` on outer wrappers.

Padding inside the container:
- Mobile: `px-6` (1.5rem)
- Tablet: `px-8`
- Desktop: `px-10` to `px-12`

### Vertical rhythm

- Section gaps: `py-12` to `py-20` (sometimes `py-32` for hero spacing)
- Component-internal padding: `p-5` for cards, `p-8` for hero panels, `p-12+` for editorial sections

### Border radius

- Cards: `rounded-[6px]` (very subtle, the brand favours sharp luxury over plump friendliness)
- Pills / badges / buttons: `rounded-full`
- Form inputs: `rounded-md` (Tailwind default)
- Hero panels / featured cards: `rounded-xl` to `rounded-2xl`

---

## 4. Shapes & Geometry

- Property cards have a **2.5px gradient teal accent strip at the top** when featured (`bg-gradient-to-r from-[#3c9ba7] via-[#4aabb7] to-[#3c9ba7]/40`)
- Featured cards also wear a `ring-1 ring-[#3c9ba7]/20` halo
- Hover state lifts cards by `-translate-y-1.5` over 500ms
- Image zoom on card hover: `scale-100 → scale-[1.05]` over 700ms
- Glass surfaces (header, modals, cookie banner): `backdrop-blur-md` to `backdrop-blur-xl`, `bg-white/85` to `bg-white/95`
- Subtle bottom corner triangle accent on PropertyCard hover (16×16, teal gradient)

---

## 5. Animation Vocabulary

All animations live in `src/app/globals.css`. The brand voice is **slow, smooth, never jittery**. No spring physics. Use `cubic-bezier(0.25, 0.46, 0.45, 0.94)` (Material's easeInOutSine alternative) or `cubic-bezier(0.16, 1, 0.3, 1)` (more dramatic decay) for almost everything.

| Class | Purpose | Duration |
|---|---|---|
| `.animate-fade-in` + `.stagger-{1..6}` | Card grid entrance | 400ms with 50ms stagger |
| `.animate-hero-zoom` | Slow zoom on property hero image | 8s |
| `.animate-slide-up` | Hero text slide-in | 800ms with 300ms delay |
| `.animate-expand-width` | Decorative line drawing (under hero text) | 600ms with 600ms delay |
| `.animate-fade-in-delayed` | Late-arriving subtitle / accent | 600ms with 1s delay |
| `.animate-scroll-line` | Pulsing scroll indicator | 2s loop |
| `.animate-reveal-up` | Generic content reveal-from-below | 800ms |
| `.animate-blur-in` | Image blur-up replacement (mostly via Next/Image now) | 800ms |
| `.animate-fade-scale` | Image fade-in with subtle shrink | 1s |
| `.animate-pulse-glow` | Soft teal halo pulse on interactive elements | 3s loop |
| `.animate-bounce-subtle` | Scroll arrow nudge | 2s loop |
| `.animate-float-slow` | Decorative orb drift in header | 12s loop |
| `.animate-line-reveal` | Horizontal line scaleX reveal | 600ms |
| `.text-shimmer` | Luxury teal gradient shimmer through text | 4s loop |

### Header animations

The sticky header (`.header-glass`) carries:
- A 2px gradient border that flows horizontally (`.header-gradient-border`, 6s loop)
- A diagonal shimmer sweep across the surface (`.header-shimmer`, 8s loop)
- Floating decorative blur orbs (`.animate-float-slow`)

These are all decorative and `pointer-events-none`.

---

## 6. Shadow Scale

| Class | Use |
|---|---|
| `shadow-luxury` | Standard floating cards (`0 4px 20px -4px rgba(0,0,0,0.08)`) |
| `shadow-premium` | Elevated panels, modals (`0 8px 32px -8px rgba(0,0,0,0.12)`) |
| `shadow-[inset_0_0_0_1.5px_rgba(60,155,167,0.25)]` | PropertyCard hover ring |

The card hover state stacks a soft outer glow + inset teal ring; see `PropertyCard.tsx`.

---

## 7. Iconography

- **Primary set**: `lucide-react` — clean line icons, `strokeWidth={1.5}` (lighter than default for the luxury feel)
- **Sizes**: 14–22px in body UI, 10–12px inside badges, 32–48px in feature illustrations
- **Colour**: inherit from text (`stroke="currentColor"`) so colour transitions on hover

Inline SVGs are used for one-off marks (the Featured star polygon, the airport pin icon).

---

## 8. Voice and Copy

- Headings use sentence case in English: "Luxury Properties in Marbella", not "Luxury Properties In Marbella"
- Eyebrows and tags use UPPER CASE TRACKED LETTERING: "EXCLUSIVE PROPERTY", "MARBELLA · COSTA DEL SOL"
- Prices are formatted as `€9.980.000` (European thousands with `.`, see `formatPrice` in `src/lib/utils.ts`)
- Specs use lowercase units: `8 bed · 10 bath · 958 m² · 3.631 plot`
- Locations are written in English with native diacritics where natural: `Nueva Andalucía`, `Benahavís`, `Puerto Banús`

---

## 9. Tone for new components

When building anything new, ask:
1. Does it have **enough whitespace** that it could appear in a coffee-table monograph?
2. Are colours **muted and warm**, not punchy?
3. Are transitions **>=300ms** with smooth easing? Anything <200ms feels cheap.
4. Are headings in **Gloock**? Body in **Jost** or **Geist**?
5. Does it use the **#3c9ba7 teal** as the only accent, never red/blue/green/yellow?

If you're tempted to add a fifth colour, a 200ms snappy transition, or an icon set with thick strokes — pause and reconsider.

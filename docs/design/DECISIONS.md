# Design decisions ledger

One line per locked decision. Dated. Newest at the top.

## 2026-05-07

- **Brand foundation locked**: direction "Costa Editorial × Editorial Slate" v1.1. Warm paper background (`#F7F3EC`) + warm near-black ink (`#1C1A17`) + unified gold family (`#cbaa65` primary CTA, `#b89653` hover, `#e8d4a2` highlight, `#f3e8cc` tint). Slate (`#5C6770`) as supporting role. Solid gold buttons that deepen on hover (no gradients). Awards row: two-up layout with editorial pull-quote citations.
- **Typography locked**: Cormorant Garamond (display, weights 300–600 + italic) + Manrope (body, 300–800). Type scale 12 → 96px on a perfect-fourth ratio (≈1.333). Loaded via next/font; tokens reference `var(--font-cormorant)` / `var(--font-manrope)`.
- **System scale locked**: 8-point spacing (with 4px fine work), restrained radii (max 12px + pill), low-blur shadows, three container widths (1400 default / 960 narrow / 1760 wide).
- **Mobile pass**: pending — user driving with Claude Design.
- Phase 3a scaffold landed: `docs/design/tokens.css` placeholder swapped for the locked v1.1; `globals.css` consumes it via `@import`. Smartmove tokens use a flat `--sm-<name>` convention (e.g. `--sm-paper`, `--sm-ink`, `--sm-gold`) rather than category-prefixed.
- Locale routing: shared property slugs across EN/ES; localized path words (`/property` ↔ `/propiedad`, `/areas` ↔ `/zonas`, `/new-developments` ↔ `/desarrollos-nuevos`, `/collection` ↔ `/coleccion`, `/favourites` ↔ `/favoritos`); EN as default locale.

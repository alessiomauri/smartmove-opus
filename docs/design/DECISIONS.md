# Design decisions ledger

One line per locked decision. Dated. Newest at the top.

## 2026-05-07
- Phase 3a scaffold landed: `docs/design/tokens.css` placeholder set (white bg + near-black fg + warm gold accent per CLAUDE_DESIGN_BRIEF §9 starting points), `globals.css` consumes it. All token names follow `--sm-<category>-<name>` convention. Replacement happens via brand-foundation conversation with Claude Design.
- Locale routing: shared property slugs across EN/ES; localized path words (`/property` ↔ `/propiedad`, `/areas` ↔ `/zonas`, `/new-developments` ↔ `/desarrollos-nuevos`, `/collection` ↔ `/coleccion`, `/favourites` ↔ `/favoritos`); EN as default locale.

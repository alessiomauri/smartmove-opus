# Smartmove Web

The Smartmove Marbella website rebuild. Forked from Marbella Live as the foundation, with a complete redesign and major upgrades for agency-grade scale (Resales Online API integration for tens of thousands of properties, Cloudflare R2 + Cloudflare Images pipeline, multi-language EN+ES day one, Monday CRM lead pipeline, integrated email property selection builder).

---

## READ FIRST

Before doing anything else, read these four briefs in order:

1. `~/Desktop/smartmove-web-briefs/SMARTMOVE_BRIEF.md` — the master brief: product context, all decisions locked in (Q1-Q6), exhaustive catalog of every Marbella Live function being inherited, all NEW Smartmove features, sync architecture, lead pipeline, infrastructure plan, phased roadmap
2. `~/Desktop/smartmove-web-briefs/RESALES_API_REFERENCE.md` — canonical Resales Online API V6 reference (every endpoint we use, full TypeScript shapes, multi-language behavior, sync strategy, image URL formats)
3. `~/Desktop/smartmove-web-briefs/RESALES_API_GAPS.md` — remaining unknowns (none blocking)
4. `~/Desktop/smartmove-web-briefs/CLAUDE_DESIGN_BRIEF.md` — design handoff for the separate Claude Design surface

---

## Reference data

- **Resales API sample responses** (10 JSON files showing real request/response pairs for every endpoint we use): `~/Desktop/smartmove-web-briefs/resales-samples/`
- **Brand assets** (logos, award badges, existing-site screenshots, competitor audits): `~/Desktop/smartmove-brand-assets/`
- **Marbella Live source** (read-only reference for the inherited code): `~/Desktop/marbella-live-v2/`
- **Marbella Live's per-system docs** (for understanding how each inherited feature works): `~/Desktop/marbella-live-v2/docs/`

---

## Where this project came from

This codebase is a clean rsync from `~/Desktop/marbella-live-v2/` taken on 2026-05-06 from the `info-mode-areas-cleanup` snapshot. Excluded from the copy: `node_modules`, `.next`, `.vercel`, `.git`, `docs-snapshots/`, `Area photos/`, `.env*`, `.claude/`, `.claudeignore`, `.mcp.json`, `tsconfig.tsbuildinfo`. Initial git commit captures this seed state — every subsequent commit is Smartmove-specific work.

---

## Critical constraints (in case you skim the briefs)

- **Sales-only**, residential luxury. No rentals, no commercial
- **EN + ES day one**, Resales supports 14 languages natively but **NOT Italian** (machine-translate Italian at sync time)
- **Lead pipeline**: local DB + Monday CRM only. **Monday integration is env-gated and disconnected at launch** — do not push to Monday in dev. **Resales' RegisterLead endpoint is OUT OF SCOPE forever** — do not implement
- **Sync architecture**: nightly cron at 3am CET + manual "sync now" + single-reference on-demand + approval workflow (auto-approve own properties, review-required for MLS-sourced)
- **Image strategy**: Cloudflare R2 + Cloudflare Images, proxied via a Cloudflare Worker. Two image URL formats coexist (older ASP, newer CDN); Worker handles both
- **Auth credentials in URL params** (`p1`, `p2`) → Cloudflare Worker proxy is **non-negotiable** to keep credentials out of browsers, server logs, referrer headers
- **Use placeholder images** (picsum.photos with seeded URLs) during dev. Real images come from Resales sync via Cloudflare Images later
- **Logo, colors, typography from Claude Design** (separate chat surface). Do not make brand decisions unilaterally; reference brand assets folder for current state
- **No buyer accounts**. Anonymous browsing only with localStorage favourites + encoded share URLs (Marbella Live pattern, ported verbatim)

---

## Next: Phase 2 from `SMARTMOVE_BRIEF.md`

Set up infrastructure: separate Supabase project, separate Vercel project, Cloudflare account for R2 + Images + Worker proxies, fresh GitHub repo. The brief walks through each.

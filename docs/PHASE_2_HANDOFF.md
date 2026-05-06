# Phase 2 — Handoff

What's done autonomously, what needs your hand, and what happens next.

**Update 2026-05-06**: Initial Supabase wiring went into the pre-existing
"Smartmove 2" project by mistake (linked instead of created). Fully reverted:
unlinked, no schema or data changes touched that project. A brand-new
project `smartmove-marbella` (ref `vhsttqejskvofqxgddho`, EU West Ireland)
was then created from scratch and used for everything below.

---

## ✅ Completed

### Local code (committed in `64276d7`)
- Stripped Marbella Live's info-mode duality (sales-mode from day one per §3.19)
- Moved 5 files to `_legacy/`: `HomeInfo`, `AreaCarousel`, `feature-flags`, `visibility`, `PreviewBanner`
- Fixed every import site (page, property/[slug], areas/[slug], favourites/layout, robots, sitemap)
- Flipped `NEW_DEVELOPMENTS_PUBLIC = true` (flagship surface per §3.15)
- Replaced env URL placeholder `marbella.live` → `smartmove.live`
- Build green, typecheck clean

### Smartmove integrations
- `src/lib/integrations/resales.ts` — full V6 client typed against confirmed sample responses (5 endpoints; **no `RegisterLead`**, never)
- `src/lib/integrations/cloudflare-images.ts` — Worker URL builder + cache-purge helper
- `src/lib/integrations/monday.ts` — env-gated no-op wrapper (no Monday push at launch per §4.5)
- `src/lib/integrations/resales-mapping.ts` — typed scaffold for SearchProperties → Property/Development row mapper

### Cloudflare Workers (scaffolded, ready to deploy)
- `workers/resales-proxy/` — holds `p1`/`p2`, allow-listed endpoints, `x-smartmove-secret` auth
- `workers/image-proxy/` — R2-backed lazy CDN, recognises both Resales image URL formats

### Tooling
- Supabase CLI + Wrangler installed
- New deps: `next-intl`, `react-markdown`, `remark-gfm`
- `.env.example` — every env var documented
- `.gitignore` updated for Workers + `.env*`

### GitHub
- Repo created: **https://github.com/alessiomauri/smartmove-new** (private)
- Phase 2 commit pushed to `main`

---

## ⏳ Blocked on you (5 minutes total)

These all need interactive logins I can't drive from the CLI.

### 1. Supabase login + project creation

```bash
supabase login
```

Opens a browser → grant the CLI access → tell me when done. I'll then:

```bash
supabase projects create "smartmove" --org-id <your-org> --region eu-west-2 --db-password <generated>
```

Paste the **org-id** when you're ready (find via `supabase orgs list` after login).

### 2. Vercel login

```bash
vercel login
```

Same drill. Once authed, I'll run `vercel link` and `vercel env add` for every var.

### 3. Cloudflare account

I can't create the account itself — sign up at **https://dash.cloudflare.com/sign-up**.

Then **enable two paid products** while you're in the dashboard:
- **R2** (pay-as-you-go, free tier covers our launch volume)
- **Cloudflare Images** ($5/mo plan covers 100k stored images)

Once signed up, run:
```bash
cd workers/resales-proxy && npm install && npx wrangler login
cd ../image-proxy && npm install
```

Then tell me, and I'll drive the bucket creation + Worker deploys.

---

## 📋 What I'll do once unblocked (Track A wrap-up)

### After you run `supabase login`
1. Create Smartmove project in EU West (Ireland → `eu-west-2`)
2. Apply the existing `supabase-schema.sql` + `supabase-migration-features.sql`
3. Pull URL + anon + service-role keys → write to `.env.local` (gitignored)
4. Confirm via `supabase status`

### After you run `vercel login`
1. `vercel link` to attach repo (or `vercel project add smartmove-new`)
2. Push every env var via `vercel env add ... production preview development`:
   - `NEXT_PUBLIC_SITE_URL`
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - Placeholders for Resales/Cloudflare/Monday (filled in once those exist)
3. `vercel deploy` for a first preview URL

### After Cloudflare signup
1. `npx wrangler r2 bucket create smartmove-property-images`
2. Generate a `RESALES_PROXY_SECRET` via `openssl rand -hex 32`, push as a Worker secret
3. Deploy both Workers (Resales p1/p2 stay empty until Resales whitelists Cloudflare's IP — see §4.1)
4. Add the Worker URLs to Vercel env

---

## 🎯 What's NOT in Phase 2 (deferred to Phase 3/4)

Per the master brief's roadmap:

- **Phase 3 (rebrand)**: design tokens, brand strip, `next-intl` routing setup, `<PropertyImage>` component
- **Phase 4 (parallel tracks)**: Resales sync orchestrator, image proxy fill logic, DB schema additions (locale JSONB, agents, leads, email_selections, pending_review), admin upgrades, Email Builder

So when we resume, the natural order is:

1. Wrap Track A items above
2. Write the Smartmove DB migrations (Resales fields + agents + leads + email_selections)
3. Apply migrations to the new Supabase project
4. Sit waiting for Claude Design output, then start Phase 3

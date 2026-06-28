# Opus — Standalone Entity: Deployment & Productionization

> **Supersedes the earlier draft.** The previous version assumed merging Opus into the original
> production (merge to `main` + migrations on the live DB). That is now **void**. Per Alessio's
> decision, Opus is a **completely separate entity** and the originals are **frozen**.

## Principle — originals are OFF-LIMITS (never touched)

- **Repo:** `fable-baseline` (github `alessiomauri/smartmove-new`) — read-only. No merge of Opus
  into it, ever.
- **Vercel:** the `smartmove-new` project — never deploy Opus here.
- **Supabase:** the original live project `vhsttqejskvofqxgddho` — never migrate or write here.

No merge to `main`. No migrations on the original DB. Opus stands on its own stack.

## The Opus stack

- **Repo:** `github.com/alessiomauri/smartmove-opus` (`origin`), trunk `opus-4.8`.
- **Vercel:** `smartmove-opus-dev` (to be Git-connected to the new repo).
- **Supabase:** the clone `wbqjaxsbflcrqmpcrmtj` (Opus's own database).
- **Shared, read-only infra:** the Resales relay (`167.233.98.46`) + the image-proxy worker —
  currently shared with the original. See the sync caveat (step 3).

## Status now

Code is on the new repo. The staging deploy (`smartmove-opus-dev`) validated prod build, geo
capture, RLS, and public lead capture against the clone. Crons are OFF (no `CRON_SECRET`) and
Resend is OFF — both intended until productionization.

---

## Steps to make Opus a real, self-sustaining entity (each gated — do when ready)

### 1. Vercel ↔ Git
- Connect `smartmove-opus-dev` to the new repo, branch `opus-4.8`, so it auto-deploys on push
  (today's deploy was a one-off CLI snapshot).
- Replicate the env block to the Preview environment if you want branch previews.
- Consider the **Pro plan** for cron support + warmer functions — the ~4.2s `/admin/inventory`
  load was hobby cold-start; re-measure on Pro before judging the latency target.

### 2. Database — clean the clone for real use
- Purge the **~11k synthetic perf rows** (slug suffix `-perf<N>`) and the **test data** (test
  agents / leads / selections / demo featured) so the DB holds only clean real data.
- ⚠️ The clone's listing data is a **stale snapshot** (copied at clone time; the original's
  nightly sync has moved on since). To stay current, Opus needs its **own** sync (step 3).
- Hygiene option for later: keep this as Opus-DEV and stand up a separate Opus-PROD DB. One DB
  is fine to start.

### 3. Opus's own Resales sync (only when you want live-fresh data)
- Arm it by setting `CRON_SECRET` on the Opus Vercel project; the existing `vercel.json` crons
  (03:00 sync, Sun 04:30 reconcile) then run against the clone. A one-time full import gives
  Opus the full current feed independently.
- ⚠️ **Shared Resales account caveat:** the relay holds ONE production Resales key (one
  whitelisted IP). If Opus syncs while the original *also* syncs, you **double the API load on
  the same Resales account** — and Resales monitors for "unusual activity." Don't arm both
  blindly: pause the original's cron, stagger them, or treat the original as the syncer until
  Opus formally takes over.

### 4. Email (Resend) for Opus
- Add `RESEND_API_KEY` to the Opus Vercel project; set the notification address; verify a real
  send. Domain auth (SPF/DKIM/DMARC) before any client-scale sending.

### 5. Verification gates (on the Opus stack)
- Prod build green; `/admin/inventory` latency acceptable **warm** (off hobby cold-start).
- Geo populates; public lead capture works with RLS on; agent isolation holds; image proxy
  serves listing photos.

### 6. Curation
- On the cleaned clone, feature real trophy listings and ensure no demo seed (Villa Amara)
  shows on the homepage.
- **Homepage "Explore" picks must be curated before public launch.** Each card resolves:
  `homepage-explore-*` curated list → top `is_featured` villa/development → **build-time DESIGN
  PLACEHOLDER**. The placeholder must NOT ship to real visitors, so the two `homepage-explore`
  lists (or featured villa/dev items) must hold real listings before go-live. See the
  `TODO(go-live)` in `src/lib/home-explore.ts`.

### 7. Endgame — DEFERRED decision
If Opus becomes the **real** public site, point `smartmovemarbella.com` at the Opus Vercel
project and run the SEO migration (`MIGRATION_301_MAP.md`). Until that call, Opus runs on its
`.vercel.app` URL as an independent entity and the original is left exactly as-is.

---

## Open strategic question (sets how far down 3–7 to go now)

Is Opus the **intended future real site** (Fable is blocked → productionize fully: own sync,
own email, plan the domain migration), or a **parallel sandbox** (stop at a deployable staging
entity and decide later)? That choice sets the scope of the steps above.

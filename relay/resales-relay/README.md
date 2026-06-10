# Resales fixed-IP relay

Minimal Node service that fronts the Resales Online API with a **static
egress IP**, because Resales whitelists exactly one IP per key (no
ranges; confirmed by support 2026-06-10 — they don't accommodate
Cloudflare Workers' shared egress pool). This is the
SMARTMOVE_BRIEF Q1 Phase 2 fallback, now the primary path.

```
Vercel app ──x-smartmove-secret──▶ Caddy (TLS, :443)
                                     └─▶ relay (node, 127.0.0.1:8787)
                                           └─▶ webapi.resales-online.com (+p1+p2+P_sandbox)
```

Behaviour is a 1:1 port of `workers/resales-proxy`: same inbound secret
header, same endpoint allowlist (never `RegisterLead`), same credential
injection, same **error-body credential scrubbing** (`scrub.mjs` — kept
in sync with the worker's `scrub.ts`; the parity suite in
`workers/resales-proxy/test-scrub.mjs` runs identical assertions
against both). Nothing logs upstream URLs or bodies (both can carry
credentials).

## Current deployment

| | |
|---|---|
| Host | Hetzner VPS `167.233.98.46` (`ssh root@167.233.98.46`) |
| Hostname | `https://167-233-98-46.sslip.io` (sslip.io magic DNS + Let's Encrypt via Caddy) |
| Service | `systemd: resales-relay` (non-root user, hardened unit, `Restart=always`) |
| Credentials | `/etc/resales-relay/env` (0640, root:resales-relay) — never in the repo |
| Health | `GET /healthz` (no auth): `{ok, sandbox, uptime_s}` |
| Firewall | UFW: 22 (ssh) / 80 (ACME) / 443 (TLS) only; fail2ban on sshd; unattended-upgrades on |
| Mode | `RESALES_SANDBOX=true` until go-live (flip in the env file, then `systemctl restart resales-relay`) |

## Deploy / update

```bash
# from the repo root
scp relay/resales-relay/{server.mjs,scrub.mjs,Caddyfile,resales-relay.service,setup.sh} root@167.233.98.46:/opt/resales-relay/
ssh root@167.233.98.46 'bash /opt/resales-relay/setup.sh'   # idempotent
```

Credentials file (written once, by hand or via ssh stdin — values from
`workers/resales-proxy/.dev.vars` + the app's `RESALES_PROXY_SECRET`):

```
# /etc/resales-relay/env
RESALES_P1=…
RESALES_P2=…
RESALES_PROXY_SECRET=…        # same value the Vercel app sends
RESALES_SANDBOX=true
```

## Operations

```bash
ssh root@167.233.98.46 systemctl status resales-relay     # service state
ssh root@167.233.98.46 journalctl -u resales-relay -n 50  # logs (no creds ever)
curl https://167-233-98-46.sslip.io/healthz               # public health
# flip to production data:
ssh root@167.233.98.46 'sed -i "s/RESALES_SANDBOX=true/RESALES_SANDBOX=false/" /etc/resales-relay/env && systemctl restart resales-relay'
```

## Migrating off sslip.io to a real subdomain

When DNS access to `smartmovemarbella.com` exists:

1. A record: `resales-relay.smartmovemarbella.com → 167.233.98.46`
2. Edit the hostname in `/etc/caddy/Caddyfile` (and this repo's copy),
   `systemctl reload caddy` — the new cert issues automatically.
3. Update `RESALES_PROXY_URL` in Vercel (Production + Preview) and
   `.env.local`.

Nothing else changes; the relay is hostname-agnostic.

## Cloudflare worker fallback

`workers/resales-proxy` **stays deployed but idle** (its egress IP
isn't whitelisted → upstream returns `001`). It becomes useful again
only if Resales ever supports multiple IPs/ranges per key — then:
point `RESALES_PROXY_URL` back at the worker and decommission this VPS.

## If the key's whitelisted IP changes

The Resales whitelist points at THIS VPS's IP. Re-provisioning on a new
IP requires updating the whitelist in the Resales admin first, then the
sslip.io hostname (it encodes the IP) + `RESALES_PROXY_URL`.

#!/usr/bin/env bash
# Idempotent provisioning for the Resales relay VPS (Ubuntu 24.04+).
#
# Run ON the VPS as root, from /opt/resales-relay (files already copied):
#   bash setup.sh
#
# Expects /etc/resales-relay/env to exist already (written separately —
# never ships in the repo). Installs: node, caddy, ufw, fail2ban,
# unattended-upgrades; creates the service user; enables everything.

set -euo pipefail

echo "── packages ──"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq nodejs ufw fail2ban unattended-upgrades curl debian-keyring debian-archive-keyring apt-transport-https >/dev/null

# Caddy (official repo — not in Ubuntu main)
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --batch --yes --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq
  apt-get install -y -qq caddy >/dev/null
fi
node --version && caddy version | head -1

echo "── service user + permissions ──"
id -u resales-relay >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin resales-relay
chown -R root:root /opt/resales-relay
chmod 755 /opt/resales-relay
chmod 644 /opt/resales-relay/*.mjs

# Credentials: readable by the service user ONLY.
chown root:resales-relay /etc/resales-relay/env
chmod 0640 /etc/resales-relay/env

echo "── firewall (22 ssh, 80 ACME, 443 tls) ──"
ufw allow 22/tcp >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null
ufw status | head -8

echo "── fail2ban (sshd jail) + unattended upgrades ──"
systemctl enable --now fail2ban >/dev/null
printf 'APT::Periodic::Update-Package-Lists "1";\nAPT::Periodic::Unattended-Upgrade "1";\n' \
  > /etc/apt/apt.conf.d/20auto-upgrades
systemctl enable --now unattended-upgrades >/dev/null 2>&1 || true

echo "── relay service ──"
cp /opt/resales-relay/resales-relay.service /etc/systemd/system/resales-relay.service
systemctl daemon-reload
systemctl enable --now resales-relay
sleep 1
systemctl is-active resales-relay

echo "── caddy (TLS) ──"
cp /opt/resales-relay/Caddyfile /etc/caddy/Caddyfile
systemctl enable --now caddy
systemctl reload caddy || systemctl restart caddy
systemctl is-active caddy

echo "── done — local healthz ──"
curl -s http://127.0.0.1:8787/healthz && echo ""

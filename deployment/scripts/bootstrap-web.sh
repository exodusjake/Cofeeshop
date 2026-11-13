#!/usr/bin/env bash
# One-time setup of the WEB EC2 (Amazon Linux 2023). Run as root:  sudo bash bootstrap-web.sh
set -euo pipefail
dnf install -y nginx nodejs20 git certbot python3-certbot-nginx   # Node 20 LTS from AL2023 repos (use nvm/NodeSource for newer)
id nocturne &>/dev/null || useradd --system --home /opt/nocturne --shell /sbin/nologin nocturne
mkdir -p /opt/nocturne/web /etc/nocturne
chown -R nocturne:nocturne /opt/nocturne

[[ -f /etc/nocturne/web.env ]] || cat > /etc/nocturne/web.env <<'EOF'
# Private address of the API EC2 (security group allows 5000 only from this server's SG)
API_INTERNAL_URL=http://API_PRIVATE_IP:5000
EOF
chmod 640 /etc/nocturne/web.env

cp "$(dirname "$0")/../systemd/nocturne-web.service" /etc/systemd/system/
cp "$(dirname "$0")/../nginx/nocturne.conf" /etc/nginx/conf.d/nocturne.conf
systemctl daemon-reload
systemctl enable nginx nocturne-web
echo "Next: edit /etc/nocturne/web.env and /etc/nginx/conf.d/nocturne.conf (domain + API_PRIVATE_IP), run certbot, then deploy-web.sh"

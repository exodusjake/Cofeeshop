#!/usr/bin/env bash
# usage (on Web EC2, as root):  bash deploy-web.sh /tmp/web.tar.gz
set -euo pipefail
PKG="${1:?path to web.tar.gz}"
rm -rf /opt/nocturne/web.new && mkdir -p /opt/nocturne/web.new
tar -xzf "$PKG" -C /opt/nocturne/web.new
chown -R nocturne:nocturne /opt/nocturne/web.new
systemctl stop nocturne-web || true
rm -rf /opt/nocturne/web.old; [[ -d /opt/nocturne/web ]] && mv /opt/nocturne/web /opt/nocturne/web.old
mv /opt/nocturne/web.new /opt/nocturne/web
systemctl start nocturne-web
sleep 3; systemctl --no-pager status nocturne-web | head -5
nginx -t && systemctl reload nginx
curl -fsS -o /dev/null -w "web: HTTP %{http_code}\n" http://127.0.0.1:3000/menu

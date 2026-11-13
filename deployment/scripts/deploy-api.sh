#!/usr/bin/env bash
# usage (on API EC2, as root):  bash deploy-api.sh /tmp/api.tar.gz
set -euo pipefail
PKG="${1:?path to api.tar.gz}"
rm -rf /opt/nocturne/api.new && mkdir -p /opt/nocturne/api.new
tar -xzf "$PKG" -C /opt/nocturne/api.new
chown -R nocturne:nocturne /opt/nocturne/api.new
systemctl stop nocturne-api || true
rm -rf /opt/nocturne/api.old; [[ -d /opt/nocturne/api ]] && mv /opt/nocturne/api /opt/nocturne/api.old
mv /opt/nocturne/api.new /opt/nocturne/api
systemctl start nocturne-api            # applies EF migrations on boot when Database__AutoMigrate=true
sleep 8; systemctl --no-pager status nocturne-api | head -5
curl -fsS http://127.0.0.1:5000/api/health && echo

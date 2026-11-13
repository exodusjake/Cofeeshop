#!/usr/bin/env bash
# One-time setup of the API EC2 (Amazon Linux 2023, private subnet). Run as root via SSM Session Manager.
set -euo pipefail
dnf install -y aspnetcore-runtime-10.0 jq awscli unzip      # if the package is not yet in your AL2023 repo, use the dotnet-install script
# Trust the RDS certificate authority so Encrypt=True;TrustServerCertificate=False works
curl -fsS -o /etc/pki/ca-trust/source/anchors/rds-global-bundle.pem https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem
update-ca-trust
id nocturne &>/dev/null || useradd --system --home /opt/nocturne --shell /sbin/nologin nocturne
mkdir -p /opt/nocturne/api /opt/nocturne/scripts /etc/nocturne /var/nocturne/uploads
chown -R nocturne:nocturne /opt/nocturne /var/nocturne

D="$(dirname "$0")"
install -m 750 "$D/fetch-secrets.sh" /opt/nocturne/scripts/fetch-secrets.sh
[[ -f /etc/nocturne/api.env ]] || install -m 640 "$D/../systemd/api.env.example" /etc/nocturne/api.env
cp "$D/../systemd/nocturne-api.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable nocturne-api
echo "Next: edit /etc/nocturne/api.env, then run deploy-api.sh with the published build."

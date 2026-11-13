#!/usr/bin/env bash
# Runs as root via ExecStartPre. Builds /run/nocturne/secrets.env (tmpfs) from AWS Secrets Manager.
# Requires: aws cli v2, jq, and an instance role with secretsmanager:GetSecretValue on the two secrets.
set -euo pipefail
source /etc/nocturne/api.env
umask 077
OUT=/run/nocturne/secrets.env
REGION="${AWS_REGION:-$(curl -s -H "X-aws-ec2-metadata-token: $(curl -s -X PUT http://169.254.169.254/latest/api/token -H 'X-aws-ec2-metadata-token-ttl-seconds: 60')" http://169.254.169.254/latest/meta-data/placement/region)}"

DB=$(aws secretsmanager get-secret-value --region "$REGION" --secret-id "$NOCTURNE_DB_SECRET_ID" --query SecretString --output text)
DB_USER=$(jq -r .username <<<"$DB"); DB_PASS=$(jq -r .password <<<"$DB")

{
  # Escape for a systemd EnvironmentFile (double-quoted value)
  printf 'ConnectionStrings__DefaultConnection="Server=%s,1433;Database=%s;User Id=%s;Password=%s;Encrypt=True;TrustServerCertificate=False;"\n' \
    "$NOCTURNE_DB_HOST" "$NOCTURNE_DB_NAME" "$DB_USER" "$(sed 's/[\\"]/\\&/g' <<<"$DB_PASS")"
  if [[ -n "${NOCTURNE_APP_SECRET_ID:-}" ]] && APP=$(aws secretsmanager get-secret-value --region "$REGION" --secret-id "$NOCTURNE_APP_SECRET_ID" --query SecretString --output text 2>/dev/null); then
    jq -r 'to_entries[] | select(.key=="AdminEmail") | "Bootstrap__AdminEmail=\"\(.value)\""' <<<"$APP"
    jq -r 'to_entries[] | select(.key=="AdminPassword") | "Bootstrap__AdminPassword=\"\(.value)\""' <<<"$APP"
    jq -r 'to_entries[] | select(.key=="SmtpPassword") | "Smtp__Password=\"\(.value)\""' <<<"$APP"
  fi
} > "$OUT"
chown nocturne:nocturne "$OUT"; chmod 400 "$OUT"

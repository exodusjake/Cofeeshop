# Generates idempotent T-SQL from the EF Core migrations so the schema can be inspected in SSMS
# or applied to Amazon RDS with sqlcmd (no .NET tooling needed on the server).
#   usage:  pwsh database/scripts/02-generate-schema-sql.ps1
$ErrorActionPreference = "Stop"
$root = Resolve-Path "$PSScriptRoot/../.."
$out  = Join-Path $root "database/migrations/schema.sql"
dotnet ef migrations script --idempotent `
    --project "$root/backend/NocturneCafe.Infrastructure" `
    --startup-project "$root/backend/NocturneCafe.Api" `
    --output $out
Write-Host "Wrote $out"

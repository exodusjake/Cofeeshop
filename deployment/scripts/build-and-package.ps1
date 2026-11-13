# Builds both applications on your workstation / CI and packages them for upload.
#   pwsh deployment/scripts/build-and-package.ps1
# Output: dist/web.tar.gz (Next.js standalone) and dist/api.tar.gz (dotnet publish, linux-x64, framework-dependent)
$ErrorActionPreference = "Stop"
$root = Resolve-Path "$PSScriptRoot/../.."
$dist = Join-Path $root "dist"; Remove-Item $dist -Recurse -Force -ErrorAction SilentlyContinue; New-Item -ItemType Directory $dist | Out-Null

# ---- API ----
dotnet publish "$root/backend/NocturneCafe.Api" -c Release -r linux-x64 --self-contained false -o "$dist/api"
tar -czf "$dist/api.tar.gz" -C "$dist/api" .

# ---- Web (standalone output: server.js + minimal node_modules) ----
Push-Location "$root/frontend"
npm ci; npm run build
Pop-Location
$web = "$dist/web"; New-Item -ItemType Directory $web | Out-Null
Copy-Item "$root/frontend/.next/standalone/*" $web -Recurse
New-Item -ItemType Directory "$web/.next" -Force | Out-Null
Copy-Item "$root/frontend/.next/static" "$web/.next/static" -Recurse
Copy-Item "$root/frontend/public" "$web/public" -Recurse
tar -czf "$dist/web.tar.gz" -C $web .
Write-Host "Done. Upload dist/api.tar.gz to the API EC2 and dist/web.tar.gz to the Web EC2 (S3 or SSM), then run the deploy-*.sh scripts."

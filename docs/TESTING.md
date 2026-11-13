# Testing & troubleshooting

## Status of verification (read this first)
| Item | Status |
|---|---|
| Frontend `tsc --noEmit` and `next build` (40 routes) | ✅ passed in the authoring environment |
| Backend solution + test project **compile** (0 errors) | ✅ passed |
| Backend unit tests, API runtime, EF migration generation, SQL Server integration, browser E2E | ⛔ **not executed** in the authoring environment: Windows **Smart App Control** refused to load unsigned freshly-built .NET assemblies (`0x800711C7`), which blocks `dotnet run`, `dotnet test` and `dotnet ef`. |

So the checklist below is **yours to run** (about 20 minutes). Unblock options: disable Smart App Control, or run the backend in WSL2/Docker/another Windows machine without it. No application code needs to change.

## Automated
```powershell
cd backend; dotnet test         # 9 business-rule tests: server-side pricing, checkout, stock, order lifecycle, ownership, CMS draft/publish, validation
cd frontend; npx tsc --noEmit; npm run build; npm run lint
```

## Manual checklist (maps to the 20 required checks)
Prepare: DB created, `migrations add InitialCreate`, admin bootstrap secrets set, API + web running (see LOCAL-SETUP).

| # | Check | How to verify |
|---|---|---|
| 1 | Website loads | http://localhost:3000 shows hero, sections, footer |
| 2 | Registration saves to SQL Server | Sign up, then `SELECT Email, FullName FROM AspNetUsers` (03-verification-queries.sql); `PasswordHash` is a hash |
| 3 | Sign in / out | Sign in → navbar shows name; sign out → `/account` redirects to sign-in; cookie `nocturne.auth` is HttpOnly |
| 4 | Customers view products | `/menu` lists 21 items without logging in |
| 5 | Products come from API/DB | Change a price in SSMS → refresh `/menu` → new price |
| 6 | Cart prices correct | Large (+₱25) + Oat milk (+₱45) × 2 on a ₱185 latte = ₱510; tamper with the request price in DevTools → ignored (API ignores client prices) |
| 7 | Checkout creates SQL orders | After checkout: rows in `Orders`, `OrderItems`, `Payments`, `OrderStatusHistory` |
| 8 | Admin reaches dashboard | Admin sign-in → `/admin` shows KPIs and charts |
| 9 | Customers cannot use admin | As a customer: `/admin` shows "Access denied"; `GET /api/admin/dashboard` → **403**; anonymous → **401** |
| 10 | Admin adds/edits products | Admin → Products → New product / Edit; audit log records it |
| 11 | Changes appear on public menu | Toggle "Available" off → item vanishes from `/menu` immediately; archive → gone |
| 12 | Admin edits homepage | Content Management → Hero → change title → **Save draft** |
| 13 | Published changes appear publicly | Public home unchanged until **Publish**; then new title shows. **Preview** shows the draft |
| 14 | Disabled sections disappear | Toggle Gallery OFF → Save → Publish → homepage no longer shows Gallery (SQL: `PublishedIsEnabled=0`) |
| 15 | Customers track orders | `/order-tracking/{id}` shows stepper; refreshes every 15 s |
| 16 | Admin changes statuses | Admin → Orders → Confirm → Preparing → Ready/Out for delivery → Completed; the customer page updates; completed order earns reward points |
| 17 | Mobile | DevTools device mode (375 px): nav drawer, menu grid, checkout, admin drawer + scrolling tables |
| 18 | Web EC2 reaches API EC2 | AWS checklist: `curl http://<api-private-ip>:5000/api/health` from EC2 #1 |
| 19 | API EC2 reaches RDS | Same call returns `"database":"connected"`; migrations in `journalctl` |
| 20 | Browser cannot reach RDS | `Test-NetConnection <rds-endpoint> -Port 1433` from outside the VPC fails; RDS `PubliclyAccessible=false` |

Extra security spot-checks: wrong password ×5 → lockout (429); POST without `X-CSRF-TOKEN` → 400; upload a `.txt` renamed `.png` → rejected (magic-byte check); order id of another user → 404; Cancel-by-customer only while `Pending`; disabling a user in admin signs them out on their next request.

## Troubleshooting
| Problem | Cause / fix |
|---|---|
| `0x800711C7 Application Control policy has blocked this file` | Smart App Control (see above) |
| API exits immediately: `ConnectionStrings:DefaultConnection is not configured` | Set it (appsettings.Development.json / user-secrets / `ConnectionStrings__DefaultConnection`) |
| `Login failed for user` / `Cannot open server` on RDS | api-sg not allowed in db-sg, wrong secret, or RDS CA not trusted (`update-ca-trust`); check `Encrypt=True;TrustServerCertificate=False` |
| 400 on every POST | CSRF token missing. Browser: hard refresh. curl: `GET /api/auth/csrf` and send the cookie jar + `X-CSRF-TOKEN` |
| Cookies not set behind Nginx | `Auth__SecureCookies=true` requires HTTPS; ensure Nginx sends `X-Forwarded-Proto`; use HTTPS |
| Images 404 | Uploads live in `Storage__RootPath` on the API host; check it exists/is writable by `nocturne` |
| No verification email | SMTP not configured (dev: look in `App_Data/outbox`); SES sandbox restrictions in prod |
| Home page shows "couldn't reach the café" | Web server can't reach `API_INTERNAL_URL` (SG, wrong IP, API down) |
| `502 Bad Gateway` from Nginx | API/Next.js service down: `systemctl status nocturne-api nocturne-web` |
| Homepage is blank "We'll be right back" | Someone clicked **Unpublish**; click **Publish** |

# Local development

## 1. Install
| Tool | Notes |
|---|---|
| .NET 10 SDK | `dotnet --version` → 10.x. Install EF tools: `dotnet tool install -g dotnet-ef --version "10.0.*"` (match the EF Core major version) |
| Node.js 20+ | `node -v`, `npm -v` |
| SQL Server | Express or Developer edition (2019+). Check the service: `Get-Service MSSQL*` |
| SSMS | To browse `NocturneCafeDB` and run `database/scripts/03-verification-queries.sql` |
| VS Code / Visual Studio 2022+ | Open `backend/NocturneCafe.sln` in VS, or the repo folder in VS Code (C# Dev Kit) |

## 2. Database
```powershell
sqlcmd -S .\SQLEXPRESS -E -C -i database\scripts\01-create-local-database.sql
```
The API connection string for local development is in `backend/NocturneCafe.Api/appsettings.Development.json`
(Windows authentication, no password):
```
Server=.\SQLEXPRESS;Database=NocturneCafeDB;Trusted_Connection=True;TrustServerCertificate=True
```
Using SQL authentication or a different instance? Override without editing git-tracked files:
```powershell
cd backend/NocturneCafe.Api
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Server=localhost,1433;Database=NocturneCafeDB;User Id=sa;Password=<pwd>;TrustServerCertificate=True"
```

### Migrations
```powershell
# from repo root — generate the initial migration once, commit the Migrations folder
dotnet ef migrations add InitialCreate -p backend/NocturneCafe.Infrastructure -s backend/NocturneCafe.Api -o Migrations
dotnet ef database update            -p backend/NocturneCafe.Infrastructure -s backend/NocturneCafe.Api
pwsh database/scripts/02-generate-schema-sql.ps1     # optional: inspectable T-SQL → database/migrations/schema.sql
```
(The API also applies pending migrations at startup when `Database:AutoMigrate` is `true`, which is the default.)

## 3. First administrator (secure bootstrap)
There are no default credentials. On startup, if **no admin exists** and both values are provided, the API creates one (email pre-verified):
```powershell
cd backend/NocturneCafe.Api
dotnet user-secrets set "Bootstrap:AdminEmail" "you@example.com"
dotnet user-secrets set "Bootstrap:AdminPassword" "ChooseA-Strong-Passw0rd"     # ≥8 chars, upper, lower, digit
```
After the first run you can remove them: `dotnet user-secrets remove "Bootstrap:AdminPassword"`. Further admins are promoted from **Admin → Customers → Role**.
Public sign-ups are always `Customer`.

## 4. Run
```powershell
# terminal 1 — API on http://localhost:5000  (Swagger: /swagger)
cd backend/NocturneCafe.Api; dotnet run
# terminal 2 — web on http://localhost:3000
cd frontend; npm install; npm run dev
```
`frontend/.env.local` holds `API_INTERNAL_URL=http://localhost:5000`. Next.js proxies `/api/*` there, so the browser only talks to `localhost:3000` and the cookie/CSRF model matches production.

## 5. Try it
1. Open http://localhost:3000 → home loads from the API/DB.
2. **Sign Up** → (dev: no verification needed) → **Sign In** → add a drink → **Cart** → **Checkout** (Cash on Pickup) → tracking page.
3. Sign in as the admin → http://localhost:3000/admin → move the order through *Confirmed → Preparing → Ready → Completed*; watch the customer tracking page update.
4. **Admin → Content Management:** change the hero title, toggle Gallery OFF, *Save draft* (public site unchanged) → *Preview* → *Publish* (public site changes).
5. Email links in dev (verification, reset): open the newest file in `backend/NocturneCafe.Api/bin/Debug/net10.0/App_Data/outbox/`.
6. To test the email-verification flow locally set `Auth__RequireConfirmedEmail=true` (env var or user-secrets).

## 6. API testing
Swagger UI at `/swagger` (Development only). Mutating calls need the CSRF header: `GET /api/auth/csrf` → send `token` as `X-CSRF-TOKEN` (the browser also keeps the `nocturne.af` cookie; with curl use a cookie jar `-c jar -b jar`). Sign in with `POST /api/auth/login`.

## 7. Unit tests
`cd backend; dotnet test` — business-rule tests (pricing, checkout, stock, order lifecycle, CMS draft/publish, access control) on EF Core's in-memory provider.

## Troubleshooting
| Symptom | Fix |
|---|---|
| `No EF Core migrations found` on API start | Run the `migrations add InitialCreate` command above |
| `Cannot open database "NocturneCafeDB"` | Run `01-create-local-database.sql`, or let `Database:AutoMigrate` create it (needs CREATE DATABASE right) |
| `A connection was successfully established … certificate chain` | Local only: keep `TrustServerCertificate=True`; in production use `Encrypt=True;TrustServerCertificate=False` |
| Web shows "We couldn't reach the café" | API not running / wrong `API_INTERNAL_URL` |
| `An Application Control policy has blocked this file (0x800711C7)` | Windows Smart App Control blocks unsigned local builds. Turn it off (Windows Security → App & browser control → Smart App Control; irreversible without reinstall), or build/run in WSL2/Docker/another machine |
| Port 5000/3000 busy | `netstat -ano | findstr :5000` and stop the process |
| Login works but next request is 400 | The CSRF token rotates at sign-in; the client refetches automatically. With curl, re-run `/api/auth/csrf` after login |

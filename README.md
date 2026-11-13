# NOCTURNE CAFÉ — *Where Every Sip Meets the Night.*

A database-driven coffee shop website and management system: public site, customer accounts & ordering, an admin
dashboard, and a CMS that lets the owner change what customers see without touching code.

| Layer | Technology |
|---|---|
| Web | Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui-style components (Radix) · Lucide · Framer Motion · Recharts |
| Web API | ASP.NET Core (.NET 10) · EF Core 10 · ASP.NET Core Identity (HttpOnly cookies + CSRF) · Swagger/OpenAPI |
| Database | **Microsoft SQL Server** (`NocturneCafeDB`) · Amazon RDS for SQL Server in production |
| Hosting | AWS: **EC2 #1 Web** (Nginx + Next.js) · **EC2 #2 API** (Kestrel) · **RDS** (SQL Server) |

```
Browser ──HTTPS──▶ EC2 #1  Nginx :443 ──▶ Next.js :3000      (public subnet)
                          └─ /api/*  ──HTTP, private──▶ EC2 #2  ASP.NET Core :5000   (private subnet)
                                                                   └─ 1433 (TLS) ──▶ RDS SQL Server (private DB subnets)
```
Only the API talks to the database. The browser only ever sees one origin, so the auth cookie is first-party and CSRF is simple.
Local development uses the same shape: `localhost:3000` (Next.js, proxying `/api/*`) → `localhost:5000` (API) → local SQL Server.

## Repository layout
```
frontend/    Next.js app (app/, components/, features/, services/, styles/, public/)
backend/     NocturneCafe.Api · .Application (DTOs, interfaces) · .Domain (entities) · .Infrastructure (EF Core, services) · .Tests
database/    migrations/ (generated T-SQL), scripts/ (create DB, verification queries), seed-data/ (what gets seeded)
deployment/  aws/ (CloudFormation), nginx/, systemd/, scripts/ (bootstrap, package, deploy)
docs/        LOCAL-SETUP · AWS-DEPLOYMENT · TESTING · SECURITY · API · PAYMENTS
```

## Quick start (local)
Prerequisites: .NET 10 SDK, Node.js 20+ (tested on 24), SQL Server (Express/Developer) + SSMS, `dotnet tool install -g dotnet-ef --version "10.0.*"`.

```powershell
# 1. database + schema
sqlcmd -S .\SQLEXPRESS -E -C -i database\scripts\01-create-local-database.sql
dotnet ef migrations add InitialCreate -p backend/NocturneCafe.Infrastructure -s backend/NocturneCafe.Api -o Migrations   # first time only
# 2. first administrator (never hard-coded; stored in user-secrets, not git)
cd backend/NocturneCafe.Api
dotnet user-secrets set "Bootstrap:AdminEmail" "you@example.com"
dotnet user-secrets set "Bootstrap:AdminPassword" "ChooseA-Strong-Passw0rd"
# 3. run the API (applies migrations + seeds on start) — http://localhost:5000/swagger
dotnet run
# 4. run the website — http://localhost:3000        (in another terminal)
cd ../../frontend; npm install; npm run dev
```
Full instructions, connection strings and troubleshooting: [docs/LOCAL-SETUP.md](docs/LOCAL-SETUP.md).
Deploying to AWS: [docs/AWS-DEPLOYMENT.md](docs/AWS-DEPLOYMENT.md). Verification checklist: [docs/TESTING.md](docs/TESTING.md).

## What's implemented
* **Public site** (all content from the API/SQL Server): Home (hero, highlights, story, featured, signature, gallery, promotions, reviews, events, newsletter, contact), Menu (search, categories, product detail with size / hot-or-iced / add-ons / quantity), About, Gallery, Events, Contact, Sign In/Up, Forgot/Reset password, Email verification, Cart, Checkout, Order Tracking (live, auto-refreshing).
* **Customer dashboard:** overview, profile, order history & tracking, favorites, rewards (1 pt / ₱10 on completed orders), saved addresses, change password.
* **Ordering:** server-side price calculation (client prices are never trusted), promo codes, delivery fee, stock decrement/restore in a transaction, order snapshots that survive product edits, status history, Cash on Pickup / Cash on Delivery. GCash/card sit behind an `IPaymentGateway` boundary ([docs/PAYMENTS.md](docs/PAYMENTS.md)) and are **rejected** until a provider is configured — no payment is ever simulated.
* **Admin (`/admin`):** dashboard KPIs + 5 charts from live SQL queries, orders (search, filter, status workflow, payment status, printable receipt), products (CRUD, image upload, sizes, add-ons, featured/availability toggles, archive), categories, inventory, customers (view, disable/reactivate, role), promotions, reviews moderation, gallery, reports + CSV export, audit log, newsletter list.
* **CMS:** every homepage section can be reordered, toggled ON/OFF and edited (title, subtitle, images, buttons, links, messages); About/Events/Contact text; logo, favicon, theme colors, contact, hours, socials, footer, navigation visibility, featured products. **Save Draft → Preview → Publish → Unpublish → Change History (restore)**. Drafts are never served to customers.

## Honest status / things you must know
* **Placeholder artwork:** no photography was supplied, so seed data uses generated SVG art (`frontend/scripts/generate-images.mjs`). Upload real photos in Admin → Products / Gallery / Website Appearance.
* **Sample reviews & promo codes** (`WELCOME10`, `NIGHTOWL`) are demo data — remove before launch.
* **Email** (verification / password reset): in Development without SMTP configured, emails are written to `backend/NocturneCafe.Api/bin/.../App_Data/outbox/*.html` and logged. Production needs SMTP (Amazon SES) — see the AWS guide. Development has `Auth:RequireConfirmedEmail=false` for convenience; production defaults to `true`.
* **Guests browse freely; adding to cart requires sign-in** (the cart is server-side per user).
* **Media storage** is local disk on the API EC2 (`Storage:RootPath`, a dedicated EBS volume with snapshot backups). The `IMediaStorage` interface is the seam for an S3 implementation.
* The frontend was type-checked and production-built here. **The API and tests could be compiled but not executed in the authoring environment** because Windows Smart App Control blocked the unsigned build output — see [docs/TESTING.md](docs/TESTING.md) § "Status of verification" and run the checklist on your machine.

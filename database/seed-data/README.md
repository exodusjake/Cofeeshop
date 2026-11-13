# Seed data

Seeding is done by the API at startup (`backend/NocturneCafe.Infrastructure/Data/DbSeeder.cs`) and is **idempotent**:

| Data | Condition |
|---|---|
| Roles `Customer`, `Admin` | always ensured |
| 7 categories, 21 sample products (₱ prices, sizes, add-ons) | only if no categories exist |
| Homepage sections, site settings, About/Events/Contact text (published) | only missing rows are added |
| Gallery (6 placeholder images), 2 promotions (`WELCOME10`, `NIGHTOWL`), 3 sample reviews | only if tables are empty |
| First administrator | only if `Bootstrap:AdminEmail` + `Bootstrap:AdminPassword` are set **and** no admin exists |

Set `Database__SeedSampleData=false` in production once you have entered your real menu. The sample reviews are
labelled "Sample Guest": delete them in Admin -> Reviews before going live.

# Migrations

EF Core migrations must live in the assembly that owns the `DbContext`, so the migration **source** is generated into
`backend/NocturneCafe.Infrastructure/Migrations/`. This folder holds the **inspectable T-SQL** produced from them.

```powershell
# 1. create / update migrations (run from repo root)
dotnet ef migrations add InitialCreate -p backend/NocturneCafe.Infrastructure -s backend/NocturneCafe.Api -o Migrations

# 2. apply to the local database
dotnet ef database update -p backend/NocturneCafe.Infrastructure -s backend/NocturneCafe.Api

# 3. produce an idempotent script for review in SSMS / for RDS (writes database/migrations/schema.sql)
pwsh database/scripts/02-generate-schema-sql.ps1
```

On RDS you can either let the API apply migrations on first start (`Database__AutoMigrate=true`), or run `schema.sql`
with `sqlcmd` from the API instance. Nothing requires `sysadmin`.

-- Creates the local development database (SQL Server Express / Developer / LocalDB).
-- Run in SSMS or:  sqlcmd -S .\SQLEXPRESS -E -C -i database\scripts\01-create-local-database.sql
-- On Amazon RDS the database is created by the RDS master login (see docs/AWS-DEPLOYMENT.md); sysadmin is NOT required.
IF DB_ID(N'NocturneCafeDB') IS NULL
BEGIN
    CREATE DATABASE [NocturneCafeDB];   -- default collation; all text columns are NVARCHAR (Unicode-safe, e.g. "Café")
    PRINT 'NocturneCafeDB created.';
END
ELSE PRINT 'NocturneCafeDB already exists.';
GO

-- Handy checks while testing (run in SSMS against NocturneCafeDB).
USE NocturneCafeDB;
GO
SELECT TOP 20 Id, Email, FullName, EmailConfirmed, IsActive, CreatedAt FROM AspNetUsers ORDER BY CreatedAt DESC;   -- registration saved?
SELECT u.Email, r.Name AS Role FROM AspNetUserRoles ur JOIN AspNetUsers u ON u.Id=ur.UserId JOIN AspNetRoles r ON r.Id=ur.RoleId;
SELECT TOP 5 Email, LEFT(PasswordHash, 12) + '...' AS PasswordHashPrefix FROM AspNetUsers;                          -- hashed, never plaintext
SELECT c.Name AS Category, COUNT(*) AS Products FROM Products p JOIN Categories c ON c.Id=p.CategoryId WHERE p.IsArchived=0 GROUP BY c.Name;
SELECT TOP 20 o.OrderNumber, o.Status, o.Total, o.CreatedAt, p.Method, p.Status AS PaymentStatus FROM Orders o LEFT JOIN Payments p ON p.OrderId=o.Id ORDER BY o.CreatedAt DESC;
SELECT [Key], PublishedSortOrder, PublishedIsEnabled, SortOrder, IsEnabled FROM HomepageSections ORDER BY SortOrder;  -- draft vs published
SELECT TOP 20 CreatedAt, UserEmail, Action, EntityType, Details FROM AdminAuditLogs ORDER BY Id DESC;
SELECT TOP 10 Id, [Action], Note, ChangedBy, CreatedAt FROM ContentRevisions ORDER BY Id DESC;

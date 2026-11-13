# Security design

| Area | Implementation |
|---|---|
| Authentication | ASP.NET Core Identity; PBKDF2 password hashing (no plaintext); lockout after 5 failures (15 min); unique email; email verification; password reset tokens (single-use, time-limited, never reveal whether an account exists) |
| Sessions | `nocturne.auth` cookie: **HttpOnly, Secure (prod), SameSite=Lax**, 14-day sliding; security stamp re-validated every request, so disabling a user or changing a role takes effect immediately |
| CSRF | Antiforgery token (header `X-CSRF-TOKEN` + HttpOnly `nocturne.af` cookie, SameSite=Strict) validated globally on all non-GET requests, including login/register |
| Authorization | Enforced in the API: `[Authorize(Roles="Admin")]` on every admin controller; customer queries are always filtered by the authenticated user id (other users' orders return 404). The frontend checks are UX only |
| Roles | Public registration always yields `Customer`. First admin from secret configuration, never hard-coded; role changes by admins only, audited; admins cannot disable/demote themselves |
| Input | DataAnnotations on every DTO; EF Core parameterised queries (no raw SQL); `LIKE` patterns via `EF.Functions.Like`; React escapes output (no `dangerouslySetInnerHTML` for user/CMS data); CMS links pass `safeHref` and the API rejects `javascript:` |
| Money | All prices recalculated server-side from the DB; order lines are snapshots; `DECIMAL(18,2)`; stock changes in a transaction with `rowversion` concurrency |
| Uploads | Admin-only; ≤ 5 MB; type decided by **magic bytes** (JPEG/PNG/WebP/GIF), random file names, stored outside any web root, served with a fixed content type + `nosniff` |
| Rate limiting | Global 600/min/IP and 10/min/IP on auth endpoints in the API, plus Nginx `limit_req` on credential routes |
| Headers | `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, HSTS (Nginx), `Permissions-Policy` |
| Audit | `AdminAuditLogs`: who/what/when/IP for product, order, user, promotion, content, settings, media actions |
| Secrets | No secrets in git. Local: user-secrets. AWS: Secrets Manager read by instance role at service start into tmpfs |
| Network | Private API and DB subnets; SG chain internet→web→api→db; RDS not public and encrypted at rest; TLS to RDS (`TrustServerCertificate=False`); IMDSv2; SSM instead of SSH |
| Payments | Raw card data never touches this system. Online methods are refused until a provider adapter is configured ([PAYMENTS.md](PAYMENTS.md)) |

Known gaps to consider before a large launch: add a Content-Security-Policy tuned to your assets, 2FA for admins, a WAF (AWS WAF needs an ALB/CloudFront — outside the 2-instance brief), CloudWatch alarms, and scheduled security-stamp/PII retention policies.

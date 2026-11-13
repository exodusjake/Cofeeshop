# API reference

Base path `/api` (OpenAPI/Swagger at `/swagger` in Development; set `Swagger__Enabled=true` to expose it privately).
Auth = HttpOnly cookie. Every non-GET request needs header `X-CSRF-TOKEN` (from `GET /api/auth/csrf`). JSON in/out; errors are `{ "title": "...", "code"?: "..." }` or ASP.NET validation problem details.
Roles: 🌐 public · 👤 signed-in customer · 🛡️ admin.

## Auth
| | Endpoint | Notes |
|---|---|---|
| 🌐 | `GET /auth/csrf` | returns `{token}` |
| 🌐 | `POST /auth/register` `{fullName,email,password,confirmPassword}` | role = Customer; sends verification email |
| 🌐 | `POST /auth/confirm-email` `{userId,token}` · `POST /auth/resend-confirmation` | |
| 🌐 | `POST /auth/login` `{email,password,rememberMe}` | 401 bad creds · 403 unverified/disabled · 429 locked |
| 👤 | `POST /auth/logout` · `GET /auth/me` · `POST /auth/change-password` | |
| 🌐 | `POST /auth/forgot-password` · `POST /auth/reset-password` | never reveals account existence |

## Catalog & content (public)
`GET /categories` · `GET /products?q&categoryId&featured&signature&page&pageSize` · `GET /products/{id}` ·
`GET /content/homepage` (published sections + settings) · `GET /content/pages` · `GET /settings/public` · `GET /gallery` · `GET /promotions` · `GET /reviews` · `POST /newsletter` · `GET /media/{file}` · `GET /health`

## Customer (👤)
`GET /cart` · `POST /cart/items` · `PUT /cart/items/{id}` · `DELETE /cart/items/{id}` · `DELETE /cart` ·
`POST /orders` (checkout) · `POST /orders/promo-check` · `GET /orders` · `GET /orders/{id}` · `POST /orders/{id}/cancel` (pending only) ·
`GET|PUT /account/profile` · `GET|POST /account/addresses` · `PUT|DELETE /account/addresses/{id}` · `GET /account/favorites` · `GET /account/favorites/ids` · `PUT|DELETE /account/favorites/{productId}` · `GET /account/rewards` · `POST /reviews`

## Admin (🛡️)
| Area | Endpoints |
|---|---|
| Dashboard | `GET /admin/dashboard` · `GET /admin/reports/sales.csv?from&to` |
| Orders | `GET /admin/orders?q&status&page` · `GET /admin/orders/{id}` · `PUT /admin/orders/{id}/status` · `PUT /admin/orders/{id}/payment` |
| Products | `GET /admin/products` · `GET /admin/products/{id}` · `POST /admin/products` · `PUT /admin/products/{id}` · `DELETE /admin/products/{id}` (archive) |
| Categories / inventory | `GET\|POST /admin/categories` · `PUT\|DELETE /admin/categories/{id}` · `GET /admin/inventory` · `PUT /admin/inventory/{productId}` |
| Users | `GET /admin/users?q&role` · `GET /admin/users/{id}` · `PUT /admin/users/{id}/status` · `PUT /admin/users/{id}/role` |
| Engagement | `…/promotions` · `…/reviews` (+`PUT /reviews/{id}/approval`) · `…/gallery` · `GET /admin/newsletter` |
| Media | `POST /admin/media` (multipart `file`) · `GET /admin/media` |
| CMS | `GET\|PUT /admin/content/homepage` (draft) · `GET\|PUT /admin/content/pages` · `GET\|PUT /admin/settings` · `POST /admin/content/publish` · `POST /admin/content/unpublish` · `GET /admin/content/history` · `POST /admin/content/history/{id}/restore` |
| Audit | `GET /admin/audit-logs` |

Order statuses: `Pending → Confirmed → Preparing → Ready for Pickup | Out for Delivery → Completed`, or `Cancelled` (restores stock). Terminal states cannot change; pickup orders cannot be "Out for Delivery" and vice versa.

> Versioning: the contract is `v1` (Swagger doc `v1`). Paths follow the brief's un-prefixed `/api/...` form; when a breaking change is needed, add `/api/v2/...` controllers alongside.

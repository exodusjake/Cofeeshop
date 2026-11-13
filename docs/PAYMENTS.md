# Payments

| Method | Status |
|---|---|
| Cash on Pickup (pickup orders) | ✅ implemented. Marked *Paid* when the admin completes the order |
| Cash on Delivery (delivery orders) | ✅ implemented, same behaviour |
| GCash | ⚙️ integration boundary only — **rejected at checkout until a provider is configured** |
| Card | ⚙️ integration boundary only — same |

The checkout calls `IPaymentGateway` (`backend/NocturneCafe.Application/Interfaces.cs`). The shipped `UnconfiguredPaymentGateway`
answers `Supports(...) = false`, so GCash/Card orders fail with a clear message instead of pretending to succeed.

## Adding a provider (PayMongo, Xendit, Stripe, …)
1. Create a provider account; you need **API keys** and a **webhook secret** (store them in Secrets Manager → `nocturne/app`, surface as env vars).
2. Implement `IPaymentGateway`: `Supports` returns true for the methods you enabled; `CreateChargeAsync` creates a *payment intent / source* with the provider and returns `PaymentResult(Success, PaymentStatus.Pending, providerReference, null)`. Use the provider's **hosted checkout or tokenisation (Elements/Checkout)** so card numbers never reach this server.
3. Register it in `Program.cs` instead of `UnconfiguredPaymentGateway`.
4. Add a webhook endpoint (`POST /api/payments/webhook`, exempt from CSRF with `[IgnoreAntiforgeryToken]`, **verify the provider's signature**) that sets `Payment.Status = Paid` (and `PaidAt`) for the matching `ProviderReference`.
5. Optionally return a redirect URL from checkout so the customer completes payment on the provider page.

Missing credentials are a documented prerequisite — nothing in this repo simulates a live payment.

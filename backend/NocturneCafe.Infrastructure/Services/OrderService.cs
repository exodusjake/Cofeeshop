using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using NocturneCafe.Application;
using NocturneCafe.Domain;
using NocturneCafe.Infrastructure.Data;

namespace NocturneCafe.Infrastructure.Services;

public class OrderService : IOrderService
{
    private readonly AppDbContext _db;
    private readonly ICartService _cart;
    private readonly IEnumerable<IPaymentGateway> _gateways;
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public OrderService(AppDbContext db, ICartService cart, IEnumerable<IPaymentGateway> gateways)
    { _db = db; _cart = cart; _gateways = gateways; }

    private async Task<decimal> DeliveryFeeAsync()
    {
        var s = await _db.SiteSettings.AsNoTracking().FirstOrDefaultAsync(x => x.Key == "delivery.fee");
        return decimal.TryParse(s?.PublishedValue ?? s?.DraftValue, System.Globalization.NumberStyles.Number, System.Globalization.CultureInfo.InvariantCulture, out var f) ? f : 50m;
    }

    public async Task<PromoCheckResult> CheckPromoAsync(string code, decimal subtotal)
    {
        var now = DateTimeOffset.UtcNow;
        var c = code.Trim().ToUpper();
        var promo = await _db.Promotions.AsNoTracking().FirstOrDefaultAsync(p => p.Code != null && p.Code.ToUpper() == c);
        if (promo == null || !promo.IsActive || (promo.StartsAt.HasValue && promo.StartsAt > now) || (promo.EndsAt.HasValue && promo.EndsAt < now))
            return new PromoCheckResult(false, "This promo code is not valid.", 0, null);
        if (subtotal < promo.MinSubtotal)
            return new PromoCheckResult(false, $"Minimum order of ₱{promo.MinSubtotal:0.##} required.", 0, promo.Title);
        var discount = promo.DiscountType == DiscountType.Percent ? Math.Round(subtotal * promo.DiscountValue / 100m, 2) : promo.DiscountValue;
        discount = Math.Min(discount, subtotal);
        return new PromoCheckResult(true, null, discount, promo.Title);
    }

    public async Task<OrderDto> CheckoutAsync(Guid userId, CheckoutRequest r)
    {
        var user = await _db.Users.Include(u => u.Profile).FirstAsync(u => u.Id == userId);
        var cart = await _db.Carts.Include(c => c.Items).ThenInclude(i => i.Product).ThenInclude(p => p.Variants)
            .Include(c => c.Items).ThenInclude(i => i.Product).ThenInclude(p => p.Addons)
            .Include(c => c.Items).ThenInclude(i => i.Product).ThenInclude(p => p.Category)
            .Include(c => c.Items).ThenInclude(i => i.Product).ThenInclude(p => p.Inventory)
            .AsSplitQuery().FirstOrDefaultAsync(c => c.UserId == userId);
        if (cart == null || cart.Items.Count == 0) throw new ServiceException("Your cart is empty.");

        // Payment method / fulfilment rules
        if (r.PaymentMethod == PaymentMethod.CashOnPickup && r.Fulfillment != FulfillmentType.Pickup)
            throw new ServiceException("Cash on Pickup is only available for pickup orders.");
        if (r.PaymentMethod == PaymentMethod.CashOnDelivery && r.Fulfillment != FulfillmentType.Delivery)
            throw new ServiceException("Cash on Delivery is only available for delivery orders.");
        IPaymentGateway? gateway = null;
        if (r.PaymentMethod is PaymentMethod.GCash or PaymentMethod.Card)
        {
            gateway = _gateways.FirstOrDefault(g => g.Supports(r.PaymentMethod))
                ?? throw new ServiceException($"{r.PaymentMethod} payments are not configured on this store yet. Please choose another payment method.");
        }

        string? deliveryAddress = null; string phone = r.Phone?.Trim() ?? user.Profile?.Phone ?? user.PhoneNumber ?? "";
        if (r.Fulfillment == FulfillmentType.Delivery)
        {
            if (r.AddressId == null) throw new ServiceException("Please choose a delivery address.");
            var a = await _db.Addresses.AsNoTracking().FirstOrDefaultAsync(x => x.Id == r.AddressId && x.UserId == userId)
                ?? throw new ServiceException("Delivery address not found.");
            deliveryAddress = string.Join(", ", new[] { a.Recipient, a.Line1, a.Line2, a.City, a.PostalCode }.Where(s => !string.IsNullOrWhiteSpace(s)))
                              + (string.IsNullOrWhiteSpace(a.Notes) ? "" : $" ({a.Notes})");
            if (string.IsNullOrWhiteSpace(phone)) phone = a.Phone;
        }
        if (string.IsNullOrWhiteSpace(phone)) throw new ServiceException("A contact phone number is required.");

        // Everything below is persisted by ONE SaveChanges call (an atomic SQL transaction). We deliberately avoid explicit
        // BeginTransaction because the SQL Server retrying execution strategy does not allow user-initiated transactions.
        var order = new Order
        {
            UserId = userId, Fulfillment = r.Fulfillment, CustomerName = user.FullName, CustomerEmail = user.Email ?? "",
            CustomerPhone = phone, DeliveryAddress = deliveryAddress, Notes = r.Notes?.Trim(), OrderNumber = NewOrderNumber()
        };

        foreach (var ci in cart.Items)
        {
            var p = ci.Product;
            if (p.IsArchived || !p.IsAvailable || !p.Category.IsActive) throw new ServiceException($"\"{p.Name}\" is no longer available. Please remove it from your cart.");
            var (unit, size, addons) = CartService.Price(p, ci.VariantId, ci.AddonIds.Split(',', StringSplitOptions.RemoveEmptyEntries).Select(int.Parse));
            if (p.Inventory is { TrackStock: true } inv)
            {
                if (inv.QuantityOnHand < ci.Quantity) throw new ServiceException($"Only {inv.QuantityOnHand} of \"{p.Name}\" left in stock.");
                inv.QuantityOnHand -= ci.Quantity; inv.UpdatedAt = DateTimeOffset.UtcNow;
            }
            order.Items.Add(new OrderItem
            {
                ProductId = p.Id, ProductName = p.Name, CategoryName = p.Category.Name, Size = size, Temperature = ci.Temperature,
                AddonsSnapshot = addons.Count > 0 ? JsonSerializer.Serialize(addons, Json) : null,
                UnitPrice = unit, Quantity = ci.Quantity, LineTotal = unit * ci.Quantity, Notes = ci.Notes
            });
        }

        order.Subtotal = order.Items.Sum(i => i.LineTotal);
        if (!string.IsNullOrWhiteSpace(r.PromoCode))
        {
            var promo = await CheckPromoAsync(r.PromoCode, order.Subtotal);
            if (!promo.Valid) throw new ServiceException(promo.Message ?? "Invalid promo code.");
            order.Discount = promo.Discount; order.PromoCode = r.PromoCode.Trim().ToUpper();
        }
        order.DeliveryFee = r.Fulfillment == FulfillmentType.Delivery ? await DeliveryFeeAsync() : 0;
        order.Total = order.Subtotal - order.Discount + order.DeliveryFee;

        order.Payment = new Payment { Method = r.PaymentMethod, Amount = order.Total, Status = PaymentStatus.Pending };
        if (gateway != null)
        {
            var res = await gateway.CreateChargeAsync(r.PaymentMethod, order.Total, order.OrderNumber);
            if (!res.Success) throw new ServiceException(res.Error ?? "Payment could not be started.");
            order.Payment.Provider = r.PaymentMethod.ToString(); order.Payment.ProviderReference = res.Reference; order.Payment.Status = res.Status;
        }
        order.History.Add(new OrderStatusHistory { Status = OrderStatus.Pending, Note = "Order placed", ChangedBy = user.Email });

        _db.Orders.Add(order);
        _db.CartItems.RemoveRange(cart.Items);
        try { await _db.SaveChangesAsync(); }
        catch (DbUpdateConcurrencyException) { throw new ServiceException("Stock changed while placing your order. Please review your cart and try again.", 409); }
        return (await GetAsync(order.Id))!;
    }

    private static string NewOrderNumber() =>
        $"NC-{DateTime.UtcNow:yyMMdd}-{Convert.ToHexString(RandomNumberGenerator.GetBytes(3))}";

    // ---------- reads ----------
    private IQueryable<Order> Full => _db.Orders.AsNoTracking().Include(o => o.Items).Include(o => o.History).Include(o => o.Payment).AsSplitQuery();

    public async Task<List<OrderSummaryDto>> ListForUserAsync(Guid userId) =>
        (await _db.Orders.AsNoTracking().Include(o => o.Payment).Include(o => o.Items).Where(o => o.UserId == userId)
            .OrderByDescending(o => o.CreatedAt).ToListAsync()).Select(Summary).ToList();

    public async Task<OrderDto?> GetForUserAsync(Guid userId, int orderId)
    {
        var o = await Full.FirstOrDefaultAsync(x => x.Id == orderId && x.UserId == userId);
        return o == null ? null : Map(o);
    }

    public async Task<OrderDto?> GetAsync(int orderId)
    {
        var o = await Full.FirstOrDefaultAsync(x => x.Id == orderId);
        return o == null ? null : Map(o);
    }

    public async Task<PagedResult<OrderSummaryDto>> ListAllAsync(string? q, string? status, int page, int pageSize)
    {
        page = Math.Max(1, page); pageSize = Math.Clamp(pageSize, 1, 100);
        var query = _db.Orders.AsNoTracking().Include(o => o.Payment).Include(o => o.Items).AsQueryable();
        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<OrderStatus>(status, true, out var s)) query = query.Where(o => o.Status == s);
        if (!string.IsNullOrWhiteSpace(q))
        {
            var t = q.Trim();
            query = query.Where(o => EF.Functions.Like(o.OrderNumber, "%" + t + "%") || EF.Functions.Like(o.CustomerName, "%" + t + "%")
                || EF.Functions.Like(o.CustomerEmail, "%" + t + "%") || EF.Functions.Like(o.CustomerPhone, "%" + t + "%"));
        }
        var total = await query.CountAsync();
        var rows = await query.OrderByDescending(o => o.CreatedAt).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
        return new PagedResult<OrderSummaryDto>(rows.Select(Summary).ToList(), total, page, pageSize);
    }

    // ---------- admin mutations ----------
    public async Task<OrderDto> UpdateStatusAsync(int orderId, OrderStatus status, string? note, string changedBy)
    {
        var o = await _db.Orders.Include(x => x.Items).Include(x => x.History).Include(x => x.Payment).AsSplitQuery()
            .FirstOrDefaultAsync(x => x.Id == orderId) ?? throw new ServiceException("Order not found.", 404);
        if (o.Status == status) return Map(o);
        if (o.Status is OrderStatus.Completed or OrderStatus.Cancelled) throw new ServiceException($"A {o.Status} order can no longer be changed.");
        if (status == OrderStatus.ReadyForPickup && o.Fulfillment != FulfillmentType.Pickup) throw new ServiceException("Only pickup orders can be marked Ready for Pickup.");
        if (status == OrderStatus.OutForDelivery && o.Fulfillment != FulfillmentType.Delivery) throw new ServiceException("Only delivery orders can be marked Out for Delivery.");
        if (status != OrderStatus.Cancelled && (int)status < (int)o.Status) throw new ServiceException("An order cannot move backwards.");

        o.Status = status; o.UpdatedAt = DateTimeOffset.UtcNow;
        o.History.Add(new OrderStatusHistory { Status = status, Note = note, ChangedBy = changedBy });

        if (status == OrderStatus.Cancelled)
        {
            var ids = o.Items.Where(i => i.ProductId != null).Select(i => i.ProductId!.Value).ToList();
            var invs = await _db.Inventory.Where(i => ids.Contains(i.ProductId) && i.TrackStock).ToListAsync();
            foreach (var it in o.Items.Where(i => i.ProductId != null))
                invs.FirstOrDefault(i => i.ProductId == it.ProductId)?.Let(i => i.QuantityOnHand += it.Quantity);
            if (o.Payment != null) o.Payment.Status = o.Payment.Status == PaymentStatus.Paid ? PaymentStatus.Refunded : PaymentStatus.Failed;
        }
        if (status == OrderStatus.Completed)
        {
            if (o.Payment is { Status: PaymentStatus.Pending } && o.Payment.Method is PaymentMethod.CashOnDelivery or PaymentMethod.CashOnPickup)
            { o.Payment.Status = PaymentStatus.Paid; o.Payment.PaidAt = DateTimeOffset.UtcNow; }
            var points = (int)(o.Total / 10m);
            if (points > 0)
            {
                _db.RewardTransactions.Add(new RewardTransaction { UserId = o.UserId, OrderId = o.Id, Kind = RewardKind.Earned, Points = points, Description = $"Order {o.OrderNumber}" });
                var profile = await _db.CustomerProfiles.FirstOrDefaultAsync(p => p.UserId == o.UserId);
                if (profile == null) { profile = new CustomerProfile { UserId = o.UserId }; _db.CustomerProfiles.Add(profile); }
                profile.RewardPoints += points;
            }
        }
        try { await _db.SaveChangesAsync(); }
        catch (DbUpdateConcurrencyException) { throw new ServiceException("This order was just updated by someone else. Reload and try again.", 409); }
        return Map(o);
    }

    public async Task<OrderDto> UpdatePaymentAsync(int orderId, PaymentStatus status, string? reference, string changedBy)
    {
        var o = await _db.Orders.Include(x => x.Items).Include(x => x.History).Include(x => x.Payment).AsSplitQuery()
            .FirstOrDefaultAsync(x => x.Id == orderId) ?? throw new ServiceException("Order not found.", 404);
        if (o.Payment == null) throw new ServiceException("Order has no payment record.");
        o.Payment.Status = status; if (!string.IsNullOrWhiteSpace(reference)) o.Payment.ProviderReference = reference;
        if (status == PaymentStatus.Paid) o.Payment.PaidAt = DateTimeOffset.UtcNow;
        o.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync();
        return Map(o);
    }

    // ---------- mapping ----------
    private static string Label(OrderStatus s) => s switch
    {
        OrderStatus.ReadyForPickup => "Ready for Pickup", OrderStatus.OutForDelivery => "Out for Delivery", _ => s.ToString()
    };
    public static string StatusLabel(OrderStatus s) => Label(s);

    private static OrderSummaryDto Summary(Order o) => new(o.Id, o.OrderNumber, Label(o.Status), o.Fulfillment.ToString(), o.Total,
        o.Payment?.Method.ToString() ?? "", o.Payment?.Status.ToString() ?? "", o.CustomerName, o.Items.Sum(i => i.Quantity), o.CreatedAt);

    private static OrderDto Map(Order o) => new(o.Id, o.OrderNumber, Label(o.Status), o.Fulfillment.ToString(), o.Subtotal, o.Discount, o.DeliveryFee, o.Total,
        o.PromoCode, o.CustomerName, o.CustomerEmail, o.CustomerPhone, o.DeliveryAddress, o.Notes,
        o.Payment?.Method.ToString() ?? "", o.Payment?.Status.ToString() ?? "", o.CreatedAt, o.UpdatedAt,
        o.Items.OrderBy(i => i.Id).Select(i => new OrderItemDto(i.Id, i.ProductId, i.ProductName, i.Size, i.Temperature,
            string.IsNullOrEmpty(i.AddonsSnapshot) ? new() : JsonSerializer.Deserialize<List<AddonLine>>(i.AddonsSnapshot, Json) ?? new(),
            i.UnitPrice, i.Quantity, i.LineTotal, i.Notes)).ToList(),
        o.History.OrderBy(h => h.CreatedAt).ThenBy(h => h.Id).Select(h => new OrderHistoryDto(Label(h.Status), h.Note, h.CreatedAt)).ToList());
}

internal static class Ext
{
    public static void Let<T>(this T v, Action<T> a) => a(v);
}

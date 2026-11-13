using Microsoft.EntityFrameworkCore;
using NocturneCafe.Application;
using NocturneCafe.Domain;
using NocturneCafe.Infrastructure.Data;

namespace NocturneCafe.Infrastructure.Services;

public class CartService : ICartService
{
    private readonly AppDbContext _db;
    public CartService(AppDbContext db) => _db = db;

    /// <summary>Server-side price calculation. Prices always come from the database, never from the client.</summary>
    public static (decimal unit, string? size, List<AddonLine> addons) Price(Product p, int? variantId, IEnumerable<int> addonIds)
    {
        ProductVariant? variant = null;
        if (p.Variants.Count > 0)
        {
            variant = variantId.HasValue ? p.Variants.FirstOrDefault(v => v.Id == variantId)
                                         : p.Variants.FirstOrDefault(v => v.IsDefault) ?? p.Variants.First();
            if (variant == null) throw new ServiceException("Selected size is not available for this product.");
        }
        else if (variantId.HasValue) throw new ServiceException("Selected size is not available for this product.");

        var chosen = new List<AddonLine>();
        foreach (var id in addonIds.Distinct())
        {
            var a = p.Addons.FirstOrDefault(x => x.Id == id && x.IsActive) ?? throw new ServiceException("An add-on is not available for this product.");
            chosen.Add(new AddonLine(a.Id, a.Name, a.Price));
        }
        return (p.Price + (variant?.PriceDelta ?? 0) + chosen.Sum(a => a.Price), variant?.Name, chosen);
    }

    private static string? NormalizeTemp(Product p, string? temp)
    {
        if (string.IsNullOrWhiteSpace(temp)) return p.SupportsHot ? (p.SupportsCold ? "Hot" : "Hot") : (p.SupportsCold ? "Iced" : null);
        var t = temp.Trim().ToLowerInvariant();
        if (t is "hot" && p.SupportsHot) return "Hot";
        if (t is "iced" or "cold" && p.SupportsCold) return "Iced";
        throw new ServiceException("Selected temperature is not available for this product.");
    }

    private async Task<Cart> GetOrCreate(Guid userId)
    {
        var cart = await _db.Carts.Include(c => c.Items).FirstOrDefaultAsync(c => c.UserId == userId);
        if (cart == null) { cart = new Cart { UserId = userId }; _db.Carts.Add(cart); await _db.SaveChangesAsync(); }
        return cart;
    }

    private static string Join(IEnumerable<int>? ids) => string.Join(',', (ids ?? Array.Empty<int>()).Distinct().OrderBy(i => i));
    private static List<int> Split(string s) => s.Split(',', StringSplitOptions.RemoveEmptyEntries).Select(int.Parse).ToList();

    public async Task<CartDto> GetAsync(Guid userId)
    {
        var cart = await _db.Carts.AsNoTracking().Include(c => c.Items).ThenInclude(i => i.Product).ThenInclude(p => p.Variants)
            .Include(c => c.Items).ThenInclude(i => i.Product).ThenInclude(p => p.Addons)
            .Include(c => c.Items).ThenInclude(i => i.Product).ThenInclude(p => p.Inventory)
            .AsSplitQuery().FirstOrDefaultAsync(c => c.UserId == userId);
        var items = new List<CartItemDto>();
        foreach (var i in (cart?.Items ?? new()).OrderBy(i => i.Id))
        {
            var p = i.Product;
            try
            {
                var (unit, size, addons) = Price(p, i.VariantId, Split(i.AddonIds));
                var available = p.IsAvailable && !p.IsArchived && (p.Inventory is not { TrackStock: true } || p.Inventory.QuantityOnHand >= i.Quantity);
                items.Add(new CartItemDto(i.Id, p.Id, p.Name, p.ImageUrl, i.VariantId, size, i.Temperature, addons, unit, i.Quantity, unit * i.Quantity, i.Notes, available));
            }
            catch (ServiceException)
            {
                items.Add(new CartItemDto(i.Id, p.Id, p.Name, p.ImageUrl, i.VariantId, null, i.Temperature, new(), p.Price, i.Quantity, p.Price * i.Quantity, i.Notes, false));
            }
        }
        return new CartDto(items, items.Where(i => i.Available).Sum(i => i.LineTotal), items.Sum(i => i.Quantity));
    }

    public async Task<CartDto> AddAsync(Guid userId, CartItemRequest r)
    {
        var p = await _db.Products.Include(x => x.Variants).Include(x => x.Addons).Include(x => x.Category)
            .AsSplitQuery().FirstOrDefaultAsync(x => x.Id == r.ProductId && !x.IsArchived)
            ?? throw new ServiceException("Product not found.", 404);
        if (!p.IsAvailable || !p.Category.IsActive) throw new ServiceException("This product is currently unavailable.");
        Price(p, r.VariantId, r.AddonIds ?? new());      // validates the selection
        var temp = NormalizeTemp(p, r.Temperature);
        var variantId = r.VariantId ?? p.Variants.FirstOrDefault(v => v.IsDefault)?.Id ?? p.Variants.FirstOrDefault()?.Id;

        var cart = await GetOrCreate(userId);
        var addonKey = Join(r.AddonIds);
        var existing = cart.Items.FirstOrDefault(i => i.ProductId == p.Id && i.VariantId == variantId && i.Temperature == temp && i.AddonIds == addonKey && (i.Notes ?? "") == (r.Notes ?? ""));
        if (existing != null) existing.Quantity = Math.Min(50, existing.Quantity + r.Quantity);
        else cart.Items.Add(new CartItem { ProductId = p.Id, VariantId = variantId, Temperature = temp, AddonIds = addonKey, Quantity = r.Quantity, Notes = r.Notes });
        cart.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync();
        return await GetAsync(userId);
    }

    public async Task<CartDto> UpdateAsync(Guid userId, int itemId, CartItemUpdateRequest r)
    {
        var cart = await GetOrCreate(userId);
        var item = cart.Items.FirstOrDefault(i => i.Id == itemId) ?? throw new ServiceException("Cart item not found.", 404);
        var p = await _db.Products.Include(x => x.Variants).Include(x => x.Addons).AsSplitQuery().FirstAsync(x => x.Id == item.ProductId);
        var variantId = r.VariantId ?? item.VariantId;
        var addons = r.AddonIds ?? Split(item.AddonIds);
        Price(p, variantId, addons);
        item.VariantId = variantId; item.AddonIds = Join(addons); item.Quantity = r.Quantity; item.Notes = r.Notes ?? item.Notes;
        if (r.Temperature != null) item.Temperature = NormalizeTemp(p, r.Temperature);
        cart.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync();
        return await GetAsync(userId);
    }

    public async Task<CartDto> RemoveAsync(Guid userId, int itemId)
    {
        var cart = await GetOrCreate(userId);
        var item = cart.Items.FirstOrDefault(i => i.Id == itemId) ?? throw new ServiceException("Cart item not found.", 404);
        _db.CartItems.Remove(item);
        await _db.SaveChangesAsync();
        return await GetAsync(userId);
    }

    public async Task ClearAsync(Guid userId)
    {
        var cart = await _db.Carts.Include(c => c.Items).FirstOrDefaultAsync(c => c.UserId == userId);
        if (cart == null) return;
        _db.CartItems.RemoveRange(cart.Items);
        await _db.SaveChangesAsync();
    }
}

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using NocturneCafe.Application;
using NocturneCafe.Domain;
using NocturneCafe.Infrastructure.Data;

namespace NocturneCafe.Api.Controllers;

// ============ Public catalog ============
[Route("api")]
public class CatalogController : ApiBase
{
    private readonly ICatalogService _catalog;
    public CatalogController(ICatalogService catalog) => _catalog = catalog;

    [HttpGet("categories")]
    public async Task<IActionResult> Categories() => Ok(await _catalog.GetCategoriesAsync(false));

    [HttpGet("products")]
    public async Task<IActionResult> Products([FromQuery] string? q, [FromQuery] int? categoryId, [FromQuery] bool? featured, [FromQuery] bool? signature, [FromQuery] int page = 1, [FromQuery] int pageSize = 50) =>
        Ok(await _catalog.SearchAsync(q, categoryId, featured, signature, page, pageSize, admin: false));

    [HttpGet("products/{id:int}")]
    public async Task<IActionResult> Product(int id) => await _catalog.GetAsync(id, false) is { } p ? Ok(p) : NotFound();
}

// ============ Cart ============
[Authorize, Route("api/cart")]
public class CartController : ApiBase
{
    private readonly ICartService _cart;
    public CartController(ICartService cart) => _cart = cart;

    [HttpGet] public async Task<IActionResult> Get() => Ok(await _cart.GetAsync(UserId));
    [HttpPost("items")] public async Task<IActionResult> Add(CartItemRequest r) => Ok(await _cart.AddAsync(UserId, r));
    [HttpPut("items/{id:int}")] public async Task<IActionResult> Update(int id, CartItemUpdateRequest r) => Ok(await _cart.UpdateAsync(UserId, id, r));
    [HttpDelete("items/{id:int}")] public async Task<IActionResult> Remove(int id) => Ok(await _cart.RemoveAsync(UserId, id));
    [HttpDelete] public async Task<IActionResult> Clear() { await _cart.ClearAsync(UserId); return NoContent(); }
}

// ============ Orders (customer) ============
[Authorize, Route("api/orders")]
public class OrdersController : ApiBase
{
    private readonly IOrderService _orders;
    public OrdersController(IOrderService orders) => _orders = orders;

    [HttpPost]
    public async Task<IActionResult> Create(CheckoutRequest r)
    {
        var o = await _orders.CheckoutAsync(UserId, r);
        return CreatedAtAction(nameof(Get), new { id = o.Id }, o);
    }

    [HttpPost("promo-check")]
    public async Task<IActionResult> Promo(PromoCheckRequest r) => Ok(await _orders.CheckPromoAsync(r.Code, r.Subtotal));

    [HttpGet] public async Task<IActionResult> List() => Ok(await _orders.ListForUserAsync(UserId));

    // Ownership is enforced in the query: other customers' orders simply "don't exist" for the caller.
    [HttpGet("{id:int}")]
    public async Task<IActionResult> Get(int id) => await _orders.GetForUserAsync(UserId, id) is { } o ? Ok(o) : NotFound();

    [HttpPost("{id:int}/cancel")]
    public async Task<IActionResult> Cancel(int id)
    {
        var o = await _orders.GetForUserAsync(UserId, id);
        if (o == null) return NotFound();
        if (o.Status != "Pending") return BadRequest(new { title = "Only pending orders can be cancelled. Please contact the café." });
        return Ok(await _orders.UpdateStatusAsync(id, OrderStatus.Cancelled, "Cancelled by customer", UserEmail));
    }
}

// ============ Account: profile, addresses, favorites, rewards ============
[Authorize, Route("api/account")]
public class AccountController : ApiBase
{
    private readonly AppDbContext _db;
    public AccountController(AppDbContext db) => _db = db;

    [HttpGet("profile")]
    public async Task<IActionResult> Profile()
    {
        var u = await _db.Users.AsNoTracking().Include(x => x.Profile).FirstAsync(x => x.Id == UserId);
        return Ok(new ProfileDto(u.FullName, u.Email ?? "", u.Profile?.Phone, u.Profile?.Birthday, u.Profile?.RewardPoints ?? 0, u.CreatedAt));
    }

    [HttpPut("profile")]
    public async Task<IActionResult> UpdateProfile(UpdateProfileRequest r)
    {
        var u = await _db.Users.Include(x => x.Profile).FirstAsync(x => x.Id == UserId);
        u.FullName = r.FullName.Trim();
        u.Profile ??= new CustomerProfile { UserId = u.Id };
        u.Profile.Phone = string.IsNullOrWhiteSpace(r.Phone) ? null : r.Phone.Trim(); u.Profile.Birthday = r.Birthday; u.Profile.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync();
        return await Profile();
    }

    // ---- addresses ----
    private static AddressDto Map(Address a) => new(a.Id, a.Label, a.Recipient, a.Phone, a.Line1, a.Line2, a.City, a.PostalCode, a.Notes, a.IsDefault);

    [HttpGet("addresses")]
    public async Task<IActionResult> Addresses() =>
        Ok((await _db.Addresses.AsNoTracking().Where(a => a.UserId == UserId).OrderByDescending(a => a.IsDefault).ThenBy(a => a.Id).ToListAsync()).Select(Map));

    [HttpPost("addresses")]
    public async Task<IActionResult> AddAddress(AddressRequest r)
    {
        if (await _db.Addresses.CountAsync(a => a.UserId == UserId) >= 10) return BadRequest(new { title = "You can save up to 10 addresses." });
        var a = new Address { UserId = UserId };
        await Apply(a, r); _db.Addresses.Add(a); await _db.SaveChangesAsync();
        return Ok(Map(a));
    }

    [HttpPut("addresses/{id:int}")]
    public async Task<IActionResult> UpdateAddress(int id, AddressRequest r)
    {
        var a = await _db.Addresses.FirstOrDefaultAsync(x => x.Id == id && x.UserId == UserId);
        if (a == null) return NotFound();
        await Apply(a, r); await _db.SaveChangesAsync();
        return Ok(Map(a));
    }

    [HttpDelete("addresses/{id:int}")]
    public async Task<IActionResult> DeleteAddress(int id)
    {
        var a = await _db.Addresses.FirstOrDefaultAsync(x => x.Id == id && x.UserId == UserId);
        if (a == null) return NotFound();
        _db.Addresses.Remove(a); await _db.SaveChangesAsync();
        return NoContent();
    }

    private async Task Apply(Address a, AddressRequest r)
    {
        a.Label = r.Label.Trim(); a.Recipient = r.Recipient.Trim(); a.Phone = r.Phone.Trim(); a.Line1 = r.Line1.Trim();
        a.Line2 = r.Line2?.Trim(); a.City = r.City.Trim(); a.PostalCode = r.PostalCode?.Trim(); a.Notes = r.Notes?.Trim();
        var hasAny = await _db.Addresses.AnyAsync(x => x.UserId == UserId && x.Id != a.Id);
        a.IsDefault = r.IsDefault || !hasAny;
        if (a.IsDefault)
            foreach (var other in await _db.Addresses.Where(x => x.UserId == UserId && x.Id != a.Id && x.IsDefault).ToListAsync()) other.IsDefault = false;
    }

    // ---- favorites ----
    [HttpGet("favorites")]
    public async Task<IActionResult> Favorites()
    {
        var items = await _db.Favorites.AsNoTracking().Where(f => f.UserId == UserId && !f.Product.IsArchived)
            .Include(f => f.Product).ThenInclude(p => p.Category).Include(f => f.Product.Variants).Include(f => f.Product.Addons).Include(f => f.Product.Inventory)
            .AsSplitQuery().OrderByDescending(f => f.CreatedAt).ToListAsync();
        return Ok(items.Select(f => Infrastructure.Services.CatalogService.Map(f.Product, false)));
    }

    [HttpGet("favorites/ids")]
    public async Task<IActionResult> FavoriteIds() => Ok(await _db.Favorites.AsNoTracking().Where(f => f.UserId == UserId).Select(f => f.ProductId).ToListAsync());

    [HttpPut("favorites/{productId:int}")]
    public async Task<IActionResult> AddFavorite(int productId)
    {
        if (!await _db.Products.AnyAsync(p => p.Id == productId && !p.IsArchived)) return NotFound();
        if (!await _db.Favorites.AnyAsync(f => f.UserId == UserId && f.ProductId == productId))
        { _db.Favorites.Add(new Favorite { UserId = UserId, ProductId = productId }); await _db.SaveChangesAsync(); }
        return NoContent();
    }

    [HttpDelete("favorites/{productId:int}")]
    public async Task<IActionResult> RemoveFavorite(int productId)
    {
        var f = await _db.Favorites.FirstOrDefaultAsync(x => x.UserId == UserId && x.ProductId == productId);
        if (f != null) { _db.Favorites.Remove(f); await _db.SaveChangesAsync(); }
        return NoContent();
    }

    // ---- rewards ----
    [HttpGet("rewards")]
    public async Task<IActionResult> Rewards()
    {
        var points = await _db.CustomerProfiles.AsNoTracking().Where(p => p.UserId == UserId).Select(p => p.RewardPoints).FirstOrDefaultAsync();
        var history = await _db.RewardTransactions.AsNoTracking().Where(t => t.UserId == UserId).OrderByDescending(t => t.CreatedAt).Take(50)
            .Select(t => new RewardTransactionDto(t.Id, t.Kind.ToString(), t.Points, t.Description, t.CreatedAt)).ToListAsync();
        var (tier, next) = points switch { >= 1000 => ("Gold", 1000), >= 400 => ("Silver", 1000), _ => ("Bronze", 400) };
        return Ok(new RewardDto(points, tier, next, history));
    }
}

// ============ Public content / CMS read side, gallery, promotions, reviews, newsletter, media ============
[Route("api")]
public class PublicContentController : ApiBase
{
    private readonly IContentService _content;
    private readonly AppDbContext _db;
    private readonly IMediaStorage _media;
    public PublicContentController(IContentService content, AppDbContext db, IMediaStorage media) { _content = content; _db = db; _media = media; }

    [HttpGet("health")]
    public async Task<IActionResult> Health() => await _db.Database.CanConnectAsync() ? Ok(new { status = "ok", database = "connected" }) : StatusCode(503, new { status = "degraded", database = "unreachable" });

    // Only PUBLISHED content is ever returned here; drafts are invisible to customers.
    [HttpGet("content/homepage")] public async Task<IActionResult> Homepage() { Response.Headers.CacheControl = "no-store"; return Ok(await _content.GetPublicHomepageAsync()); }
    [HttpGet("content/pages")] public async Task<IActionResult> Pages() { Response.Headers.CacheControl = "no-store"; return Ok(await _content.GetPagesAsync(false)); }
    [HttpGet("settings/public")] public async Task<IActionResult> Settings() { Response.Headers.CacheControl = "no-store"; return Ok(await _content.GetPublicSettingsAsync()); }

    [HttpGet("gallery")]
    public async Task<IActionResult> Gallery() => Ok(await _db.GalleryImages.AsNoTracking().Where(g => g.IsVisible).OrderBy(g => g.SortOrder)
        .Select(g => new GalleryImageDto(g.Id, g.ImageUrl, g.Caption, g.SortOrder, g.IsVisible)).ToListAsync());

    [HttpGet("promotions")]
    public async Task<IActionResult> Promotions()
    {
        var now = DateTimeOffset.UtcNow;
        var rows = await _db.Promotions.AsNoTracking().Where(p => p.IsActive && (p.StartsAt == null || p.StartsAt <= now) && (p.EndsAt == null || p.EndsAt >= now)).ToListAsync();
        return Ok(rows.Select(p => new PromotionDto(p.Id, p.Title, p.Description, p.ImageUrl, p.Code, p.DiscountType.ToString(), p.DiscountValue, p.MinSubtotal, p.StartsAt, p.EndsAt, p.IsActive)));
    }

    [HttpGet("reviews")]
    public async Task<IActionResult> Reviews([FromQuery] int? productId) =>
        Ok(await _db.Reviews.AsNoTracking().Where(r => r.IsApproved && (productId == null || r.ProductId == productId)).OrderByDescending(r => r.CreatedAt).Take(30)
            .Select(r => new ReviewDto(r.Id, r.ProductId, r.AuthorName, r.Rating, r.Comment, r.IsApproved, r.CreatedAt)).ToListAsync());

    [Authorize, HttpPost("reviews")]
    public async Task<IActionResult> AddReview(ReviewRequest r)
    {
        var name = await _db.Users.Where(u => u.Id == UserId).Select(u => u.FullName).FirstAsync();
        _db.Reviews.Add(new Review { UserId = UserId, AuthorName = name, Rating = r.Rating, Comment = r.Comment.Trim(), ProductId = r.ProductId, IsApproved = false });
        await _db.SaveChangesAsync();
        return Ok(new { message = "Thank you! Your review will appear once approved." });
    }

    [HttpPost("newsletter"), EnableRateLimiting("auth")]
    public async Task<IActionResult> Subscribe(SubscribeRequest r)
    {
        var email = r.Email.Trim().ToLowerInvariant();
        var existing = await _db.NewsletterSubscribers.FirstOrDefaultAsync(s => s.Email == email);
        if (existing == null) _db.NewsletterSubscribers.Add(new NewsletterSubscriber { Email = email });
        else existing.IsActive = true;
        await _db.SaveChangesAsync();
        return Ok(new { message = "You're on the list. Welcome to the Nocturne Circle." });
    }

    [HttpGet("media/{name}")]
    public IActionResult Media(string name)
    {
        var f = _media.Open(name);
        if (f == null) return NotFound();
        Response.Headers.CacheControl = "public, max-age=31536000, immutable";
        return File(f.Value.Stream, f.Value.ContentType);
    }
}

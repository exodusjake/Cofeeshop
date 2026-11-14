using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NocturneCafe.Application;
using NocturneCafe.Domain;
using NocturneCafe.Infrastructure.Data;
using NocturneCafe.Infrastructure.Services;

namespace NocturneCafe.Api.Controllers;

// ============ Dashboard & reports ============
[Route("api/admin")]
public class AdminDashboardController : AdminBase
{
    private readonly IDashboardService _dash;
    public AdminDashboardController(IDashboardService dash) => _dash = dash;

    [HttpGet("dashboard")] public async Task<IActionResult> Dashboard() => Ok(await _dash.GetAsync());

    [HttpGet("reports/sales.csv")]
    public async Task<IActionResult> SalesCsv([FromQuery] DateTimeOffset? from, [FromQuery] DateTimeOffset? to)
    {
        var f = from ?? DateTimeOffset.UtcNow.AddDays(-30); var t = to ?? DateTimeOffset.UtcNow.AddDays(1);
        return File(Encoding.UTF8.GetBytes(await _dash.ExportSalesCsvAsync(f, t)), "text/csv", $"sales-{DateTime.UtcNow:yyyyMMdd}.csv");
    }
}

// ============ Orders ============
[Route("api/admin/orders")]
public class AdminOrdersController : AdminBase
{
    private readonly IOrderService _orders; private readonly IAuditService _audit;
    public AdminOrdersController(IOrderService orders, IAuditService audit) { _orders = orders; _audit = audit; }

    [HttpGet] public async Task<IActionResult> List([FromQuery] string? q, [FromQuery] string? status, [FromQuery] int page = 1, [FromQuery] int pageSize = 20) =>
        Ok(await _orders.ListAllAsync(q, status, page, pageSize));

    [HttpGet("{id:int}")]
    public async Task<IActionResult> Get(int id) => await _orders.GetAsync(id) is { } o ? Ok(o) : NotFound();

    [HttpPut("{id:int}/status")]
    public async Task<IActionResult> Status(int id, UpdateOrderStatusRequest r)
    {
        if (!Enum.TryParse<OrderStatus>(r.Status.Replace(" ", ""), true, out var s)) return BadRequest(new { title = "Unknown order status." });
        var o = await _orders.UpdateStatusAsync(id, s, r.Note, UserEmail);
        await _audit.LogAsync("OrderStatusChanged", "Order", id.ToString(), $"{o.OrderNumber} → {o.Status}");
        return Ok(o);
    }

    [HttpPut("{id:int}/payment")]
    public async Task<IActionResult> Payment(int id, UpdatePaymentStatusRequest r)
    {
        if (!Enum.TryParse<PaymentStatus>(r.Status, true, out var s)) return BadRequest(new { title = "Unknown payment status." });
        var o = await _orders.UpdatePaymentAsync(id, s, r.Reference, UserEmail);
        await _audit.LogAsync("PaymentStatusChanged", "Order", id.ToString(), $"{o.OrderNumber} payment → {o.PaymentStatus}");
        return Ok(o);
    }
}

// ============ Products, categories, inventory ============
[Route("api/admin")]
public class AdminCatalogController : AdminBase
{
    private readonly ICatalogService _catalog; private readonly IAuditService _audit; private readonly AppDbContext _db;
    public AdminCatalogController(ICatalogService catalog, IAuditService audit, AppDbContext db) { _catalog = catalog; _audit = audit; _db = db; }

    [HttpGet("products")]
    public async Task<IActionResult> Products([FromQuery] string? q, [FromQuery] int? categoryId, [FromQuery] int page = 1, [FromQuery] int pageSize = 100) =>
        Ok(await _catalog.SearchAsync(q, categoryId, null, null, page, pageSize, admin: true));

    [HttpGet("products/{id:int}")]
    public async Task<IActionResult> Product(int id) => await _catalog.GetAsync(id, true) is { } p ? Ok(p) : NotFound();

    [HttpPost("products")]
    public async Task<IActionResult> Create(ProductUpsertRequest r)
    {
        var p = await _catalog.CreateAsync(r);
        await _audit.LogAsync("ProductCreated", "Product", p.Id.ToString(), $"{p.Name} ₱{p.Price}");
        return CreatedAtAction(nameof(Product), new { id = p.Id }, p);
    }

    [HttpPut("products/{id:int}")]
    public async Task<IActionResult> Update(int id, ProductUpsertRequest r)
    {
        var p = await _catalog.UpdateAsync(id, r);
        await _audit.LogAsync("ProductUpdated", "Product", id.ToString(), $"{p.Name} ₱{p.Price} available={p.IsAvailable} featured={p.IsFeatured}");
        return Ok(p);
    }

    /// <summary>Soft delete (archive): completed orders keep their item snapshots.</summary>
    [HttpDelete("products/{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        if (!await _catalog.ArchiveAsync(id)) return NotFound();
        await _audit.LogAsync("ProductArchived", "Product", id.ToString());
        return NoContent();
    }

    [HttpGet("categories")] public async Task<IActionResult> Categories() => Ok(await _catalog.GetCategoriesAsync(true));

    [HttpPost("categories")]
    public async Task<IActionResult> AddCategory(CategoryRequest r)
    {
        var slug = CatalogService.Slugify(r.Name);
        if (await _db.Categories.AnyAsync(c => c.Slug == slug || c.Name == r.Name.Trim())) return Conflict(new { title = "A category with that name already exists." });
        var c = new Category { Name = r.Name.Trim(), Slug = slug, Description = r.Description?.Trim(), SortOrder = r.SortOrder, IsActive = r.IsActive };
        _db.Categories.Add(c); await _db.SaveChangesAsync();
        await _audit.LogAsync("CategoryCreated", "Category", c.Id.ToString(), c.Name);
        return Ok(new CategoryDto(c.Id, c.Name, c.Slug, c.Description, c.SortOrder, c.IsActive, 0));
    }

    [HttpPut("categories/{id:int}")]
    public async Task<IActionResult> UpdateCategory(int id, CategoryRequest r)
    {
        var c = await _db.Categories.FindAsync(id); if (c == null) return NotFound();
        var slug = CatalogService.Slugify(r.Name);
        if (await _db.Categories.AnyAsync(x => x.Id != id && (x.Slug == slug || x.Name == r.Name.Trim()))) return Conflict(new { title = "A category with that name already exists." });
        c.Name = r.Name.Trim(); c.Slug = slug; c.Description = r.Description?.Trim(); c.SortOrder = r.SortOrder; c.IsActive = r.IsActive;
        await _db.SaveChangesAsync();
        await _audit.LogAsync("CategoryUpdated", "Category", id.ToString(), c.Name);
        return Ok(new CategoryDto(c.Id, c.Name, c.Slug, c.Description, c.SortOrder, c.IsActive, await _db.Products.CountAsync(p => p.CategoryId == id && !p.IsArchived)));
    }

    [HttpDelete("categories/{id:int}")]
    public async Task<IActionResult> DeleteCategory(int id)
    {
        var c = await _db.Categories.FindAsync(id); if (c == null) return NotFound();
        if (await _db.Products.AnyAsync(p => p.CategoryId == id)) return Conflict(new { title = "This category still has products (including archived ones). Move or remove them, or just disable the category." });
        _db.Categories.Remove(c); await _db.SaveChangesAsync();
        await _audit.LogAsync("CategoryDeleted", "Category", id.ToString(), c.Name);
        return NoContent();
    }

    [HttpGet("inventory")] public async Task<IActionResult> Inventory() => Ok(await _catalog.GetInventoryAsync());

    [HttpPut("inventory/{productId:int}")]
    public async Task<IActionResult> UpdateInventory(int productId, InventoryUpdateRequest r)
    {
        var i = await _catalog.UpdateInventoryAsync(productId, r);
        await _audit.LogAsync("InventoryUpdated", "Product", productId.ToString(), $"track={r.TrackStock} qty={r.QuantityOnHand}");
        return Ok(i);
    }
}

// ============ Users ============
[Route("api/admin/users")]
public class AdminUsersController : AdminBase
{
    private readonly UserManager<ApplicationUser> _users; private readonly AppDbContext _db; private readonly IAuditService _audit; private readonly IOrderService _orders;
    public AdminUsersController(UserManager<ApplicationUser> users, AppDbContext db, IAuditService audit, IOrderService orders) { _users = users; _db = db; _audit = audit; _orders = orders; }

    private async Task<AdminUserDto> Dto(ApplicationUser u)
    {
        var roles = (await _users.GetRolesAsync(u)).ToArray();
        var stats = await _db.Orders.Where(o => o.UserId == u.Id && o.Status != OrderStatus.Cancelled).GroupBy(o => 1).Select(g => new { C = g.Count(), T = g.Sum(o => o.Total) }).FirstOrDefaultAsync();
        var phone = await _db.CustomerProfiles.Where(p => p.UserId == u.Id).Select(p => p.Phone).FirstOrDefaultAsync();
        return new AdminUserDto(u.Id, u.FullName, u.Email ?? "", u.EmailConfirmed, u.IsActive, roles, u.CreatedAt, stats?.C ?? 0, stats?.T ?? 0, phone);
    }

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? q, [FromQuery] string? role, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        page = Math.Max(1, page); pageSize = Math.Clamp(pageSize, 1, 100);
        var query = _db.Users.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(q)) { var t = q.Trim(); query = query.Where(u => EF.Functions.Like(u.FullName, "%" + t + "%") || EF.Functions.Like(u.Email!, "%" + t + "%")); }
        if (!string.IsNullOrWhiteSpace(role))
            query = query.Where(u => _db.UserRoles.Any(ur => ur.UserId == u.Id && _db.Roles.Any(r => r.Id == ur.RoleId && r.Name == role)));
        var total = await query.CountAsync();
        var rows = await query.OrderByDescending(u => u.CreatedAt).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
        var ids = rows.Select(r => r.Id).ToList();
        var roleMap = await (from ur in _db.UserRoles join r in _db.Roles on ur.RoleId equals r.Id where ids.Contains(ur.UserId) select new { ur.UserId, r.Name }).ToListAsync();
        var stats = await _db.Orders.Where(o => ids.Contains(o.UserId) && o.Status != OrderStatus.Cancelled).GroupBy(o => o.UserId).Select(g => new { g.Key, C = g.Count(), T = g.Sum(o => o.Total) }).ToListAsync();
        var phones = await _db.CustomerProfiles.Where(p => ids.Contains(p.UserId)).ToDictionaryAsync(p => p.UserId, p => p.Phone);
        var items = rows.Select(u => new AdminUserDto(u.Id, u.FullName, u.Email ?? "", u.EmailConfirmed, u.IsActive,
            roleMap.Where(x => x.UserId == u.Id).Select(x => x.Name!).ToArray(), u.CreatedAt,
            stats.FirstOrDefault(s => s.Key == u.Id)?.C ?? 0, stats.FirstOrDefault(s => s.Key == u.Id)?.T ?? 0, phones.GetValueOrDefault(u.Id))).ToList();
        return Ok(new PagedResult<AdminUserDto>(items, total, page, pageSize));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id)
    {
        var u = await _users.FindByIdAsync(id.ToString()); if (u == null) return NotFound();
        var userOrders = await _db.Orders.AsNoTracking().Include(o => o.Payment).Include(o => o.Items).Where(o => o.UserId == id).OrderByDescending(o => o.CreatedAt).Take(100).ToListAsync();
        var addresses = await _db.Addresses.AsNoTracking().Where(a => a.UserId == id).Select(a => new AddressDto(a.Id, a.Label, a.Recipient, a.Phone, a.Line1, a.Line2, a.City, a.PostalCode, a.Notes, a.IsDefault)).ToListAsync();
        await _audit.LogAsync("UserViewed", "User", id.ToString(), u.Email);
        return Ok(new AdminUserDetailDto(await Dto(u),
            userOrders.Select(o => new OrderSummaryDto(o.Id, o.OrderNumber, OrderService.StatusLabel(o.Status), o.Fulfillment.ToString(), o.Total, o.Payment?.Method.ToString() ?? "", o.Payment?.Status.ToString() ?? "", o.CustomerName, o.Items.Sum(i => i.Quantity), o.CreatedAt)).ToList(),
            addresses));
    }

    [HttpPut("{id:guid}/status")]
    public async Task<IActionResult> SetActive(Guid id, SetUserActiveRequest r)
    {
        if (id == UserId) return BadRequest(new { title = "You cannot disable your own account." });
        var u = await _users.FindByIdAsync(id.ToString()); if (u == null) return NotFound();
        u.IsActive = r.IsActive;
        await _users.UpdateAsync(u);
        await _users.UpdateSecurityStampAsync(u);     // invalidates existing sessions immediately
        await _audit.LogAsync(r.IsActive ? "UserReactivated" : "UserDisabled", "User", id.ToString(), u.Email);
        return Ok(await Dto(u));
    }

    /// <summary>Manual verification, for when the customer cannot receive the email (e.g. SES not yet in production mode).</summary>
    [HttpPut("{id:guid}/verify-email")]
    public async Task<IActionResult> VerifyEmail(Guid id)
    {
        var u = await _users.FindByIdAsync(id.ToString()); if (u == null) return NotFound();
        if (!u.EmailConfirmed) { u.EmailConfirmed = true; await _users.UpdateAsync(u); }
        await _audit.LogAsync("UserEmailVerifiedByAdmin", "User", id.ToString(), u.Email);
        return Ok(await Dto(u));
    }

    [HttpPut("{id:guid}/role")]
    public async Task<IActionResult> SetRole(Guid id, SetUserRoleRequest r)
    {
        if (r.Role is not (Roles.Admin or Roles.Customer)) return BadRequest(new { title = "Role must be Admin or Customer." });
        if (id == UserId) return BadRequest(new { title = "You cannot change your own role." });
        var u = await _users.FindByIdAsync(id.ToString()); if (u == null) return NotFound();
        var current = await _users.GetRolesAsync(u);
        await _users.RemoveFromRolesAsync(u, current);
        await _users.AddToRoleAsync(u, r.Role);
        await _users.UpdateSecurityStampAsync(u);
        await _audit.LogAsync("UserRoleChanged", "User", id.ToString(), $"{u.Email}: {string.Join(',', current)} → {r.Role}");
        return Ok(await Dto(u));
    }
}

// ============ Promotions, reviews, gallery, newsletter, media, audit ============
[Route("api/admin")]
public class AdminEngagementController : AdminBase
{
    private readonly AppDbContext _db; private readonly IAuditService _audit; private readonly IMediaStorage _media;
    public AdminEngagementController(AppDbContext db, IAuditService audit, IMediaStorage media) { _db = db; _audit = audit; _media = media; }

    private static PromotionDto Map(Promotion p) => new(p.Id, p.Title, p.Description, p.ImageUrl, p.Code, p.DiscountType.ToString(), p.DiscountValue, p.MinSubtotal, p.StartsAt, p.EndsAt, p.IsActive);
    private static void Apply(Promotion p, PromotionRequest r)
    {
        p.Title = r.Title.Trim(); p.Description = r.Description?.Trim(); p.ImageUrl = r.ImageUrl?.Trim(); p.Code = string.IsNullOrWhiteSpace(r.Code) ? null : r.Code.Trim().ToUpper();
        p.DiscountType = r.DiscountType; p.DiscountValue = r.DiscountValue; p.MinSubtotal = r.MinSubtotal; p.StartsAt = r.StartsAt; p.EndsAt = r.EndsAt; p.IsActive = r.IsActive;
    }

    [HttpGet("promotions")] public async Task<IActionResult> Promotions() => Ok((await _db.Promotions.AsNoTracking().OrderByDescending(p => p.Id).ToListAsync()).Select(Map));

    [HttpPost("promotions")]
    public async Task<IActionResult> AddPromo(PromotionRequest r)
    {
        var p = new Promotion(); Apply(p, r);
        if (p.Code != null && await _db.Promotions.AnyAsync(x => x.Code == p.Code)) return Conflict(new { title = "That promo code is already in use." });
        if (r.DiscountType == DiscountType.Percent && r.DiscountValue > 100) return BadRequest(new { title = "Percent discounts cannot exceed 100." });
        _db.Promotions.Add(p); await _db.SaveChangesAsync();
        await _audit.LogAsync("PromotionCreated", "Promotion", p.Id.ToString(), p.Title);
        return Ok(Map(p));
    }

    [HttpPut("promotions/{id:int}")]
    public async Task<IActionResult> UpdatePromo(int id, PromotionRequest r)
    {
        var p = await _db.Promotions.FindAsync(id); if (p == null) return NotFound();
        Apply(p, r);
        if (p.Code != null && await _db.Promotions.AnyAsync(x => x.Id != id && x.Code == p.Code)) return Conflict(new { title = "That promo code is already in use." });
        if (r.DiscountType == DiscountType.Percent && r.DiscountValue > 100) return BadRequest(new { title = "Percent discounts cannot exceed 100." });
        await _db.SaveChangesAsync();
        await _audit.LogAsync("PromotionUpdated", "Promotion", id.ToString(), p.Title);
        return Ok(Map(p));
    }

    [HttpDelete("promotions/{id:int}")]
    public async Task<IActionResult> DeletePromo(int id)
    {
        var p = await _db.Promotions.FindAsync(id); if (p == null) return NotFound();
        _db.Promotions.Remove(p); await _db.SaveChangesAsync();
        await _audit.LogAsync("PromotionDeleted", "Promotion", id.ToString(), p.Title);
        return NoContent();
    }

    [HttpGet("reviews")]
    public async Task<IActionResult> Reviews([FromQuery] bool? approved) =>
        Ok(await _db.Reviews.AsNoTracking().Where(r => approved == null || r.IsApproved == approved).OrderByDescending(r => r.CreatedAt).Take(200)
            .Select(r => new ReviewDto(r.Id, r.ProductId, r.AuthorName, r.Rating, r.Comment, r.IsApproved, r.CreatedAt)).ToListAsync());

    [HttpPut("reviews/{id:int}/approval")]
    public async Task<IActionResult> Approve(int id, [FromBody] SetUserActiveRequest r)
    {
        var rv = await _db.Reviews.FindAsync(id); if (rv == null) return NotFound();
        rv.IsApproved = r.IsActive; await _db.SaveChangesAsync();
        await _audit.LogAsync(r.IsActive ? "ReviewApproved" : "ReviewHidden", "Review", id.ToString());
        return Ok(new ReviewDto(rv.Id, rv.ProductId, rv.AuthorName, rv.Rating, rv.Comment, rv.IsApproved, rv.CreatedAt));
    }

    [HttpDelete("reviews/{id:int}")]
    public async Task<IActionResult> DeleteReview(int id)
    {
        var rv = await _db.Reviews.FindAsync(id); if (rv == null) return NotFound();
        _db.Reviews.Remove(rv); await _db.SaveChangesAsync();
        await _audit.LogAsync("ReviewDeleted", "Review", id.ToString());
        return NoContent();
    }

    [HttpGet("gallery")]
    public async Task<IActionResult> Gallery() => Ok(await _db.GalleryImages.AsNoTracking().OrderBy(g => g.SortOrder).Select(g => new GalleryImageDto(g.Id, g.ImageUrl, g.Caption, g.SortOrder, g.IsVisible)).ToListAsync());

    [HttpPost("gallery")]
    public async Task<IActionResult> AddGallery(GalleryImageRequest r)
    {
        var g = new GalleryImage { ImageUrl = r.ImageUrl.Trim(), Caption = r.Caption?.Trim(), SortOrder = r.SortOrder, IsVisible = r.IsVisible };
        _db.GalleryImages.Add(g); await _db.SaveChangesAsync();
        await _audit.LogAsync("GalleryImageAdded", "GalleryImage", g.Id.ToString());
        return Ok(new GalleryImageDto(g.Id, g.ImageUrl, g.Caption, g.SortOrder, g.IsVisible));
    }

    [HttpPut("gallery/{id:int}")]
    public async Task<IActionResult> UpdateGallery(int id, GalleryImageRequest r)
    {
        var g = await _db.GalleryImages.FindAsync(id); if (g == null) return NotFound();
        g.ImageUrl = r.ImageUrl.Trim(); g.Caption = r.Caption?.Trim(); g.SortOrder = r.SortOrder; g.IsVisible = r.IsVisible;
        await _db.SaveChangesAsync();
        await _audit.LogAsync("GalleryImageUpdated", "GalleryImage", id.ToString());
        return Ok(new GalleryImageDto(g.Id, g.ImageUrl, g.Caption, g.SortOrder, g.IsVisible));
    }

    [HttpDelete("gallery/{id:int}")]
    public async Task<IActionResult> DeleteGallery(int id)
    {
        var g = await _db.GalleryImages.FindAsync(id); if (g == null) return NotFound();
        _db.GalleryImages.Remove(g); await _db.SaveChangesAsync();
        await _audit.LogAsync("GalleryImageDeleted", "GalleryImage", id.ToString());
        return NoContent();
    }

    [HttpGet("newsletter")]
    public async Task<IActionResult> Newsletter() => Ok(await _db.NewsletterSubscribers.AsNoTracking().OrderByDescending(s => s.SubscribedAt).Take(1000).ToListAsync());

    [HttpPost("media"), RequestSizeLimit(6 * 1024 * 1024)]
    public async Task<IActionResult> Upload(IFormFile file)
    {
        if (file == null) return BadRequest(new { title = "No file uploaded." });
        await using var s = file.OpenReadStream();
        var m = await _media.SaveImageAsync(s, file.FileName, file.ContentType, file.Length, UserId);
        await _audit.LogAsync("MediaUploaded", "MediaAsset", m.Id.ToString(), m.OriginalName);
        return Ok(m);
    }

    [HttpGet("media")]
    public async Task<IActionResult> MediaList() => Ok(await _db.MediaAssets.AsNoTracking().OrderByDescending(m => m.CreatedAt).Take(100)
        .Select(m => new MediaDto(m.Id, m.Url, m.OriginalName, m.ContentType, m.SizeBytes, m.CreatedAt)).ToListAsync());

    [HttpGet("audit-logs")]
    public async Task<IActionResult> Audit([FromQuery] int page = 1, [FromQuery] int pageSize = 50)
    {
        page = Math.Max(1, page); pageSize = Math.Clamp(pageSize, 1, 200);
        var total = await _db.AdminAuditLogs.CountAsync();
        var items = await _db.AdminAuditLogs.AsNoTracking().OrderByDescending(a => a.Id).Skip((page - 1) * pageSize).Take(pageSize)
            .Select(a => new AuditLogDto(a.Id, a.UserEmail, a.Action, a.EntityType, a.EntityId, a.Details, a.IpAddress, a.CreatedAt)).ToListAsync();
        return Ok(new PagedResult<AuditLogDto>(items, total, page, pageSize));
    }
}

// ============ CMS / settings ============
[Route("api/admin")]
public class AdminContentController : AdminBase
{
    private readonly IContentService _content; private readonly IAuditService _audit;
    public AdminContentController(IContentService content, IAuditService audit) { _content = content; _audit = audit; }

    /// <summary>Draft view (what the editor sees and the preview page renders).</summary>
    [HttpGet("content/homepage")]
    public async Task<IActionResult> GetDraft() { Response.Headers.CacheControl = "no-store"; return Ok(await _content.GetDraftHomepageAsync()); }

    [HttpGet("content/pages")] public async Task<IActionResult> GetPages() => Ok(await _content.GetPagesAsync(true));

    [HttpPut("content/homepage")]
    public async Task<IActionResult> SaveSections(UpdateHomepageRequest r)
    {
        await _content.SaveSectionsAsync(r.Sections, UserEmail);
        await _audit.LogAsync("HomepageDraftSaved", "Homepage");
        return Ok(await _content.GetDraftHomepageAsync());
    }

    [HttpPut("content/pages")]
    public async Task<IActionResult> SavePages(UpdatePagesRequest r)
    {
        await _content.SavePagesAsync(r.Pages, UserEmail);
        await _audit.LogAsync("PageContentDraftSaved", "WebsiteContent", null, string.Join(',', r.Pages.Keys));
        return Ok(await _content.GetPagesAsync(true));
    }

    [HttpGet("settings")]
    public async Task<IActionResult> GetSettings() => Ok(await _content.GetDraftSettingsAsync());

    [HttpPut("settings")]
    public async Task<IActionResult> SaveSettings(UpdateSettingsRequest r)
    {
        await _content.SaveSettingsAsync(r.Settings, UserEmail);
        await _audit.LogAsync("SettingsDraftSaved", "SiteSettings", null, string.Join(',', r.Settings.Keys));
        return Ok(await _content.GetDraftSettingsAsync());
    }

    [HttpPost("content/publish")]
    public async Task<IActionResult> Publish(PublishRequest? r)
    {
        await _content.PublishAsync(r?.Note, UserEmail);
        await _audit.LogAsync("ContentPublished", "Homepage", null, r?.Note);
        return Ok(await _content.GetDraftHomepageAsync());
    }

    [HttpPost("content/unpublish")]
    public async Task<IActionResult> Unpublish(PublishRequest? r)
    {
        await _content.UnpublishAsync(r?.Note, UserEmail);
        await _audit.LogAsync("ContentUnpublished", "Homepage", null, r?.Note);
        return Ok(await _content.GetDraftHomepageAsync());
    }

    [HttpGet("content/history")] public async Task<IActionResult> History() => Ok(await _content.GetHistoryAsync());

    [HttpPost("content/history/{id:int}/restore")]
    public async Task<IActionResult> Restore(int id)
    {
        await _content.RestoreRevisionAsync(id, UserEmail);
        await _audit.LogAsync("ContentRevisionRestored", "Homepage", id.ToString());
        return Ok(await _content.GetDraftHomepageAsync());
    }
}

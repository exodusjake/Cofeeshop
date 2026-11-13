using Microsoft.EntityFrameworkCore;
using NocturneCafe.Application;
using NocturneCafe.Domain;
using NocturneCafe.Infrastructure.Data;

namespace NocturneCafe.Infrastructure.Services;

public class CatalogService : ICatalogService
{
    private readonly AppDbContext _db;
    public CatalogService(AppDbContext db) => _db = db;

    public static string Slugify(string s)
    {
        var chars = s.ToLowerInvariant().Normalize(System.Text.NormalizationForm.FormD)
            .Where(c => System.Globalization.CharUnicodeInfo.GetUnicodeCategory(c) != System.Globalization.UnicodeCategory.NonSpacingMark)
            .Select(c => char.IsLetterOrDigit(c) ? c : '-').ToArray();
        return string.Join('-', new string(chars).Split('-', StringSplitOptions.RemoveEmptyEntries));
    }

    public async Task<List<CategoryDto>> GetCategoriesAsync(bool includeInactive) =>
        await _db.Categories.AsNoTracking()
            .Where(c => includeInactive || c.IsActive)
            .OrderBy(c => c.SortOrder).ThenBy(c => c.Name)
            .Select(c => new CategoryDto(c.Id, c.Name, c.Slug, c.Description, c.SortOrder, c.IsActive,
                c.Products.Count(p => !p.IsArchived && (includeInactive || p.IsAvailable))))
            .ToListAsync();

    public async Task<PagedResult<ProductDto>> SearchAsync(string? q, int? categoryId, bool? featured, bool? signature, int page, int pageSize, bool admin)
    {
        page = Math.Max(1, page); pageSize = Math.Clamp(pageSize, 1, 100);
        var query = _db.Products.AsNoTracking().Where(p => !p.IsArchived);
        if (!admin) query = query.Where(p => p.IsAvailable && p.Category.IsActive);
        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim();
            query = query.Where(p => EF.Functions.Like(p.Name, "%" + term + "%") || EF.Functions.Like(p.Description, "%" + term + "%"));
        }
        if (categoryId.HasValue) query = query.Where(p => p.CategoryId == categoryId);
        if (featured == true) query = query.Where(p => p.IsFeatured);
        if (signature == true) query = query.Where(p => p.IsSignature);

        var total = await query.CountAsync();
        var items = await query.Include(p => p.Category).Include(p => p.Variants).Include(p => p.Addons).Include(p => p.Inventory)
            .OrderBy(p => p.Category.SortOrder).ThenBy(p => p.Name)
            .Skip((page - 1) * pageSize).Take(pageSize).AsSplitQuery().ToListAsync();
        return new PagedResult<ProductDto>(items.Select(p => Map(p, admin)).ToList(), total, page, pageSize);
    }

    public async Task<ProductDto?> GetAsync(int id, bool admin)
    {
        var p = await _db.Products.AsNoTracking().Include(x => x.Category).Include(x => x.Variants).Include(x => x.Addons)
            .Include(x => x.Inventory).AsSplitQuery().FirstOrDefaultAsync(x => x.Id == id && !x.IsArchived);
        if (p == null || (!admin && (!p.IsAvailable || !p.Category.IsActive))) return null;
        return Map(p, admin);
    }

    public async Task<ProductDto> CreateAsync(ProductUpsertRequest r)
    {
        await EnsureCategory(r.CategoryId);
        var p = new Product();
        Apply(p, r, isNew: true);
        _db.Products.Add(p);
        await _db.SaveChangesAsync();
        return (await GetAsync(p.Id, true))!;
    }

    public async Task<ProductDto> UpdateAsync(int id, ProductUpsertRequest r)
    {
        await EnsureCategory(r.CategoryId);
        var p = await _db.Products.Include(x => x.Variants).Include(x => x.Addons).Include(x => x.Inventory)
            .AsSplitQuery().FirstOrDefaultAsync(x => x.Id == id && !x.IsArchived)
            ?? throw new ServiceException("Product not found.", 404);
        Apply(p, r, isNew: false);
        await _db.SaveChangesAsync();
        return (await GetAsync(id, true))!;
    }

    public async Task<bool> ArchiveAsync(int id)
    {
        var p = await _db.Products.FirstOrDefaultAsync(x => x.Id == id && !x.IsArchived);
        if (p == null) return false;
        // Archive instead of hard delete: orders keep their snapshots, favorites/cart rows are cleaned up.
        p.IsArchived = true; p.IsAvailable = false; p.IsFeatured = false; p.UpdatedAt = DateTimeOffset.UtcNow;
        _db.CartItems.RemoveRange(_db.CartItems.Where(c => c.ProductId == id));
        _db.Favorites.RemoveRange(_db.Favorites.Where(f => f.ProductId == id));
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<List<InventoryDto>> GetInventoryAsync()
    {
        var rows = await _db.Products.AsNoTracking().Where(p => !p.IsArchived)
            .Include(p => p.Category).Include(p => p.Inventory).OrderBy(p => p.Name).ToListAsync();
        return rows.Select(p => ToInv(p)).ToList();
    }

    public async Task<InventoryDto> UpdateInventoryAsync(int productId, InventoryUpdateRequest r)
    {
        var p = await _db.Products.Include(x => x.Category).Include(x => x.Inventory)
            .FirstOrDefaultAsync(x => x.Id == productId && !x.IsArchived) ?? throw new ServiceException("Product not found.", 404);
        p.Inventory ??= new Inventory { ProductId = p.Id };
        p.Inventory.TrackStock = r.TrackStock; p.Inventory.QuantityOnHand = r.QuantityOnHand;
        p.Inventory.ReorderLevel = r.ReorderLevel; p.Inventory.UpdatedAt = DateTimeOffset.UtcNow;
        p.UpdatedAt = DateTimeOffset.UtcNow;
        try { await _db.SaveChangesAsync(); }
        catch (DbUpdateConcurrencyException) { throw new ServiceException("Inventory was changed by someone else. Reload and try again.", 409); }
        return ToInv(p);
    }

    private static InventoryDto ToInv(Product p)
    {
        var i = p.Inventory;
        return new InventoryDto(p.Id, p.Name, p.Category.Name, i?.TrackStock ?? false, i?.QuantityOnHand ?? 0, i?.ReorderLevel ?? 0,
            i is { TrackStock: true } && i.QuantityOnHand <= i.ReorderLevel);
    }

    private async Task EnsureCategory(int id)
    {
        if (!await _db.Categories.AnyAsync(c => c.Id == id)) throw new ServiceException("Category does not exist.");
    }

    private static void Apply(Product p, ProductUpsertRequest r, bool isNew)
    {
        p.Name = r.Name.Trim(); p.Description = r.Description.Trim(); p.ImageUrl = string.IsNullOrWhiteSpace(r.ImageUrl) ? null : r.ImageUrl.Trim();
        p.Price = r.Price; p.CategoryId = r.CategoryId; p.IsAvailable = r.IsAvailable; p.IsFeatured = r.IsFeatured;
        p.IsSignature = r.IsSignature; p.SupportsHot = r.SupportsHot; p.SupportsCold = r.SupportsCold;
        p.UpdatedAt = DateTimeOffset.UtcNow;
        if (isNew) p.CreatedAt = DateTimeOffset.UtcNow;

        // Variants: upsert by id, remove omitted ones
        var incomingV = r.Variants ?? new();
        foreach (var gone in p.Variants.Where(v => !incomingV.Any(x => x.Id == v.Id)).ToList()) p.Variants.Remove(gone);
        foreach (var v in incomingV)
        {
            var e = v.Id.HasValue ? p.Variants.FirstOrDefault(x => x.Id == v.Id) : null;
            if (e == null) { e = new ProductVariant(); p.Variants.Add(e); }
            e.Name = v.Name.Trim(); e.PriceDelta = v.PriceDelta; e.IsDefault = v.IsDefault;
        }
        if (p.Variants.Count > 0 && !p.Variants.Any(v => v.IsDefault)) p.Variants.First().IsDefault = true;

        var incomingA = r.Addons ?? new();
        foreach (var gone in p.Addons.Where(a => !incomingA.Any(x => x.Id == a.Id)).ToList()) p.Addons.Remove(gone);
        foreach (var a in incomingA)
        {
            var e = a.Id.HasValue ? p.Addons.FirstOrDefault(x => x.Id == a.Id) : null;
            if (e == null) { e = new ProductAddon(); p.Addons.Add(e); }
            e.Name = a.Name.Trim(); e.Price = a.Price; e.IsActive = a.IsActive;
        }

        p.Inventory ??= new Inventory();
        p.Inventory.TrackStock = r.TrackStock; p.Inventory.QuantityOnHand = r.QuantityOnHand;
        p.Inventory.ReorderLevel = r.ReorderLevel; p.Inventory.UpdatedAt = DateTimeOffset.UtcNow;
    }

    public static ProductDto Map(Product p, bool admin)
    {
        var inv = p.Inventory;
        var inStock = inv == null || !inv.TrackStock || inv.QuantityOnHand > 0;
        return new ProductDto(p.Id, p.Name, p.Description, p.ImageUrl, p.Price, p.CategoryId, p.Category?.Name ?? "",
            p.IsAvailable, p.IsFeatured, p.IsSignature, p.SupportsHot, p.SupportsCold, p.IsArchived, p.CreatedAt, p.UpdatedAt,
            p.Variants.OrderBy(v => v.PriceDelta).Select(v => new VariantDto(v.Id, v.Name, v.PriceDelta, v.IsDefault)).ToList(),
            p.Addons.Where(a => admin || a.IsActive).Select(a => new AddonDto(a.Id, a.Name, a.Price, a.IsActive)).ToList(),
            inv?.TrackStock ?? false, admin ? inv?.QuantityOnHand : null, admin ? inv?.ReorderLevel : null, inStock);
    }
}

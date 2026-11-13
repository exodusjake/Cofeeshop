using System.Globalization;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using NocturneCafe.Application;
using NocturneCafe.Domain;
using NocturneCafe.Infrastructure.Data;

namespace NocturneCafe.Infrastructure.Services;

public class DashboardService : IDashboardService
{
    private readonly AppDbContext _db;
    private readonly TimeZoneInfo _tz;

    public DashboardService(AppDbContext db, IConfiguration cfg)
    {
        _db = db;
        _tz = Resolve(cfg["Reporting:TimeZone"] ?? "Asia/Manila");
    }

    private static TimeZoneInfo Resolve(string id)
    {
        foreach (var candidate in new[] { id, "Singapore Standard Time", "UTC" })
        { try { return TimeZoneInfo.FindSystemTimeZoneById(candidate); } catch (TimeZoneNotFoundException) { } }
        return TimeZoneInfo.Utc;
    }

    private DateTime Local(DateTimeOffset d) => TimeZoneInfo.ConvertTime(d, _tz).DateTime;

    public async Task<DashboardDto> GetAsync()
    {
        var valid = _db.Orders.AsNoTracking().Where(o => o.Status != OrderStatus.Cancelled);
        var nowLocal = Local(DateTimeOffset.UtcNow);
        var todayStartUtc = new DateTimeOffset(nowLocal.Date, _tz.GetUtcOffset(nowLocal.Date)).ToUniversalTime();

        var totalSales = await valid.SumAsync(o => (decimal?)o.Total) ?? 0;
        var totalOrders = await _db.Orders.CountAsync();
        var customerRoleId = await _db.Roles.Where(r => r.Name == Roles.Customer).Select(r => r.Id).FirstOrDefaultAsync();
        var customers = await _db.UserRoles.CountAsync(ur => ur.RoleId == customerRoleId);
        var pending = await _db.Orders.CountAsync(o => o.Status == OrderStatus.Pending);
        var todayRevenue = await valid.Where(o => o.CreatedAt >= todayStartUtc).SumAsync(o => (decimal?)o.Total) ?? 0;
        var activeProducts = await _db.Products.CountAsync(p => !p.IsArchived && p.IsAvailable);
        var lowStock = await _db.Inventory.CountAsync(i => i.TrackStock && i.QuantityOnHand <= i.ReorderLevel && !i.Product.IsArchived);

        // Daily sales: last 14 days
        var from14 = todayStartUtc.AddDays(-13);
        var recent = await valid.Where(o => o.CreatedAt >= from14).Select(o => new { o.CreatedAt, o.Total }).ToListAsync();
        var daily = Enumerable.Range(0, 14).Select(i => nowLocal.Date.AddDays(-13 + i)).Select(d =>
        {
            var rows = recent.Where(r => Local(r.CreatedAt).Date == d).ToList();
            return new SeriesPoint(d.ToString("MMM d", CultureInfo.InvariantCulture), rows.Sum(r => r.Total), rows.Count);
        }).ToList();

        // Monthly revenue: last 12 months
        var monthStart = new DateTime(nowLocal.Year, nowLocal.Month, 1).AddMonths(-11);
        var from12 = new DateTimeOffset(monthStart, _tz.GetUtcOffset(monthStart)).ToUniversalTime();
        var yearRows = await valid.Where(o => o.CreatedAt >= from12).Select(o => new { o.CreatedAt, o.Total }).ToListAsync();
        var monthly = Enumerable.Range(0, 12).Select(i => monthStart.AddMonths(i)).Select(m =>
        {
            var rows = yearRows.Where(r => { var l = Local(r.CreatedAt); return l.Year == m.Year && l.Month == m.Month; }).ToList();
            return new SeriesPoint(m.ToString("MMM yyyy", CultureInfo.InvariantCulture), rows.Sum(r => r.Total), rows.Count);
        }).ToList();

        var best = await _db.OrderItems.AsNoTracking().Where(i => i.Order.Status != OrderStatus.Cancelled)
            .GroupBy(i => i.ProductName)
            .Select(g => new { Name = g.Key, Qty = g.Sum(x => x.Quantity), Rev = g.Sum(x => x.LineTotal) })
            .OrderByDescending(x => x.Qty).Take(6).ToListAsync();

        var byStatus = await _db.Orders.AsNoTracking().GroupBy(o => o.Status).Select(g => new { g.Key, C = g.Count() }).ToListAsync();
        var stats = Enum.GetValues<OrderStatus>().Select(s => new StatusCount(OrderService.StatusLabel(s), byStatus.FirstOrDefault(x => x.Key == s)?.C ?? 0)).ToList();

        var byCat = await _db.OrderItems.AsNoTracking().Where(i => i.Order.Status != OrderStatus.Cancelled)
            .GroupBy(i => i.CategoryName).Select(g => new { g.Key, Rev = g.Sum(x => x.LineTotal), C = g.Sum(x => x.Quantity) })
            .OrderByDescending(x => x.Rev).ToListAsync();

        return new DashboardDto(totalSales, totalOrders, customers, pending, todayRevenue, activeProducts, daily, monthly,
            best.Select(b => new BestSeller(b.Name, b.Qty, b.Rev)).ToList(), stats,
            byCat.Select(c => new SeriesPoint(c.Key, c.Rev, c.C)).ToList(), lowStock);
    }

    public async Task<string> ExportSalesCsvAsync(DateTimeOffset from, DateTimeOffset to)
    {
        var rows = await _db.Orders.AsNoTracking().Include(o => o.Payment).Where(o => o.CreatedAt >= from && o.CreatedAt < to)
            .OrderBy(o => o.CreatedAt).ToListAsync();
        var sb = new StringBuilder("OrderNumber,Date,Customer,Status,Fulfillment,Payment,PaymentStatus,Subtotal,Discount,DeliveryFee,Total\n");
        foreach (var o in rows)
            sb.AppendLine(string.Join(',', Csv(o.OrderNumber), Csv(Local(o.CreatedAt).ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture)), Csv(o.CustomerName),
                Csv(OrderService.StatusLabel(o.Status)), o.Fulfillment, o.Payment?.Method, o.Payment?.Status,
                o.Subtotal.ToString("0.00", CultureInfo.InvariantCulture), o.Discount.ToString("0.00", CultureInfo.InvariantCulture),
                o.DeliveryFee.ToString("0.00", CultureInfo.InvariantCulture), o.Total.ToString("0.00", CultureInfo.InvariantCulture)));
        return sb.ToString();
    }

    // CSV injection safe: neutralise leading formula characters
    private static string Csv(string s)
    {
        if (s.Length > 0 && "=+-@\t\r".Contains(s[0])) s = "'" + s;
        return "\"" + s.Replace("\"", "\"\"") + "\"";
    }
}

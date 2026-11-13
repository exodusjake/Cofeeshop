using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using NocturneCafe.Application;
using NocturneCafe.Domain;
using NocturneCafe.Infrastructure.Data;
using NocturneCafe.Infrastructure.Services;
using Xunit;

namespace NocturneCafe.Tests;

/// <summary>Business-rule tests run against EF Core's in-memory provider (fast, no SQL Server needed).
/// Provider-specific behaviour (row versions, SQL translation) is covered by the manual checklist in docs/TESTING.md.</summary>
public class ServiceTests
{
    private static AppDbContext NewDb()
    {
        var o = new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning)).Options;
        return new AppDbContext(o);
    }

    private sealed class NoGateways : IPaymentGateway
    {
        public bool Supports(PaymentMethod m) => false;
        public Task<PaymentResult> CreateChargeAsync(PaymentMethod m, decimal a, string n) => Task.FromResult(new PaymentResult(false, PaymentStatus.Failed, null, "none"));
    }

    private static async Task<(AppDbContext db, Guid user, Product latte)> Seed()
    {
        var db = NewDb();
        var user = new ApplicationUser { Id = Guid.NewGuid(), UserName = "a@b.com", Email = "a@b.com", FullName = "Ana Cruz" };
        var cat = new Category { Name = "Coffee", Slug = "coffee" };
        var latte = new Product
        {
            Name = "Midnight Latte", Description = "x", Price = 185, Category = cat, SupportsHot = true, SupportsCold = true,
            Variants = { new ProductVariant { Name = "Medium", PriceDelta = 0, IsDefault = true }, new ProductVariant { Name = "Large", PriceDelta = 25 } },
            Addons = { new ProductAddon { Name = "Oat milk", Price = 45 } },
            Inventory = new Inventory { TrackStock = true, QuantityOnHand = 5 }
        };
        db.AddRange(user, cat, latte);
        db.Promotions.Add(new Promotion { Title = "Ten", Code = "TEN", DiscountType = DiscountType.Percent, DiscountValue = 10 });
        await db.SaveChangesAsync();
        return (db, user.Id, latte);
    }

    [Fact]
    public async Task Cart_prices_come_from_the_server_including_size_and_addons()
    {
        var (db, uid, p) = await Seed();
        var cart = new CartService(db);
        var large = p.Variants.First(v => v.Name == "Large").Id;
        var res = await cart.AddAsync(uid, new CartItemRequest(p.Id, large, "Iced", new() { p.Addons[0].Id }, 2, null));
        Assert.Equal(185 + 25 + 45, res.Items.Single().UnitPrice);
        Assert.Equal((185 + 25 + 45) * 2, res.Subtotal);
    }

    [Fact]
    public async Task Cart_rejects_unavailable_or_invalid_selection()
    {
        var (db, uid, p) = await Seed();
        var cart = new CartService(db);
        await Assert.ThrowsAsync<ServiceException>(() => cart.AddAsync(uid, new CartItemRequest(p.Id, 99999, "Hot", null, 1, null)));
        await Assert.ThrowsAsync<ServiceException>(() => cart.AddAsync(uid, new CartItemRequest(p.Id, null, "Lukewarm", null, 1, null)));
        p.IsAvailable = false; await db.SaveChangesAsync();
        await Assert.ThrowsAsync<ServiceException>(() => cart.AddAsync(uid, new CartItemRequest(p.Id, null, "Hot", null, 1, null)));
    }

    [Fact]
    public async Task Checkout_creates_order_with_snapshots_discount_stock_and_clears_cart()
    {
        var (db, uid, p) = await Seed();
        var cart = new CartService(db); var orders = new OrderService(db, cart, new[] { new NoGateways() });
        await cart.AddAsync(uid, new CartItemRequest(p.Id, null, "Hot", null, 2, null));
        var o = await orders.CheckoutAsync(uid, new CheckoutRequest(FulfillmentType.Pickup, PaymentMethod.CashOnPickup, null, "0917", null, "ten"));

        Assert.Equal(370, o.Subtotal); Assert.Equal(37, o.Discount); Assert.Equal(333, o.Total);
        Assert.Equal("Pending", o.Status); Assert.Equal("Midnight Latte", o.Items.Single().ProductName);
        Assert.Equal(3, db.Inventory.Single().QuantityOnHand);
        Assert.Empty((await cart.GetAsync(uid)).Items);

        // Order history survives product changes / archival
        p.Name = "Renamed"; p.Price = 999; await db.SaveChangesAsync();
        Assert.Equal("Midnight Latte", (await orders.GetAsync(o.Id))!.Items.Single().ProductName);
    }

    [Fact]
    public async Task Checkout_enforces_payment_rules_and_stock()
    {
        var (db, uid, p) = await Seed();
        var cart = new CartService(db); var orders = new OrderService(db, cart, new[] { new NoGateways() });
        await Assert.ThrowsAsync<ServiceException>(() => orders.CheckoutAsync(uid, new CheckoutRequest(FulfillmentType.Pickup, PaymentMethod.CashOnPickup, null, "1", null, null))); // empty cart

        await cart.AddAsync(uid, new CartItemRequest(p.Id, null, "Hot", null, 1, null));
        await Assert.ThrowsAsync<ServiceException>(() => orders.CheckoutAsync(uid, new CheckoutRequest(FulfillmentType.Delivery, PaymentMethod.CashOnPickup, null, "1", null, null)));
        var ex = await Assert.ThrowsAsync<ServiceException>(() => orders.CheckoutAsync(uid, new CheckoutRequest(FulfillmentType.Pickup, PaymentMethod.GCash, null, "1", null, null)));
        Assert.Contains("not configured", ex.Message);

        db.Inventory.Single().QuantityOnHand = 0; await db.SaveChangesAsync();
        await Assert.ThrowsAsync<ServiceException>(() => orders.CheckoutAsync(uid, new CheckoutRequest(FulfillmentType.Pickup, PaymentMethod.CashOnPickup, null, "1", null, null)));
    }

    [Fact]
    public async Task Customers_cannot_read_other_customers_orders()
    {
        var (db, uid, p) = await Seed();
        var cart = new CartService(db); var orders = new OrderService(db, cart, new[] { new NoGateways() });
        await cart.AddAsync(uid, new CartItemRequest(p.Id, null, "Hot", null, 1, null));
        var o = await orders.CheckoutAsync(uid, new CheckoutRequest(FulfillmentType.Pickup, PaymentMethod.CashOnPickup, null, "1", null, null));
        Assert.NotNull(await orders.GetForUserAsync(uid, o.Id));
        Assert.Null(await orders.GetForUserAsync(Guid.NewGuid(), o.Id));
        Assert.Empty(await orders.ListForUserAsync(Guid.NewGuid()));
    }

    [Fact]
    public async Task Order_status_flow_restores_stock_on_cancel_and_awards_points_on_completion()
    {
        var (db, uid, p) = await Seed();
        var cart = new CartService(db); var orders = new OrderService(db, cart, new[] { new NoGateways() });

        await cart.AddAsync(uid, new CartItemRequest(p.Id, null, "Hot", null, 2, null));
        var a = await orders.CheckoutAsync(uid, new CheckoutRequest(FulfillmentType.Pickup, PaymentMethod.CashOnPickup, null, "1", null, null));
        await orders.UpdateStatusAsync(a.Id, OrderStatus.Cancelled, null, "admin");
        Assert.Equal(5, db.Inventory.Single().QuantityOnHand);
        await Assert.ThrowsAsync<ServiceException>(() => orders.UpdateStatusAsync(a.Id, OrderStatus.Confirmed, null, "admin"));

        await cart.AddAsync(uid, new CartItemRequest(p.Id, null, "Hot", null, 1, null));
        var b = await orders.CheckoutAsync(uid, new CheckoutRequest(FulfillmentType.Pickup, PaymentMethod.CashOnPickup, null, "1", null, null));
        await Assert.ThrowsAsync<ServiceException>(() => orders.UpdateStatusAsync(b.Id, OrderStatus.OutForDelivery, null, "admin")); // pickup order
        await orders.UpdateStatusAsync(b.Id, OrderStatus.Confirmed, null, "admin");
        await orders.UpdateStatusAsync(b.Id, OrderStatus.ReadyForPickup, null, "admin");
        var done = await orders.UpdateStatusAsync(b.Id, OrderStatus.Completed, null, "admin");
        Assert.Equal("Paid", done.PaymentStatus);
        Assert.Equal(18, (await db.CustomerProfiles.SingleAsync()).RewardPoints); // ₱185 / 10
    }

    [Fact]
    public async Task Cms_draft_is_invisible_until_published_and_disabled_sections_disappear()
    {
        var db = NewDb();
        const string seed = "{\"title\":\"Old\"}";
        db.HomepageSections.AddRange(
            new HomepageSection { Key = "hero", Name = "Hero", SortOrder = 1, IsEnabled = true, ContentJson = seed, PublishedSortOrder = 1, PublishedIsEnabled = true, PublishedContentJson = seed },
            new HomepageSection { Key = "gallery", Name = "Gallery", SortOrder = 2, IsEnabled = true, ContentJson = "{}", PublishedSortOrder = 2, PublishedIsEnabled = true, PublishedContentJson = "{}" });
        await db.SaveChangesAsync();
        var cms = new ContentService(db);

        var draft = System.Text.Json.JsonSerializer.SerializeToElement(new { title = "New hero" });
        await cms.SaveSectionsAsync(new() { new SectionDto("hero", "Hero", 1, true, draft), new SectionDto("gallery", "Gallery", 2, false, draft) }, "admin");

        var pub = await cms.GetPublicHomepageAsync();
        Assert.Equal("Old", pub.Sections.Single(s => s.Key == "hero").Content.GetProperty("title").GetString()); // draft hidden
        Assert.Contains(pub.Sections, s => s.Key == "gallery");
        Assert.True((await cms.GetDraftHomepageAsync()).HasUnpublishedChanges);

        await cms.PublishAsync("go", "admin");
        pub = await cms.GetPublicHomepageAsync();
        Assert.Equal("New hero", pub.Sections.Single(s => s.Key == "hero").Content.GetProperty("title").GetString());
        Assert.DoesNotContain(pub.Sections, s => s.Key == "gallery");   // disabled section disappears

        await cms.UnpublishAsync(null, "admin");
        Assert.Empty((await cms.GetPublicHomepageAsync()).Sections);
        Assert.NotEmpty(await cms.GetHistoryAsync());
    }

    [Fact]
    public async Task Cms_rejects_unsafe_content_and_unknown_settings()
    {
        var db = NewDb(); var cms = new ContentService(db);
        await Assert.ThrowsAsync<ServiceException>(() => cms.SaveSettingsAsync(new() { ["secret.key"] = "x" }, "a"));
        await Assert.ThrowsAsync<ServiceException>(() => cms.SaveSettingsAsync(new() { ["theme.color.gold"] = "red" }, "a"));
        await Assert.ThrowsAsync<ServiceException>(() => cms.SaveSettingsAsync(new() { ["social.instagram"] = "javascript:alert(1)" }, "a"));
    }

    [Fact]
    public async Task Catalog_hides_archived_and_unavailable_products_from_public()
    {
        var (db, _, p) = await Seed();
        var catalog = new CatalogService(db);
        Assert.Single((await catalog.SearchAsync(null, null, null, null, 1, 50, admin: false)).Items);
        p.IsAvailable = false; await db.SaveChangesAsync();
        Assert.Empty((await catalog.SearchAsync(null, null, null, null, 1, 50, admin: false)).Items);
        Assert.Single((await catalog.SearchAsync(null, null, null, null, 1, 50, admin: true)).Items);
        Assert.True(await catalog.ArchiveAsync(p.Id));
        Assert.Empty((await catalog.SearchAsync(null, null, null, null, 1, 50, admin: true)).Items);
    }
}

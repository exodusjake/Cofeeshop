using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using NocturneCafe.Domain;

namespace NocturneCafe.Infrastructure.Data;

public class AppDbContext : IdentityDbContext<ApplicationUser, ApplicationRole, Guid>
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<CustomerProfile> CustomerProfiles => Set<CustomerProfile>();
    public DbSet<Address> Addresses => Set<Address>();
    public DbSet<Favorite> Favorites => Set<Favorite>();
    public DbSet<RewardTransaction> RewardTransactions => Set<RewardTransaction>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<ProductVariant> ProductVariants => Set<ProductVariant>();
    public DbSet<ProductAddon> ProductAddons => Set<ProductAddon>();
    public DbSet<Inventory> Inventory => Set<Inventory>();
    public DbSet<Cart> Carts => Set<Cart>();
    public DbSet<CartItem> CartItems => Set<CartItem>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();
    public DbSet<OrderStatusHistory> OrderStatusHistory => Set<OrderStatusHistory>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<HomepageSection> HomepageSections => Set<HomepageSection>();
    public DbSet<WebsiteContent> WebsiteContent => Set<WebsiteContent>();
    public DbSet<SiteSetting> SiteSettings => Set<SiteSetting>();
    public DbSet<ContentRevision> ContentRevisions => Set<ContentRevision>();
    public DbSet<GalleryImage> GalleryImages => Set<GalleryImage>();
    public DbSet<MediaAsset> MediaAssets => Set<MediaAsset>();
    public DbSet<Promotion> Promotions => Set<Promotion>();
    public DbSet<Review> Reviews => Set<Review>();
    public DbSet<AdminAuditLog> AdminAuditLogs => Set<AdminAuditLog>();
    public DbSet<NewsletterSubscriber> NewsletterSubscribers => Set<NewsletterSubscriber>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b);

        // Money: DECIMAL(18,2) everywhere
        foreach (var p in b.Model.GetEntityTypes().SelectMany(t => t.GetProperties())
                     .Where(p => p.ClrType == typeof(decimal) || p.ClrType == typeof(decimal?)))
            p.SetColumnType("decimal(18,2)");

        b.Entity<ApplicationUser>(e =>
        {
            e.Property(x => x.FullName).HasMaxLength(120);
            e.HasOne(x => x.Profile).WithOne(x => x.User).HasForeignKey<CustomerProfile>(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<CustomerProfile>(e =>
        {
            e.HasKey(x => x.UserId);
            e.Property(x => x.Phone).HasMaxLength(30);
        });

        b.Entity<Address>(e =>
        {
            e.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => x.UserId);
            e.Property(x => x.Label).HasMaxLength(40);
            e.Property(x => x.Recipient).HasMaxLength(120);
            e.Property(x => x.Phone).HasMaxLength(30);
            e.Property(x => x.Line1).HasMaxLength(200);
            e.Property(x => x.Line2).HasMaxLength(200);
            e.Property(x => x.City).HasMaxLength(100);
            e.Property(x => x.PostalCode).HasMaxLength(20);
            e.Property(x => x.Notes).HasMaxLength(300);
        });

        b.Entity<Favorite>(e =>
        {
            e.HasKey(x => new { x.UserId, x.ProductId });
            e.HasOne<ApplicationUser>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Product).WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<RewardTransaction>(e =>
        {
            e.HasOne<ApplicationUser>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => x.UserId);
            e.Property(x => x.Description).HasMaxLength(200);
            e.Property(x => x.Kind).HasConversion<string>().HasMaxLength(20);
        });

        b.Entity<Category>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(80);
            e.Property(x => x.Slug).HasMaxLength(80);
            e.Property(x => x.Description).HasMaxLength(300);
            e.HasIndex(x => x.Slug).IsUnique();
            e.HasIndex(x => x.Name).IsUnique();
        });

        b.Entity<Product>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(150);
            e.Property(x => x.Description).HasMaxLength(1000);
            e.Property(x => x.ImageUrl).HasMaxLength(500);
            e.HasOne(x => x.Category).WithMany(c => c.Products).HasForeignKey(x => x.CategoryId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => new { x.CategoryId, x.IsArchived, x.IsAvailable });
            e.HasIndex(x => x.Name);
            e.HasOne(x => x.Inventory).WithOne(i => i.Product).HasForeignKey<Inventory>(i => i.ProductId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<ProductVariant>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(60);
            e.HasOne(x => x.Product).WithMany(p => p.Variants).HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<ProductAddon>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(80);
            e.HasOne(x => x.Product).WithMany(p => p.Addons).HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<Inventory>(e =>
        {
            e.HasKey(x => x.ProductId);
            e.Property(x => x.RowVersion).IsRowVersion();
        });

        b.Entity<Cart>(e =>
        {
            e.HasOne<ApplicationUser>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => x.UserId).IsUnique();
        });

        b.Entity<CartItem>(e =>
        {
            e.HasOne(x => x.Cart).WithMany(c => c.Items).HasForeignKey(x => x.CartId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Product).WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Cascade);
            e.Property(x => x.Temperature).HasMaxLength(10);
            e.Property(x => x.AddonIds).HasMaxLength(200);
            e.Property(x => x.Notes).HasMaxLength(300);
        });

        b.Entity<Order>(e =>
        {
            e.Property(x => x.OrderNumber).HasMaxLength(30);
            e.HasIndex(x => x.OrderNumber).IsUnique();
            e.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => new { x.UserId, x.CreatedAt });
            e.HasIndex(x => new { x.Status, x.CreatedAt });
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.Fulfillment).HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.PromoCode).HasMaxLength(40);
            e.Property(x => x.CustomerName).HasMaxLength(120);
            e.Property(x => x.CustomerEmail).HasMaxLength(256);
            e.Property(x => x.CustomerPhone).HasMaxLength(30);
            e.Property(x => x.DeliveryAddress).HasMaxLength(600);
            e.Property(x => x.Notes).HasMaxLength(500);
            e.Property(x => x.RowVersion).IsRowVersion();
        });

        b.Entity<OrderItem>(e =>
        {
            e.HasOne(x => x.Order).WithMany(o => o.Items).HasForeignKey(x => x.OrderId).OnDelete(DeleteBehavior.Cascade);
            // Snapshot columns; ProductId is intentionally NOT a foreign key so history never depends on the catalog.
            e.Property(x => x.ProductName).HasMaxLength(150);
            e.Property(x => x.CategoryName).HasMaxLength(80);
            e.Property(x => x.Size).HasMaxLength(60);
            e.Property(x => x.Temperature).HasMaxLength(10);
            e.Property(x => x.AddonsSnapshot).HasMaxLength(1000);
            e.Property(x => x.Notes).HasMaxLength(300);
            e.HasIndex(x => x.ProductId);
        });

        b.Entity<OrderStatusHistory>(e =>
        {
            e.HasOne(x => x.Order).WithMany(o => o.History).HasForeignKey(x => x.OrderId).OnDelete(DeleteBehavior.Cascade);
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.Note).HasMaxLength(300);
            e.Property(x => x.ChangedBy).HasMaxLength(256);
        });

        b.Entity<Payment>(e =>
        {
            e.HasOne(x => x.Order).WithOne(o => o.Payment).HasForeignKey<Payment>(x => x.OrderId).OnDelete(DeleteBehavior.Cascade);
            e.Property(x => x.Method).HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.Provider).HasMaxLength(40);
            e.Property(x => x.ProviderReference).HasMaxLength(120);
        });

        b.Entity<HomepageSection>(e =>
        {
            e.Property(x => x.Key).HasMaxLength(40);
            e.Property(x => x.Name).HasMaxLength(80);
            e.HasIndex(x => x.Key).IsUnique();
        });

        b.Entity<WebsiteContent>(e =>
        {
            e.Property(x => x.Key).HasMaxLength(100);
            e.HasIndex(x => x.Key).IsUnique();
        });

        b.Entity<SiteSetting>(e =>
        {
            e.Property(x => x.Key).HasMaxLength(100);
            e.HasIndex(x => x.Key).IsUnique();
        });

        b.Entity<ContentRevision>(e =>
        {
            e.Property(x => x.Action).HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.ChangedBy).HasMaxLength(256);
            e.Property(x => x.Note).HasMaxLength(300);
        });

        b.Entity<GalleryImage>(e =>
        {
            e.Property(x => x.ImageUrl).HasMaxLength(500);
            e.Property(x => x.Caption).HasMaxLength(200);
        });

        b.Entity<MediaAsset>(e =>
        {
            e.Property(x => x.OriginalName).HasMaxLength(260);
            e.Property(x => x.StoredName).HasMaxLength(100);
            e.Property(x => x.ContentType).HasMaxLength(60);
            e.Property(x => x.Url).HasMaxLength(300);
            e.HasIndex(x => x.StoredName).IsUnique();
        });

        b.Entity<Promotion>(e =>
        {
            e.Property(x => x.Title).HasMaxLength(150);
            e.Property(x => x.Description).HasMaxLength(500);
            e.Property(x => x.ImageUrl).HasMaxLength(500);
            e.Property(x => x.Code).HasMaxLength(40);
            e.Property(x => x.DiscountType).HasConversion<string>().HasMaxLength(10);
            e.HasIndex(x => x.Code).IsUnique().HasFilter("[Code] IS NOT NULL");
        });

        b.Entity<Review>(e =>
        {
            e.Property(x => x.AuthorName).HasMaxLength(120);
            e.Property(x => x.Comment).HasMaxLength(1000);
            e.HasOne<Product>().WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.SetNull);
            e.HasOne<ApplicationUser>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.SetNull);
            e.HasIndex(x => new { x.IsApproved, x.CreatedAt });
        });

        b.Entity<AdminAuditLog>(e =>
        {
            e.Property(x => x.UserEmail).HasMaxLength(256);
            e.Property(x => x.Action).HasMaxLength(80);
            e.Property(x => x.EntityType).HasMaxLength(60);
            e.Property(x => x.EntityId).HasMaxLength(60);
            e.Property(x => x.Details).HasMaxLength(2000);
            e.Property(x => x.IpAddress).HasMaxLength(60);
            e.HasIndex(x => x.CreatedAt);
        });

        b.Entity<NewsletterSubscriber>(e =>
        {
            e.Property(x => x.Email).HasMaxLength(256);
            e.HasIndex(x => x.Email).IsUnique();
        });
    }
}

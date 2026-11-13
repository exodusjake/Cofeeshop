using Microsoft.AspNetCore.Identity;

namespace NocturneCafe.Domain;

public static class Roles
{
    public const string Customer = "Customer";
    public const string Admin = "Admin";
}

public enum OrderStatus { Pending = 0, Confirmed = 1, Preparing = 2, ReadyForPickup = 3, OutForDelivery = 4, Completed = 5, Cancelled = 6 }
public enum FulfillmentType { Pickup = 0, Delivery = 1 }
public enum PaymentMethod { CashOnPickup = 0, CashOnDelivery = 1, GCash = 2, Card = 3 }
public enum PaymentStatus { Pending = 0, Paid = 1, Failed = 2, Refunded = 3 }
public enum DiscountType { Percent = 0, Fixed = 1 }
public enum ContentAction { SaveDraft = 0, Publish = 1, Unpublish = 2, Restore = 3 }
public enum RewardKind { Earned = 0, Redeemed = 1, Adjustment = 2 }

// ---------- Identity ----------
public class ApplicationUser : IdentityUser<Guid>
{
    public string FullName { get; set; } = "";
    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public CustomerProfile? Profile { get; set; }
}

public class ApplicationRole : IdentityRole<Guid>
{
    public ApplicationRole() { }
    public ApplicationRole(string name) : base(name) { }
}

// ---------- Customer ----------
public class CustomerProfile
{
    public Guid UserId { get; set; }
    public ApplicationUser User { get; set; } = null!;
    public string? Phone { get; set; }
    public DateOnly? Birthday { get; set; }
    public int RewardPoints { get; set; }
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class Address
{
    public int Id { get; set; }
    public Guid UserId { get; set; }
    public ApplicationUser User { get; set; } = null!;
    public string Label { get; set; } = "Home";
    public string Recipient { get; set; } = "";
    public string Phone { get; set; } = "";
    public string Line1 { get; set; } = "";
    public string? Line2 { get; set; }
    public string City { get; set; } = "";
    public string? PostalCode { get; set; }
    public string? Notes { get; set; }
    public bool IsDefault { get; set; }
}

public class Favorite
{
    public Guid UserId { get; set; }
    public int ProductId { get; set; }
    public Product Product { get; set; } = null!;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class RewardTransaction
{
    public int Id { get; set; }
    public Guid UserId { get; set; }
    public int? OrderId { get; set; }
    public RewardKind Kind { get; set; }
    public int Points { get; set; }
    public string Description { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

// ---------- Catalog ----------
public class Category
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Slug { get; set; } = "";
    public string? Description { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
    public List<Product> Products { get; set; } = new();
}

public class Product
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Description { get; set; } = "";
    public string? ImageUrl { get; set; }
    public decimal Price { get; set; }
    public int CategoryId { get; set; }
    public Category Category { get; set; } = null!;
    public bool IsAvailable { get; set; } = true;
    public bool IsFeatured { get; set; }
    public bool IsSignature { get; set; }
    public bool IsArchived { get; set; }
    public bool SupportsHot { get; set; }
    public bool SupportsCold { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public List<ProductVariant> Variants { get; set; } = new();
    public List<ProductAddon> Addons { get; set; } = new();
    public Inventory? Inventory { get; set; }
}

public class ProductVariant
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public Product Product { get; set; } = null!;
    public string Name { get; set; } = "";       // e.g. Small / Medium / Large
    public decimal PriceDelta { get; set; }
    public bool IsDefault { get; set; }
}

public class ProductAddon
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public Product Product { get; set; } = null!;
    public string Name { get; set; } = "";
    public decimal Price { get; set; }
    public bool IsActive { get; set; } = true;
}

public class Inventory
{
    public int ProductId { get; set; }
    public Product Product { get; set; } = null!;
    public bool TrackStock { get; set; }
    public int QuantityOnHand { get; set; }
    public int ReorderLevel { get; set; } = 5;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public byte[] RowVersion { get; set; } = Array.Empty<byte>();
}

// ---------- Cart & Orders ----------
public class Cart
{
    public int Id { get; set; }
    public Guid UserId { get; set; }
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public List<CartItem> Items { get; set; } = new();
}

public class CartItem
{
    public int Id { get; set; }
    public int CartId { get; set; }
    public Cart Cart { get; set; } = null!;
    public int ProductId { get; set; }
    public Product Product { get; set; } = null!;
    public int? VariantId { get; set; }
    public string? Temperature { get; set; }       // Hot | Iced
    public string AddonIds { get; set; } = "";     // comma separated ProductAddon ids
    public int Quantity { get; set; }
    public string? Notes { get; set; }
}

public class Order
{
    public int Id { get; set; }
    public string OrderNumber { get; set; } = "";
    public Guid UserId { get; set; }
    public ApplicationUser User { get; set; } = null!;
    public OrderStatus Status { get; set; } = OrderStatus.Pending;
    public FulfillmentType Fulfillment { get; set; }
    public decimal Subtotal { get; set; }
    public decimal Discount { get; set; }
    public decimal DeliveryFee { get; set; }
    public decimal Total { get; set; }
    public string? PromoCode { get; set; }
    public string CustomerName { get; set; } = "";
    public string CustomerEmail { get; set; } = "";
    public string CustomerPhone { get; set; } = "";
    public string? DeliveryAddress { get; set; }
    public string? Notes { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public byte[] RowVersion { get; set; } = Array.Empty<byte>();
    public List<OrderItem> Items { get; set; } = new();
    public List<OrderStatusHistory> History { get; set; } = new();
    public Payment? Payment { get; set; }
}

public class OrderItem
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public Order Order { get; set; } = null!;
    public int? ProductId { get; set; }          // nullable: order history survives product deletion
    public string ProductName { get; set; } = "";
    public string CategoryName { get; set; } = "";
    public string? Size { get; set; }
    public string? Temperature { get; set; }
    public string? AddonsSnapshot { get; set; }  // JSON [{name,price}]
    public decimal UnitPrice { get; set; }       // includes variant + addons
    public int Quantity { get; set; }
    public decimal LineTotal { get; set; }
    public string? Notes { get; set; }
}

public class OrderStatusHistory
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public Order Order { get; set; } = null!;
    public OrderStatus Status { get; set; }
    public string? Note { get; set; }
    public string? ChangedBy { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class Payment
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public Order Order { get; set; } = null!;
    public PaymentMethod Method { get; set; }
    public PaymentStatus Status { get; set; } = PaymentStatus.Pending;
    public decimal Amount { get; set; }
    public string? Provider { get; set; }
    public string? ProviderReference { get; set; }   // never raw card data
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? PaidAt { get; set; }
}

// ---------- CMS ----------
public class HomepageSection
{
    public int Id { get; set; }
    public string Key { get; set; } = "";
    public string Name { get; set; } = "";
    // draft state (edited by admin)
    public int SortOrder { get; set; }
    public bool IsEnabled { get; set; } = true;
    public string ContentJson { get; set; } = "{}";
    // published state (what customers see)
    public int? PublishedSortOrder { get; set; }
    public bool PublishedIsEnabled { get; set; }
    public string? PublishedContentJson { get; set; }
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class WebsiteContent
{
    public int Id { get; set; }
    public string Key { get; set; } = "";
    public string DraftValue { get; set; } = "";
    public string? PublishedValue { get; set; }
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class SiteSetting
{
    public int Id { get; set; }
    public string Key { get; set; } = "";
    public string DraftValue { get; set; } = "";
    public string? PublishedValue { get; set; }
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class ContentRevision
{
    public int Id { get; set; }
    public ContentAction Action { get; set; }
    public string SnapshotJson { get; set; } = "{}";
    public string? Note { get; set; }
    public string? ChangedBy { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class GalleryImage
{
    public int Id { get; set; }
    public string ImageUrl { get; set; } = "";
    public string? Caption { get; set; }
    public int SortOrder { get; set; }
    public bool IsVisible { get; set; } = true;
}

public class MediaAsset
{
    public int Id { get; set; }
    public string OriginalName { get; set; } = "";
    public string StoredName { get; set; } = "";
    public string ContentType { get; set; } = "";
    public long SizeBytes { get; set; }
    public string Url { get; set; } = "";
    public Guid? UploadedBy { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

// ---------- Administration ----------
public class Promotion
{
    public int Id { get; set; }
    public string Title { get; set; } = "";
    public string? Description { get; set; }
    public string? ImageUrl { get; set; }
    public string? Code { get; set; }
    public DiscountType DiscountType { get; set; }
    public decimal DiscountValue { get; set; }
    public decimal MinSubtotal { get; set; }
    public DateTimeOffset? StartsAt { get; set; }
    public DateTimeOffset? EndsAt { get; set; }
    public bool IsActive { get; set; } = true;
}

public class Review
{
    public int Id { get; set; }
    public int? ProductId { get; set; }
    public Guid? UserId { get; set; }
    public string AuthorName { get; set; } = "";
    public int Rating { get; set; }
    public string Comment { get; set; } = "";
    public bool IsApproved { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class AdminAuditLog
{
    public long Id { get; set; }
    public Guid? UserId { get; set; }
    public string? UserEmail { get; set; }
    public string Action { get; set; } = "";
    public string EntityType { get; set; } = "";
    public string? EntityId { get; set; }
    public string? Details { get; set; }
    public string? IpAddress { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class NewsletterSubscriber
{
    public int Id { get; set; }
    public string Email { get; set; } = "";
    public DateTimeOffset SubscribedAt { get; set; } = DateTimeOffset.UtcNow;
    public bool IsActive { get; set; } = true;
}

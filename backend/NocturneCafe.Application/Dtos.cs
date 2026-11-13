using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using NocturneCafe.Domain;

namespace NocturneCafe.Application;

// ---------- Auth ----------
public record RegisterRequest(
    [Required, StringLength(120, MinimumLength = 2)] string FullName,
    [Required, EmailAddress, StringLength(256)] string Email,
    [Required, StringLength(100, MinimumLength = 8)] string Password,
    [Required] string ConfirmPassword);
public record LoginRequest([Required, EmailAddress] string Email, [Required] string Password, bool RememberMe = false);
public record ForgotPasswordRequest([Required, EmailAddress] string Email);
public record ResetPasswordRequest([Required, EmailAddress] string Email, [Required] string Token, [Required, StringLength(100, MinimumLength = 8)] string NewPassword);
public record ConfirmEmailRequest([Required] string UserId, [Required] string Token);
public record ResendConfirmationRequest([Required, EmailAddress] string Email);
public record ChangePasswordRequest([Required] string CurrentPassword, [Required, StringLength(100, MinimumLength = 8)] string NewPassword);
public record UserDto(Guid Id, string FullName, string Email, bool EmailConfirmed, string[] Roles);

// ---------- Customer ----------
public record ProfileDto(string FullName, string Email, string? Phone, DateOnly? Birthday, int RewardPoints, DateTimeOffset MemberSince);
public record UpdateProfileRequest([Required, StringLength(120, MinimumLength = 2)] string FullName, [StringLength(30)] string? Phone, DateOnly? Birthday);
public record AddressDto(int Id, string Label, string Recipient, string Phone, string Line1, string? Line2, string City, string? PostalCode, string? Notes, bool IsDefault);
public record AddressRequest(
    [Required, StringLength(40)] string Label, [Required, StringLength(120)] string Recipient,
    [Required, StringLength(30)] string Phone, [Required, StringLength(200)] string Line1,
    [StringLength(200)] string? Line2, [Required, StringLength(100)] string City,
    [StringLength(20)] string? PostalCode, [StringLength(300)] string? Notes, bool IsDefault);
public record RewardDto(int Points, string Tier, int NextTierAt, List<RewardTransactionDto> History);
public record RewardTransactionDto(int Id, string Kind, int Points, string Description, DateTimeOffset CreatedAt);

// ---------- Catalog ----------
public record CategoryDto(int Id, string Name, string Slug, string? Description, int SortOrder, bool IsActive, int ProductCount);
public record CategoryRequest([Required, StringLength(80)] string Name, [StringLength(300)] string? Description, int SortOrder, bool IsActive = true);
public record VariantDto(int? Id, [Required, StringLength(60)] string Name, decimal PriceDelta, bool IsDefault);
public record AddonDto(int? Id, [Required, StringLength(80)] string Name, [Range(0, 10000)] decimal Price, bool IsActive = true);
public record ProductDto(
    int Id, string Name, string Description, string? ImageUrl, decimal Price, int CategoryId, string CategoryName,
    bool IsAvailable, bool IsFeatured, bool IsSignature, bool SupportsHot, bool SupportsCold, bool IsArchived,
    DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt, List<VariantDto> Variants, List<AddonDto> Addons,
    bool TrackStock, int? QuantityOnHand, int? ReorderLevel, bool InStock);
public record ProductUpsertRequest(
    [Required, StringLength(150)] string Name, [Required, StringLength(1000)] string Description,
    [StringLength(500)] string? ImageUrl, [Range(0.01, 100000)] decimal Price, int CategoryId,
    bool IsAvailable, bool IsFeatured, bool IsSignature, bool SupportsHot, bool SupportsCold,
    List<VariantDto>? Variants, List<AddonDto>? Addons,
    bool TrackStock = false, [Range(0, 1000000)] int QuantityOnHand = 0, [Range(0, 1000000)] int ReorderLevel = 5);
public record InventoryDto(int ProductId, string ProductName, string CategoryName, bool TrackStock, int QuantityOnHand, int ReorderLevel, bool IsLow);
public record InventoryUpdateRequest(bool TrackStock, [Range(0, 1000000)] int QuantityOnHand, [Range(0, 1000000)] int ReorderLevel);
public record PagedResult<T>(List<T> Items, int Total, int Page, int PageSize);

// ---------- Cart / Orders ----------
public record CartItemRequest(
    [Range(1, int.MaxValue)] int ProductId, int? VariantId, [StringLength(10)] string? Temperature,
    List<int>? AddonIds, [Range(1, 50)] int Quantity, [StringLength(300)] string? Notes);
public record CartItemUpdateRequest([Range(1, 50)] int Quantity, [StringLength(300)] string? Notes, string? Temperature, int? VariantId, List<int>? AddonIds);
public record AddonLine(int Id, string Name, decimal Price);
public record CartItemDto(int Id, int ProductId, string Name, string? ImageUrl, int? VariantId, string? Size, string? Temperature,
    List<AddonLine> Addons, decimal UnitPrice, int Quantity, decimal LineTotal, string? Notes, bool Available);
public record CartDto(List<CartItemDto> Items, decimal Subtotal, int ItemCount);
public record CheckoutRequest(
    FulfillmentType Fulfillment, PaymentMethod PaymentMethod, int? AddressId,
    [StringLength(30)] string? Phone, [StringLength(500)] string? Notes, [StringLength(40)] string? PromoCode);
public record PromoCheckRequest([Required, StringLength(40)] string Code, decimal Subtotal);
public record PromoCheckResult(bool Valid, string? Message, decimal Discount, string? Title);
public record OrderItemDto(int Id, int? ProductId, string ProductName, string? Size, string? Temperature, List<AddonLine> Addons, decimal UnitPrice, int Quantity, decimal LineTotal, string? Notes);
public record OrderHistoryDto(string Status, string? Note, DateTimeOffset At);
public record OrderDto(
    int Id, string OrderNumber, string Status, string Fulfillment, decimal Subtotal, decimal Discount, decimal DeliveryFee, decimal Total,
    string? PromoCode, string CustomerName, string CustomerEmail, string CustomerPhone, string? DeliveryAddress, string? Notes,
    string PaymentMethod, string PaymentStatus, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt,
    List<OrderItemDto> Items, List<OrderHistoryDto> History);
public record OrderSummaryDto(int Id, string OrderNumber, string Status, string Fulfillment, decimal Total, string PaymentMethod, string PaymentStatus, string CustomerName, int ItemCount, DateTimeOffset CreatedAt);
public record UpdateOrderStatusRequest([Required] string Status, [StringLength(300)] string? Note);
public record UpdatePaymentStatusRequest([Required] string Status, [StringLength(120)] string? Reference);

// ---------- Reviews / promotions / gallery / newsletter ----------
public record ReviewDto(int Id, int? ProductId, string AuthorName, int Rating, string Comment, bool IsApproved, DateTimeOffset CreatedAt);
public record ReviewRequest([Range(1, 5)] int Rating, [Required, StringLength(1000, MinimumLength = 3)] string Comment, int? ProductId);
public record PromotionDto(int Id, string Title, string? Description, string? ImageUrl, string? Code, string DiscountType, decimal DiscountValue, decimal MinSubtotal, DateTimeOffset? StartsAt, DateTimeOffset? EndsAt, bool IsActive);
public record PromotionRequest(
    [Required, StringLength(150)] string Title, [StringLength(500)] string? Description, [StringLength(500)] string? ImageUrl,
    [StringLength(40)] string? Code, DiscountType DiscountType, [Range(0, 100000)] decimal DiscountValue, [Range(0, 1000000)] decimal MinSubtotal,
    DateTimeOffset? StartsAt, DateTimeOffset? EndsAt, bool IsActive);
public record GalleryImageDto(int Id, string ImageUrl, string? Caption, int SortOrder, bool IsVisible);
public record GalleryImageRequest([Required, StringLength(500)] string ImageUrl, [StringLength(200)] string? Caption, int SortOrder, bool IsVisible = true);
public record SubscribeRequest([Required, EmailAddress, StringLength(256)] string Email);
public record MediaDto(int Id, string Url, string OriginalName, string ContentType, long SizeBytes, DateTimeOffset CreatedAt);

// ---------- Content (CMS) ----------
public record SectionDto(string Key, string Name, int SortOrder, bool IsEnabled, JsonElement Content);
public record HomepageDto(List<SectionDto> Sections, Dictionary<string, string> Settings, bool IsPublished, DateTimeOffset? LastPublishedAt, bool HasUnpublishedChanges);
public record UpdateHomepageRequest([Required] List<SectionDto> Sections);
public record UpdateSettingsRequest([Required] Dictionary<string, string> Settings);
public record UpdatePagesRequest([Required] Dictionary<string, string> Pages);
public record PublishRequest([StringLength(300)] string? Note);
public record RevisionDto(int Id, string Action, string? Note, string? ChangedBy, DateTimeOffset CreatedAt);

// ---------- Admin ----------
public record AdminUserDto(Guid Id, string FullName, string Email, bool EmailConfirmed, bool IsActive, string[] Roles, DateTimeOffset CreatedAt, int OrderCount, decimal TotalSpent, string? Phone);
public record AdminUserDetailDto(AdminUserDto User, List<OrderSummaryDto> Orders, List<AddressDto> Addresses);
public record SetUserActiveRequest(bool IsActive);
public record SetUserRoleRequest([Required] string Role);
public record AuditLogDto(long Id, string? UserEmail, string Action, string EntityType, string? EntityId, string? Details, string? IpAddress, DateTimeOffset CreatedAt);

public record DashboardDto(
    decimal TotalSales, int TotalOrders, int TotalCustomers, int PendingOrders, decimal TodayRevenue, int ActiveProducts,
    List<SeriesPoint> DailySales, List<SeriesPoint> MonthlyRevenue, List<BestSeller> BestSellers,
    List<StatusCount> OrderStatistics, List<SeriesPoint> RevenueByCategory, int LowStockCount);
public record SeriesPoint(string Label, decimal Value, int Count = 0);
public record BestSeller(string Name, int Quantity, decimal Revenue);
public record StatusCount(string Status, int Count);

using NocturneCafe.Domain;

namespace NocturneCafe.Application;

/// <summary>Thrown by services for expected business-rule failures; mapped to HTTP 400/404/409 by the API.</summary>
public class ServiceException : Exception
{
    public int StatusCode { get; }
    public ServiceException(string message, int statusCode = 400) : base(message) => StatusCode = statusCode;
}

public interface ICatalogService
{
    Task<List<CategoryDto>> GetCategoriesAsync(bool includeInactive);
    Task<PagedResult<ProductDto>> SearchAsync(string? q, int? categoryId, bool? featured, bool? signature, int page, int pageSize, bool admin);
    Task<ProductDto?> GetAsync(int id, bool admin);
    Task<ProductDto> CreateAsync(ProductUpsertRequest r);
    Task<ProductDto> UpdateAsync(int id, ProductUpsertRequest r);
    Task<bool> ArchiveAsync(int id);
    Task<List<InventoryDto>> GetInventoryAsync();
    Task<InventoryDto> UpdateInventoryAsync(int productId, InventoryUpdateRequest r);
}

public interface ICartService
{
    Task<CartDto> GetAsync(Guid userId);
    Task<CartDto> AddAsync(Guid userId, CartItemRequest r);
    Task<CartDto> UpdateAsync(Guid userId, int itemId, CartItemUpdateRequest r);
    Task<CartDto> RemoveAsync(Guid userId, int itemId);
    Task ClearAsync(Guid userId);
}

public interface IOrderService
{
    Task<OrderDto> CheckoutAsync(Guid userId, CheckoutRequest r);
    Task<PromoCheckResult> CheckPromoAsync(string code, decimal subtotal);
    Task<List<OrderSummaryDto>> ListForUserAsync(Guid userId);
    Task<OrderDto?> GetForUserAsync(Guid userId, int orderId);
    Task<PagedResult<OrderSummaryDto>> ListAllAsync(string? q, string? status, int page, int pageSize);
    Task<OrderDto?> GetAsync(int orderId);
    Task<OrderDto> UpdateStatusAsync(int orderId, OrderStatus status, string? note, string changedBy);
    Task<OrderDto> UpdatePaymentAsync(int orderId, PaymentStatus status, string? reference, string changedBy);
}

public interface IContentService
{
    Task<HomepageDto> GetPublicHomepageAsync();
    Task<HomepageDto> GetDraftHomepageAsync();
    Task<Dictionary<string, string>> GetPublicSettingsAsync();
    Task<Dictionary<string, string>> GetDraftSettingsAsync();
    Task<Dictionary<string, string>> GetPagesAsync(bool draft);
    Task SaveSectionsAsync(List<SectionDto> sections, string by);
    Task SaveSettingsAsync(Dictionary<string, string> settings, string by);
    Task SavePagesAsync(Dictionary<string, string> pages, string by);
    Task PublishAsync(string? note, string by);
    Task UnpublishAsync(string? note, string by);
    Task<List<RevisionDto>> GetHistoryAsync();
    Task RestoreRevisionAsync(int revisionId, string by);
}

public interface IDashboardService
{
    Task<DashboardDto> GetAsync();
    Task<string> ExportSalesCsvAsync(DateTimeOffset from, DateTimeOffset to);
}

public interface IAuditService
{
    Task LogAsync(string action, string entityType, string? entityId = null, string? details = null);
}

public interface IMediaStorage
{
    /// <summary>Validates (type, size, magic bytes) and stores an image. Returns the public URL.</summary>
    Task<MediaDto> SaveImageAsync(Stream content, string originalName, string contentType, long length, Guid? uploadedBy);
    (Stream Stream, string ContentType)? Open(string storedName);
}

public interface IEmailSender
{
    Task SendAsync(string to, string subject, string htmlBody);
}

public record PaymentResult(bool Success, PaymentStatus Status, string? Reference, string? Error);

/// <summary>Integration boundary for online payments (GCash / card). Providers must never expose raw card data to this app.</summary>
public interface IPaymentGateway
{
    bool Supports(PaymentMethod method);
    Task<PaymentResult> CreateChargeAsync(PaymentMethod method, decimal amount, string orderNumber);
}

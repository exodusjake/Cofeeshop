using System.Net;
using System.Net.Mail;
using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using NocturneCafe.Application;
using NocturneCafe.Domain;
using NocturneCafe.Infrastructure.Data;

namespace NocturneCafe.Infrastructure.Services;

public class AuditService : IAuditService
{
    private readonly AppDbContext _db;
    private readonly IHttpContextAccessor _http;
    public AuditService(AppDbContext db, IHttpContextAccessor http) { _db = db; _http = http; }

    public async Task LogAsync(string action, string entityType, string? entityId = null, string? details = null)
    {
        var ctx = _http.HttpContext;
        Guid? uid = Guid.TryParse(ctx?.User.FindFirstValue(ClaimTypes.NameIdentifier), out var g) ? g : null;
        _db.AdminAuditLogs.Add(new AdminAuditLog
        {
            UserId = uid, UserEmail = ctx?.User.FindFirstValue(ClaimTypes.Email) ?? ctx?.User.Identity?.Name,
            Action = action, EntityType = entityType, EntityId = entityId,
            Details = details is { Length: > 2000 } ? details[..2000] : details,
            IpAddress = ctx?.Connection.RemoteIpAddress?.ToString()
        });
        await _db.SaveChangesAsync();
    }
}

/// <summary>Local-disk image storage. Files live outside the web root and are served only through MediaController.
/// In production, point Storage:RootPath at a dedicated EBS volume and snapshot it (see docs/aws). Swap this class for an S3 implementation if desired.</summary>
public class LocalMediaStorage : IMediaStorage
{
    private readonly AppDbContext _db;
    private readonly string _root;
    private readonly long _maxBytes;
    private static readonly Dictionary<string, string> Ext = new() { ["image/jpeg"] = ".jpg", ["image/png"] = ".png", ["image/webp"] = ".webp", ["image/gif"] = ".gif" };

    public LocalMediaStorage(AppDbContext db, IConfiguration cfg)
    {
        _db = db;
        _root = Path.GetFullPath(string.IsNullOrWhiteSpace(cfg["Storage:RootPath"]) ? Path.Combine(AppContext.BaseDirectory, "App_Data", "uploads") : cfg["Storage:RootPath"]!);
        _maxBytes = long.TryParse(cfg["Storage:MaxUploadBytes"], out var m) ? m : 5 * 1024 * 1024;
        Directory.CreateDirectory(_root);
    }

    public async Task<MediaDto> SaveImageAsync(Stream content, string originalName, string contentType, long length, Guid? uploadedBy)
    {
        if (length <= 0 || length > _maxBytes) throw new ServiceException($"Image must be between 1 byte and {_maxBytes / 1024 / 1024} MB.");
        using var ms = new MemoryStream();
        await content.CopyToAsync(ms);
        var bytes = ms.ToArray();
        if (bytes.Length > _maxBytes) throw new ServiceException("Image is too large.");

        // Trust file signatures, not the client-provided content type or extension.
        var detected = Detect(bytes) ?? throw new ServiceException("Only JPEG, PNG, WebP or GIF images are allowed.");
        var stored = Guid.NewGuid().ToString("N") + Ext[detected];
        await File.WriteAllBytesAsync(Path.Combine(_root, stored), bytes);

        var asset = new MediaAsset
        {
            OriginalName = Path.GetFileName(originalName) is { Length: > 0 } n ? (n.Length > 200 ? n[..200] : n) : "upload",
            StoredName = stored, ContentType = detected, SizeBytes = bytes.Length, Url = "/api/media/" + stored, UploadedBy = uploadedBy
        };
        _db.MediaAssets.Add(asset);
        await _db.SaveChangesAsync();
        return new MediaDto(asset.Id, asset.Url, asset.OriginalName, asset.ContentType, asset.SizeBytes, asset.CreatedAt);
    }

    public (Stream Stream, string ContentType)? Open(string storedName)
    {
        // storedName must be a bare file name we generated: no traversal possible
        if (storedName != Path.GetFileName(storedName) || !Ext.Values.Any(e => storedName.EndsWith(e))) return null;
        var path = Path.Combine(_root, storedName);
        if (!File.Exists(path)) return null;
        var ct = Ext.First(kv => storedName.EndsWith(kv.Value)).Key;
        return (File.OpenRead(path), ct);
    }

    private static string? Detect(byte[] b)
    {
        if (b.Length > 3 && b[0] == 0xFF && b[1] == 0xD8 && b[2] == 0xFF) return "image/jpeg";
        if (b.Length > 8 && b[0] == 0x89 && b[1] == 0x50 && b[2] == 0x4E && b[3] == 0x47) return "image/png";
        if (b.Length > 12 && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F' && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P') return "image/webp";
        if (b.Length > 6 && b[0] == 'G' && b[1] == 'I' && b[2] == 'F' && b[3] == '8') return "image/gif";
        return null;
    }
}

/// <summary>Sends via SMTP when Smtp:Host is configured (e.g. Amazon SES SMTP). Otherwise writes .html files to an outbox folder
/// and logs the message, so verification/reset links are usable in local development.</summary>
public class EmailSender : IEmailSender
{
    private readonly IConfiguration _cfg;
    private readonly ILogger<EmailSender> _log;
    public EmailSender(IConfiguration cfg, ILogger<EmailSender> log) { _cfg = cfg; _log = log; }

    public async Task SendAsync(string to, string subject, string htmlBody)
    {
        var host = _cfg["Smtp:Host"];
        if (string.IsNullOrWhiteSpace(host))
        {
            var dir = Path.Combine(AppContext.BaseDirectory, "App_Data", "outbox");
            Directory.CreateDirectory(dir);
            var file = Path.Combine(dir, $"{DateTime.UtcNow:yyyyMMdd-HHmmss-fff}-{Guid.NewGuid():N}.html");
            await File.WriteAllTextAsync(file, $"<!-- To: {WebUtility.HtmlEncode(to)} | Subject: {WebUtility.HtmlEncode(subject)} -->\n{htmlBody}");
            _log.LogWarning("SMTP is not configured. Email to {To} ({Subject}) saved to {File}", to, subject, file);
            return;
        }
        using var client = new SmtpClient(host, int.TryParse(_cfg["Smtp:Port"], out var p) ? p : 587) { EnableSsl = true };
        if (!string.IsNullOrEmpty(_cfg["Smtp:User"])) client.Credentials = new NetworkCredential(_cfg["Smtp:User"], _cfg["Smtp:Password"]);
        using var msg = new MailMessage(_cfg["Smtp:From"] ?? "no-reply@localhost", to, subject, htmlBody) { IsBodyHtml = true };
        await client.SendMailAsync(msg);
    }
}

/// <summary>Placeholder boundary for GCash / card providers. Reports "not supported" so checkout refuses these methods
/// rather than pretending a payment succeeded. Implement IPaymentGateway for your provider (PayMongo, Xendit, Stripe, etc.) and register it in DI.</summary>
public class UnconfiguredPaymentGateway : IPaymentGateway
{
    public bool Supports(PaymentMethod method) => false;
    public Task<PaymentResult> CreateChargeAsync(PaymentMethod method, decimal amount, string orderNumber) =>
        Task.FromResult(new PaymentResult(false, PaymentStatus.Failed, null, "No payment provider is configured."));
}


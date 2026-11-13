using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NocturneCafe.Api;
using NocturneCafe.Application;
using NocturneCafe.Domain;
using NocturneCafe.Infrastructure.Data;
using NocturneCafe.Infrastructure.Services;

var builder = WebApplication.CreateBuilder(args);
var cfg = builder.Configuration;

// ---------- Database (SQL Server / Amazon RDS for SQL Server) ----------
var connectionString = cfg.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("ConnectionStrings:DefaultConnection is not configured. Use user-secrets locally or environment variables / AWS Secrets Manager in production.");
builder.Services.AddDbContext<AppDbContext>(o => o.UseSqlServer(connectionString, sql =>
{
    sql.EnableRetryOnFailure(5, TimeSpan.FromSeconds(10), null);
    sql.MigrationsAssembly(typeof(AppDbContext).Assembly.FullName);
}));

// ---------- Identity + cookie auth ----------
var requireConfirmed = cfg.GetValue("Auth:RequireConfirmedEmail", true);
builder.Services.AddIdentityCore<ApplicationUser>(o =>
{
    o.Password.RequiredLength = 8; o.Password.RequireDigit = true; o.Password.RequireLowercase = true;
    o.Password.RequireUppercase = true; o.Password.RequireNonAlphanumeric = false;
    o.User.RequireUniqueEmail = true;
    o.SignIn.RequireConfirmedEmail = requireConfirmed;
    o.Lockout.MaxFailedAccessAttempts = 5; o.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15); o.Lockout.AllowedForNewUsers = true;
})
.AddRoles<ApplicationRole>()
.AddEntityFrameworkStores<AppDbContext>()
.AddSignInManager()
.AddDefaultTokenProviders();

var secureCookies = cfg.GetValue("Auth:SecureCookies", true);
builder.Services.AddAuthentication(IdentityConstants.ApplicationScheme).AddIdentityCookies(o => { });
builder.Services.ConfigureApplicationCookie(o =>
{
    o.Cookie.Name = "nocturne.auth";
    o.Cookie.HttpOnly = true;
    o.Cookie.SameSite = SameSiteMode.Lax;
    o.Cookie.SecurePolicy = secureCookies ? CookieSecurePolicy.Always : CookieSecurePolicy.SameAsRequest;
    o.ExpireTimeSpan = TimeSpan.FromDays(14); o.SlidingExpiration = true;
    o.Events.OnRedirectToLogin = c => { c.Response.StatusCode = 401; return Task.CompletedTask; };
    o.Events.OnRedirectToAccessDenied = c => { c.Response.StatusCode = 403; return Task.CompletedTask; };
});
// Re-check the security stamp on every request so disabling an account / changing a role takes effect immediately.
builder.Services.Configure<SecurityStampValidatorOptions>(o => o.ValidationInterval = TimeSpan.Zero);
builder.Services.AddAuthorization();

// ---------- CSRF (cookie auth + same-origin proxy) ----------
builder.Services.AddAntiforgery(o =>
{
    o.HeaderName = "X-CSRF-TOKEN";
    o.Cookie.Name = "nocturne.af"; o.Cookie.HttpOnly = true; o.Cookie.SameSite = SameSiteMode.Strict;
    o.Cookie.SecurePolicy = secureCookies ? CookieSecurePolicy.Always : CookieSecurePolicy.SameAsRequest;
});

// ---------- Rate limiting ----------
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = 429;
    o.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(ctx =>
        RateLimitPartition.GetFixedWindowLimiter(ctx.Connection.RemoteIpAddress?.ToString() ?? "anon",
            _ => new FixedWindowRateLimiterOptions { PermitLimit = 600, Window = TimeSpan.FromMinutes(1) }));
    o.AddPolicy("auth", ctx => RateLimitPartition.GetFixedWindowLimiter(ctx.Connection.RemoteIpAddress?.ToString() ?? "anon",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = cfg.GetValue("RateLimiting:AuthPerMinute", 10), Window = TimeSpan.FromMinutes(1) }));
});

// ---------- MVC ----------
builder.Services.AddControllers(o => o.Filters.Add<CsrfFilter>())
    .AddJsonOptions(o =>
    {
        o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
        o.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.Never;
    });
builder.Services.Configure<Microsoft.AspNetCore.Http.Features.FormOptions>(o => o.MultipartBodyLengthLimit = 6 * 1024 * 1024);
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "Nocturne Café API", Version = "v1", Description = "Cookie-authenticated REST API. Mutating requests need the X-CSRF-TOKEN header from GET /api/auth/csrf." });
    c.CustomSchemaIds(t => t.FullName!.Replace("+", "."));
});

// ---------- Application services ----------
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICatalogService, CatalogService>();
builder.Services.AddScoped<ICartService, CartService>();
builder.Services.AddScoped<IOrderService, OrderService>();
builder.Services.AddScoped<IContentService, ContentService>();
builder.Services.AddScoped<IDashboardService, DashboardService>();
builder.Services.AddScoped<IAuditService, AuditService>();
builder.Services.AddScoped<IMediaStorage, LocalMediaStorage>();
builder.Services.AddScoped<IEmailSender, EmailSender>();
builder.Services.AddSingleton<IPaymentGateway, UnconfiguredPaymentGateway>();

// ---------- Reverse proxy (Nginx on the Web EC2 -> this API in the private subnet) ----------
builder.Services.Configure<ForwardedHeadersOptions>(o =>
{
    o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto | ForwardedHeaders.XForwardedHost;
    // The API is only reachable from the Web EC2 security group, so every hop here is trusted.
    o.KnownIPNetworks.Clear(); o.KnownProxies.Clear();
});

var app = builder.Build();

app.UseForwardedHeaders();
app.UseMiddleware<ErrorHandlingMiddleware>();
app.Use(async (ctx, next) =>
{
    ctx.Response.Headers["X-Content-Type-Options"] = "nosniff";
    ctx.Response.Headers["X-Frame-Options"] = "DENY";
    ctx.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    await next();
});
if (app.Environment.IsDevelopment() || cfg.GetValue("Swagger:Enabled", false))
{
    app.UseSwagger();
    app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "Nocturne Café API v1"));
}
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

await DbSeeder.InitializeAsync(app.Services);
app.Run();

public partial class Program { }

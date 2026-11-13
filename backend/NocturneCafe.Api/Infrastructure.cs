using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NocturneCafe.Application;
using NocturneCafe.Domain;

namespace NocturneCafe.Api;

/// <summary>Maps expected business failures to ProblemDetails and hides internal errors.</summary>
public class ErrorHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ErrorHandlingMiddleware> _log;
    public ErrorHandlingMiddleware(RequestDelegate next, ILogger<ErrorHandlingMiddleware> log) { _next = next; _log = log; }

    public async Task InvokeAsync(HttpContext ctx)
    {
        try { await _next(ctx); }
        catch (ServiceException ex) { await Write(ctx, ex.StatusCode, ex.Message); }
        catch (Microsoft.AspNetCore.Antiforgery.AntiforgeryValidationException)
        { await Write(ctx, 400, "Security token missing or expired. Please refresh and try again.", "csrf"); }
        catch (Exception ex)
        {
            _log.LogError(ex, "Unhandled exception for {Method} {Path}", ctx.Request.Method, ctx.Request.Path);
            await Write(ctx, 500, "Something went wrong on our side. Please try again.");
        }
    }

    private static async Task Write(HttpContext ctx, int status, string message, string? code = null)
    {
        if (ctx.Response.HasStarted) return;
        ctx.Response.Clear(); ctx.Response.StatusCode = status;
        await ctx.Response.WriteAsJsonAsync(new ProblemDetails { Status = status, Title = message, Detail = message, Extensions = { ["code"] = code } });
    }
}

/// <summary>Validates the antiforgery token (header X-CSRF-TOKEN + cookie) on every state-changing request.
/// Own implementation because AutoValidateAntiforgeryToken lives in MVC view features, which a pure API does not register.</summary>
public class CsrfFilter : Microsoft.AspNetCore.Mvc.Filters.IAsyncAuthorizationFilter
{
    private readonly Microsoft.AspNetCore.Antiforgery.IAntiforgery _af;
    public CsrfFilter(Microsoft.AspNetCore.Antiforgery.IAntiforgery af) => _af = af;

    public async Task OnAuthorizationAsync(Microsoft.AspNetCore.Mvc.Filters.AuthorizationFilterContext context)
    {
        var m = context.HttpContext.Request.Method;
        if (HttpMethods.IsGet(m) || HttpMethods.IsHead(m) || HttpMethods.IsOptions(m) || HttpMethods.IsTrace(m)) return;
        try { await _af.ValidateRequestAsync(context.HttpContext); }
        catch (Microsoft.AspNetCore.Antiforgery.AntiforgeryValidationException)
        {
            context.Result = new ObjectResult(new ProblemDetails { Status = 400, Title = "Security token missing or expired. Please refresh and try again.", Extensions = { ["code"] = "csrf" } }) { StatusCode = 400 };
        }
    }
}

[ApiController]
public abstract class ApiBase : ControllerBase
{
    protected Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
    protected string UserEmail => User.FindFirstValue(ClaimTypes.Email) ?? User.Identity?.Name ?? "unknown";
}

/// <summary>All admin controllers derive from this: role is enforced server-side on every endpoint.</summary>
[Authorize(Roles = Roles.Admin)]
public abstract class AdminBase : ApiBase { }

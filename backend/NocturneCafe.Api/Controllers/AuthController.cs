using System.Text;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using System.Net;
using NocturneCafe.Application;
using NocturneCafe.Domain;
using NocturneCafe.Infrastructure.Data;

namespace NocturneCafe.Api.Controllers;

[Route("api/auth")]
public class AuthController : ApiBase
{
    private readonly UserManager<ApplicationUser> _users;
    private readonly SignInManager<ApplicationUser> _signIn;
    private readonly IEmailSender _email;
    private readonly IConfiguration _cfg;
    private readonly IAntiforgery _af;
    private readonly AppDbContext _db;

    public AuthController(UserManager<ApplicationUser> users, SignInManager<ApplicationUser> signIn, IEmailSender email, IConfiguration cfg, IAntiforgery af, AppDbContext db)
    { _users = users; _signIn = signIn; _email = email; _cfg = cfg; _af = af; _db = db; }

    private string BaseUrl => (_cfg["App:PublicBaseUrl"] ?? "http://localhost:3000").TrimEnd('/');
    private static string Enc(string token) => WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(token));
    private static string Dec(string token) => Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(token));

    private async Task<UserDto> ToDto(ApplicationUser u) =>
        new(u.Id, u.FullName, u.Email ?? "", u.EmailConfirmed, (await _users.GetRolesAsync(u)).ToArray());

    /// <summary>Issues a CSRF request token (paired with the HttpOnly antiforgery cookie). Send it back as X-CSRF-TOKEN.</summary>
    [HttpGet("csrf")]
    public IActionResult Csrf()
    {
        var t = _af.GetAndStoreTokens(HttpContext);
        Response.Headers.CacheControl = "no-store";
        return Ok(new { token = t.RequestToken });
    }

    [HttpPost("register"), EnableRateLimiting("auth")]
    public async Task<IActionResult> Register(RegisterRequest r)
    {
        if (r.Password != r.ConfirmPassword) return BadRequest(new { title = "Passwords do not match." });
        var user = new ApplicationUser { UserName = r.Email.Trim(), Email = r.Email.Trim(), FullName = r.FullName.Trim() };
        var res = await _users.CreateAsync(user, r.Password);
        if (!res.Succeeded)
        {
            var dup = res.Errors.Any(e => e.Code is "DuplicateEmail" or "DuplicateUserName");
            return BadRequest(new { title = dup ? "An account with this email already exists." : string.Join(" ", res.Errors.Select(e => e.Description)) });
        }
        await _users.AddToRoleAsync(user, Roles.Customer);   // public registration is ALWAYS Customer
        _db.CustomerProfiles.Add(new CustomerProfile { UserId = user.Id });
        await _db.SaveChangesAsync();
        // No email step: the new customer is signed in immediately.
        await _signIn.SignInAsync(user, isPersistent: false);
        return StatusCode(201, await ToDto(user));
    }

    private async Task SendConfirmation(ApplicationUser user)
    {
        var token = await _users.GenerateEmailConfirmationTokenAsync(user);
        var link = $"{BaseUrl}/verify-email?userId={user.Id}&token={Enc(token)}";
        await _email.SendAsync(user.Email!, "Verify your Nocturne Café account",
            $"<p>Welcome to Nocturne Café, {WebUtility.HtmlEncode(user.FullName)}.</p><p><a href=\"{link}\">Verify my email</a></p><p>If you didn't create this account you can ignore this message.</p>");
    }

    [HttpPost("confirm-email"), EnableRateLimiting("auth")]
    public async Task<IActionResult> ConfirmEmail(ConfirmEmailRequest r)
    {
        var user = await _users.FindByIdAsync(r.UserId);
        if (user == null) return BadRequest(new { title = "This verification link is invalid." });
        string token; try { token = Dec(r.Token); } catch { return BadRequest(new { title = "This verification link is invalid." }); }
        var res = await _users.ConfirmEmailAsync(user, token);
        return res.Succeeded ? Ok(new { message = "Email verified. You can now sign in." }) : BadRequest(new { title = "This verification link is invalid or has expired." });
    }

    [HttpPost("resend-confirmation"), EnableRateLimiting("auth")]
    public async Task<IActionResult> Resend(ResendConfirmationRequest r)
    {
        var user = await _users.FindByEmailAsync(r.Email);
        if (user is { EmailConfirmed: false, IsActive: true }) await SendConfirmation(user);
        return Ok(new { message = "If that account exists and is unverified, a new link has been sent." });
    }

    [HttpPost("login"), EnableRateLimiting("auth")]
    public async Task<IActionResult> Login(LoginRequest r)
    {
        var user = await _users.FindByEmailAsync(r.Email.Trim());
        if (user == null) { await Task.Delay(Random.Shared.Next(150, 350)); return Unauthorized(new { title = "Invalid email or password." }); }
        if (!user.IsActive) return StatusCode(403, new { title = "This account has been disabled. Please contact the café.", code = "disabled" });
        var res = await _signIn.PasswordSignInAsync(user, r.Password, r.RememberMe, lockoutOnFailure: true);
        if (res.IsLockedOut) return StatusCode(429, new { title = "Too many failed attempts. Try again in 15 minutes.", code = "locked" });
        if (res.IsNotAllowed) return StatusCode(403, new { title = "Please verify your email before signing in.", code = "email_not_confirmed" });
        if (!res.Succeeded) return Unauthorized(new { title = "Invalid email or password." });
        return Ok(await ToDto(user));
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout() { await _signIn.SignOutAsync(); return NoContent(); }

    [HttpGet("me"), Authorize]
    public async Task<IActionResult> Me()
    {
        var user = await _users.GetUserAsync(User);
        return user == null ? Unauthorized() : Ok(await ToDto(user));
    }

    [HttpPost("forgot-password"), EnableRateLimiting("auth")]
    public async Task<IActionResult> Forgot(ForgotPasswordRequest r)
    {
        var user = await _users.FindByEmailAsync(r.Email.Trim());
        if (user is { IsActive: true } && (user.EmailConfirmed || !_users.Options.SignIn.RequireConfirmedEmail))
        {
            var token = await _users.GeneratePasswordResetTokenAsync(user);
            var link = $"{BaseUrl}/reset-password?email={Uri.EscapeDataString(user.Email!)}&token={Enc(token)}";
            await _email.SendAsync(user.Email!, "Reset your Nocturne Café password",
                $"<p>We received a request to reset your password.</p><p><a href=\"{link}\">Choose a new password</a></p><p>If you didn't ask for this, ignore this email.</p>");
        }
        return Ok(new { message = "If an account exists for that email, a reset link has been sent." });   // never reveals existence
    }

    [HttpPost("reset-password"), EnableRateLimiting("auth")]
    public async Task<IActionResult> Reset(ResetPasswordRequest r)
    {
        var user = await _users.FindByEmailAsync(r.Email.Trim());
        string token; try { token = Dec(r.Token); } catch { return BadRequest(new { title = "This reset link is invalid or has expired." }); }
        if (user == null) return BadRequest(new { title = "This reset link is invalid or has expired." });
        var res = await _users.ResetPasswordAsync(user, token, r.NewPassword);
        return res.Succeeded ? Ok(new { message = "Password updated. You can now sign in." })
            : BadRequest(new { title = string.Join(" ", res.Errors.Select(e => e.Description)) });
    }

    [HttpPost("change-password"), Authorize]
    public async Task<IActionResult> Change(ChangePasswordRequest r)
    {
        var user = await _users.GetUserAsync(User);
        if (user == null) return Unauthorized();
        var res = await _users.ChangePasswordAsync(user, r.CurrentPassword, r.NewPassword);
        if (!res.Succeeded) return BadRequest(new { title = string.Join(" ", res.Errors.Select(e => e.Description)) });
        await _signIn.RefreshSignInAsync(user);
        return Ok(new { message = "Password changed." });
    }
}

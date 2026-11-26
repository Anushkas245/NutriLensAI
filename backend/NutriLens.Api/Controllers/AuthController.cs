using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NutriLens.Api.Data;
using NutriLens.Api.Models;
using NutriLens.Api.Services;

namespace NutriLens.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly AuthTokenService _auth;

    public AuthController(AppDbContext context, AuthTokenService auth)
    {
        _context = context;
        _auth = auth;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.FullName) || string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Password))
            return BadRequest(new { message = "Full name, email, and password are required." });

        if (req.Password.Length < 6)
            return BadRequest(new { message = "Password must be at least 6 characters." });

        var email = req.Email.Trim().ToLowerInvariant();
        if (await _context.Users.AnyAsync(u => u.Email == email))
            return Conflict(new { message = "An account with this email already exists." });

        var user = new User
        {
            FullName = req.FullName.Trim(),
            Email = email,
            PasswordHash = _auth.HashPassword(req.Password),
            DietaryPreferencesJson = JsonSerializer.Serialize(req.DietaryPreferences ?? new List<string>()),
            AllergensJson = JsonSerializer.Serialize(req.Allergens ?? new List<string>()),
            HealthGoalsJson = JsonSerializer.Serialize(req.HealthGoals ?? new List<string>()),
            CreatedAt = DateTime.UtcNow
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        var token = _auth.CreateToken(user.UserId, user.Email, user.FullName);
        return Ok(new { token, user = ToUserDto(user) });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Password))
            return BadRequest(new { message = "Email and password are required." });

        var email = req.Email.Trim().ToLowerInvariant();
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);
        if (user == null || !_auth.VerifyPassword(req.Password, user.PasswordHash))
            return Unauthorized(new { message = "Invalid email or password." });

        var token = _auth.CreateToken(user.UserId, user.Email, user.FullName);
        return Ok(new { token, user = ToUserDto(user) });
    }

    [HttpGet("me")]
    public async Task<IActionResult> Me()
    {
        var userId = _auth.ValidateTokenAndGetUserId(Request);
        if (!userId.HasValue) return Unauthorized(new { message = "Authentication required." });

        var user = await _context.Users.FirstOrDefaultAsync(u => u.UserId == userId.Value);
        if (user == null) return Unauthorized();

        return Ok(ToUserDto(user));
    }

    [HttpPut("preferences")]
    public async Task<IActionResult> UpdatePreferences([FromBody] PreferencesRequest req)
    {
        var userId = _auth.ValidateTokenAndGetUserId(Request);
        if (!userId.HasValue) return Unauthorized(new { message = "Authentication required." });

        var user = await _context.Users.FirstOrDefaultAsync(u => u.UserId == userId.Value);
        if (user == null) return Unauthorized();

        if (!string.IsNullOrWhiteSpace(req.FullName))
            user.FullName = req.FullName.Trim();

        user.DietaryPreferencesJson = JsonSerializer.Serialize(req.DietaryPreferences ?? new List<string>());
        user.AllergensJson = JsonSerializer.Serialize(req.Allergens ?? new List<string>());
        user.HealthGoalsJson = JsonSerializer.Serialize(req.HealthGoals ?? new List<string>());

        await _context.SaveChangesAsync();
        return Ok(ToUserDto(user));
    }

    private static object ToUserDto(User u) => new
    {
        u.UserId,
        u.FullName,
        u.Email,
        dietaryPreferences = ParseList(u.DietaryPreferencesJson),
        allergens = ParseList(u.AllergensJson),
        healthGoals = ParseList(u.HealthGoalsJson),
        u.CreatedAt
    };

    private static List<string> ParseList(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new List<string>();
        try { return JsonSerializer.Deserialize<List<string>>(json) ?? new List<string>(); }
        catch { return new List<string>(); }
    }
}

public class RegisterRequest
{
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public List<string>? DietaryPreferences { get; set; }
    public List<string>? Allergens { get; set; }
    public List<string>? HealthGoals { get; set; }
}

public class LoginRequest
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class PreferencesRequest
{
    public string? FullName { get; set; }
    public List<string>? DietaryPreferences { get; set; }
    public List<string>? Allergens { get; set; }
    public List<string>? HealthGoals { get; set; }
}

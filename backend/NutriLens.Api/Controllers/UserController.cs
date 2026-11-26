using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NutriLens.Api.Data;
using NutriLens.Api.Models;
using NutriLens.Api.Services;

namespace NutriLens.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class UserController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly AuthTokenService _auth;

    public UserController(AppDbContext context, AuthTokenService auth)
    {
        _context = context;
        _auth = auth;
    }

    [HttpGet("dashboard")]
    public async Task<IActionResult> GetDashboard()
    {
        var userId = _auth.ValidateTokenAndGetUserId(Request);
        if (!userId.HasValue) return Unauthorized(new { message = "Sign in to access your dashboard." });

        var saved = await _context.SavedProducts
            .Where(s => s.UserId == userId.Value)
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync();

        var scans = await _context.ScanHistories
            .Where(s => s.UserId == userId.Value)
            .OrderByDescending(s => s.CreatedAt)
            .Take(20)
            .Select(s => new
            {
                s.ScanId,
                s.ProductName,
                s.Brand,
                s.Category,
                s.ServingSizeText,
                s.HealthScore,
                s.NovaGroup,
                s.Verdict,
                s.CreatedAt
            })
            .ToListAsync();

        var recent = await _context.RecentlyVieweds
            .Where(r => r.UserId == userId.Value)
            .Include(r => r.Product)
            .Where(r => r.Product != null && r.Product.IsActive)
            .OrderByDescending(r => r.ViewedAt)
            .Take(12)
            .Select(r => new
            {
                r.Product!.ProductId,
                r.Product.ProductName,
                r.Product.Brand,
                r.Product.Category,
                r.Product.ImageUrl,
                r.Product.HealthScore,
                r.Product.NovaGroup,
                r.Product.Verdict,
                r.ViewedAt
            })
            .ToListAsync();

        return Ok(new
        {
            savedProducts = saved,
            scanHistory = scans,
            recentlyViewed = recent
        });
    }

    [HttpPost("saved-products")]
    public async Task<IActionResult> SaveProduct([FromBody] SaveProductRequest req)
    {
        var userId = _auth.ValidateTokenAndGetUserId(Request);
        if (!userId.HasValue) return Unauthorized(new { message = "Sign in to save products." });

        if (req.ProductId.HasValue)
        {
            var existing = await _context.SavedProducts
                .FirstOrDefaultAsync(s => s.UserId == userId.Value && s.ProductId == req.ProductId.Value);
            if (existing != null) return Ok(existing);

            var prod = await _context.Products.FirstOrDefaultAsync(p => p.ProductId == req.ProductId.Value && p.IsActive);
            if (prod == null) return NotFound(new { message = "Product not found." });

            var saved = new SavedProduct
            {
                UserId = userId.Value,
                ProductId = prod.ProductId,
                ProductName = prod.ProductName,
                Brand = prod.Brand,
                Category = prod.Category,
                HealthScore = prod.HealthScore,
                NovaGroup = prod.NovaGroup,
                Verdict = prod.Verdict,
                SnapshotJson = JsonSerializer.Serialize(new { prod.ImageUrl, prod.CaloriesPer100g, prod.SugarPer100g, prod.SodiumMgPer100g }),
                CreatedAt = DateTime.UtcNow
            };
            _context.SavedProducts.Add(saved);
            await _context.SaveChangesAsync();
            return Ok(saved);
        }

        if (string.IsNullOrWhiteSpace(req.ProductName))
            return BadRequest(new { message = "ProductId or ProductName is required." });

        var savedScan = new SavedProduct
        {
            UserId = userId.Value,
            ScanId = req.ScanId,
            ProductName = req.ProductName.Trim(),
            Brand = req.Brand?.Trim(),
            Category = req.Category?.Trim(),
            HealthScore = req.HealthScore,
            NovaGroup = req.NovaGroup,
            Verdict = req.Verdict,
            SnapshotJson = req.SnapshotJson,
            CreatedAt = DateTime.UtcNow
        };
        _context.SavedProducts.Add(savedScan);
        await _context.SaveChangesAsync();
        return Ok(savedScan);
    }

    [HttpDelete("saved-products/{id:int}")]
    public async Task<IActionResult> DeleteSavedProduct(int id)
    {
        var userId = _auth.ValidateTokenAndGetUserId(Request);
        if (!userId.HasValue) return Unauthorized();

        var item = await _context.SavedProducts
            .FirstOrDefaultAsync(s => s.SavedProductId == id && s.UserId == userId.Value);
        if (item == null) return NotFound();

        _context.SavedProducts.Remove(item);
        await _context.SaveChangesAsync();
        return Ok(new { deleted = true });
    }
}

public class SaveProductRequest
{
    public int? ProductId { get; set; }
    public int? ScanId { get; set; }
    public string? ProductName { get; set; }
    public string? Brand { get; set; }
    public string? Category { get; set; }
    public int? HealthScore { get; set; }
    public int? NovaGroup { get; set; }
    public string? Verdict { get; set; }
    public string? SnapshotJson { get; set; }
}

using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NutriLens.Api.Data;
using NutriLens.Api.Models;
using NutriLens.Api.Services;

namespace NutriLens.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ProductsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly FoodAssessmentService _assessment;
    private readonly OpenFoodFactsService _offService;
    private readonly AuthTokenService _auth;

    public ProductsController(
        AppDbContext context,
        FoodAssessmentService assessment,
        OpenFoodFactsService offService,
        AuthTokenService auth)
    {
        _context = context;
        _assessment = assessment;
        _offService = offService;
        _auth = auth;
    }

    [HttpGet("categories")]
    public async Task<IActionResult> GetCategories()
    {
        var counts = await _context.Products
            .Where(p => p.IsActive && p.Category != null)
            .GroupBy(p => p.Category!)
            .Select(g => new { Category = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Category, x => x.Count);

        var result = FoodAssessmentService.PackagedFoodCategories.Select(cat => new
        {
            name = cat,
            count = counts.TryGetValue(cat, out var c) ? c : 0
        });

        return Ok(result);
    }

    [HttpGet]
    public async Task<IActionResult> GetProducts(
        [FromQuery] string? q = null,
        [FromQuery] string? category = null,
        [FromQuery] int? nova = null,
        [FromQuery] string? grade = null,
        [FromQuery] string? excludeAllergen = null,
        [FromQuery] string? sort = "score_desc")
    {
        var query = _context.Products.Where(p => p.IsActive).AsQueryable();

        if (!string.IsNullOrWhiteSpace(category) && !category.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(p => p.Category == category);
        }

        if (nova is >= 1 and <= 4)
        {
            query = query.Where(p => p.NovaGroup == nova);
        }

        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim().ToLower();
            query = query.Where(p =>
                p.ProductName.ToLower().Contains(term) ||
                (p.Brand != null && p.Brand.ToLower().Contains(term)) ||
                (p.Category != null && p.Category.ToLower().Contains(term)) ||
                (p.Ingredients != null && p.Ingredients.ToLower().Contains(term)) ||
                (p.Barcode != null && p.Barcode.Contains(term)));
        }

        var items = await query.ToListAsync();

        if (!string.IsNullOrWhiteSpace(excludeAllergen))
        {
            var excluded = excludeAllergen.Split(',', StringSplitOptions.RemoveEmptyEntries)
                .Select(x => x.Trim().ToLowerInvariant())
                .Where(x => x.Length > 0)
                .ToList();

            if (excluded.Count > 0)
            {
                items = items.Where(p =>
                {
                    var text = $"{p.Allergens} {p.Ingredients}".ToLowerInvariant();
                    return !excluded.Any(ex => text.Contains(ex));
                }).ToList();
            }
        }

        var enriched = items.Select(p =>
        {
            var assessed = _assessment.AssessProduct(p);
            return new
            {
                p.ProductId,
                p.Barcode,
                p.ProductName,
                p.Brand,
                p.Category,
                p.ImageUrl,
                p.NetWeight,
                p.ServingSize,
                p.ServingSizeG,
                p.NutritionBasis,
                p.Calories,
                p.SugarG,
                p.SodiumMg,
                p.ProteinG,
                p.FatG,
                p.SaturatedFatG,
                p.CaloriesPer100g,
                p.ProteinPer100g,
                p.CarbsPer100g,
                p.SugarPer100g,
                p.AddedSugarPer100g,
                p.FatPer100g,
                p.SaturatedFatPer100g,
                p.TransFatPer100g,
                p.FiberPer100g,
                p.SodiumMgPer100g,
                p.Ingredients,
                p.Allergens,
                p.DataSource,
                p.OffProductUrl,
                p.LastVerifiedAt,
                HealthScore = assessed.HealthScore,
                Grade = assessed.Grade,
                Verdict = assessed.Verdict,
                NovaGroup = assessed.Nova.Group,
                NovaLabel = assessed.Nova.Label,
                HighNutrientAlerts = assessed.HighNutrientAlerts,
                DetectedAllergens = assessed.IngredientsDecoded.DetectedAllergens,
                AdditiveCount = assessed.IngredientsDecoded.AdditiveCount,
                DataCompleteness = assessed.DataCompleteness
            };
        });

        if (!string.IsNullOrWhiteSpace(grade) && !grade.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            enriched = enriched.Where(x => string.Equals(x.Grade, grade.Trim(), StringComparison.OrdinalIgnoreCase));
        }

        enriched = (sort ?? "score_desc").ToLowerInvariant() switch
        {
            "score_asc" => enriched.OrderBy(x => x.HealthScore ?? 999).ThenBy(x => x.ProductName),
            "sugar_asc" => enriched.OrderBy(x => x.SugarPer100g ?? 9999m).ThenBy(x => x.ProductName),
            "sodium_asc" => enriched.OrderBy(x => x.SodiumMgPer100g ?? 99999m).ThenBy(x => x.ProductName),
            "protein_desc" => enriched.OrderByDescending(x => x.ProteinPer100g ?? -1m).ThenBy(x => x.ProductName),
            "calories_asc" => enriched.OrderBy(x => x.CaloriesPer100g ?? 99999m).ThenBy(x => x.ProductName),
            "name_asc" => enriched.OrderBy(x => x.ProductName),
            _ => enriched.OrderByDescending(x => x.HealthScore ?? -1).ThenBy(x => x.ProductName)
        };

        return Ok(enriched.ToList());
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetProduct(int id)
    {
        var product = await _context.Products
            .FirstOrDefaultAsync(p => p.ProductId == id && p.IsActive);

        if (product == null)
            return NotFound(new { message = "Product not found" });

        // Track Recently Viewed if authenticated
        var userId = _auth.ValidateTokenAndGetUserId(Request);
        if (userId.HasValue)
        {
            var existing = await _context.RecentlyVieweds
                .FirstOrDefaultAsync(r => r.UserId == userId.Value && r.ProductId == id);
            if (existing != null)
            {
                existing.ViewedAt = DateTime.UtcNow;
            }
            else
            {
                _context.RecentlyVieweds.Add(new RecentlyViewed
                {
                    UserId = userId.Value,
                    ProductId = id,
                    ViewedAt = DateTime.UtcNow
                });
            }
            await _context.SaveChangesAsync();
        }

        var assessed = _assessment.AssessProduct(product);
        var alternatives = await FindBetterAlternativesAsync(product.Category, assessed.HealthScore, product.ProductId);

        return Ok(new
        {
            product,
            assessment = assessed,
            betterAlternatives = alternatives
        });
    }

    [HttpGet("compare")]
    public async Task<IActionResult> CompareProducts([FromQuery] string ids)
    {
        if (string.IsNullOrWhiteSpace(ids))
            return BadRequest(new { message = "Provide 2 to 4 comma-separated product IDs." });

        var idList = ids.Split(',', StringSplitOptions.RemoveEmptyEntries)
            .Select(s => int.TryParse(s.Trim(), out var id) ? id : 0)
            .Where(id => id > 0)
            .Distinct()
            .Take(4)
            .ToList();

        if (idList.Count < 2)
            return BadRequest(new { message = "Select at least 2 products to compare." });

        var products = await _context.Products
            .Where(p => p.IsActive && idList.Contains(p.ProductId))
            .ToListAsync();

        var ordered = idList
            .Select(id => products.FirstOrDefault(p => p.ProductId == id))
            .Where(p => p != null)
            .Select(p => new
            {
                product = p!,
                assessment = _assessment.AssessProduct(p!)
            })
            .ToList();

        if (ordered.Count < 2)
            return NotFound(new { message = "At least two matching products were not found." });

        var bestScore = ordered.Where(x => x.assessment.HealthScore.HasValue)
            .OrderByDescending(x => x.assessment.HealthScore)
            .FirstOrDefault()?.product.ProductId;

        var lowestSugar = ordered.Where(x => x.product.SugarPer100g.HasValue)
            .OrderBy(x => x.product.SugarPer100g)
            .FirstOrDefault()?.product.ProductId;

        var lowestSodium = ordered.Where(x => x.product.SodiumMgPer100g.HasValue)
            .OrderBy(x => x.product.SodiumMgPer100g)
            .FirstOrDefault()?.product.ProductId;

        var highestProtein = ordered.Where(x => x.product.ProteinPer100g.HasValue)
            .OrderByDescending(x => x.product.ProteinPer100g)
            .FirstOrDefault()?.product.ProductId;

        var highestFiber = ordered.Where(x => x.product.FiberPer100g.HasValue)
            .OrderByDescending(x => x.product.FiberPer100g)
            .FirstOrDefault()?.product.ProductId;

        var leastProcessed = ordered.Where(x => x.assessment.Nova.Group.HasValue)
            .OrderBy(x => x.assessment.Nova.Group)
            .ThenBy(x => x.assessment.IngredientsDecoded.AdditiveCount)
            .FirstOrDefault()?.product.ProductId;

        var insights = new List<string>();
        var scores = ordered.Where(x => x.assessment.HealthScore.HasValue).ToList();
        if (scores.Count >= 2)
        {
            var top = scores.OrderByDescending(x => x.assessment.HealthScore).First();
            var bot = scores.OrderBy(x => x.assessment.HealthScore).First();
            var diff = top.assessment.HealthScore!.Value - bot.assessment.HealthScore!.Value;
            if (diff > 0)
                insights.Add($"{top.product.ProductName} scores {diff} points higher overall ({top.assessment.HealthScore} vs {bot.assessment.HealthScore}).");
        }

        var sugars = ordered.Where(x => x.product.SugarPer100g.HasValue).ToList();
        if (sugars.Count >= 2)
        {
            var low = sugars.OrderBy(x => x.product.SugarPer100g).First();
            var high = sugars.OrderByDescending(x => x.product.SugarPer100g).First();
            if (high.product.SugarPer100g > low.product.SugarPer100g)
                insights.Add($"{low.product.ProductName} has {high.product.SugarPer100g - low.product.SugarPer100g:0.#} g less sugar per 100g than {high.product.ProductName}.");
        }

        var sodiums = ordered.Where(x => x.product.SodiumMgPer100g.HasValue).ToList();
        if (sodiums.Count >= 2)
        {
            var low = sodiums.OrderBy(x => x.product.SodiumMgPer100g).First();
            var high = sodiums.OrderByDescending(x => x.product.SodiumMgPer100g).First();
            if (high.product.SodiumMgPer100g > low.product.SodiumMgPer100g)
                insights.Add($"{low.product.ProductName} contains {high.product.SodiumMgPer100g - low.product.SodiumMgPer100g:0.#} mg less sodium per 100g than {high.product.ProductName}.");
        }

        return Ok(new
        {
            items = ordered,
            highlights = new
            {
                bestScoreProductId = bestScore,
                lowestSugarProductId = lowestSugar,
                lowestSodiumProductId = lowestSodium,
                highestProteinProductId = highestProtein,
                highestFiberProductId = highestFiber,
                leastProcessedProductId = leastProcessed,
                differences = insights
            }
        });
    }

    [HttpGet("search-off")]
    public async Task<IActionResult> SearchOpenFoodFacts([FromQuery] string q)
    {
        if (string.IsNullOrWhiteSpace(q) || q.Trim().Length < 2)
            return BadRequest(new { message = "Enter at least 2 characters to search Open Food Facts." });

        try
        {
            var items = await _offService.SearchAsync(q, 12);
            var barcodes = items.Select(x => x.Barcode).ToList();
            var existingMap = await _context.Products
                .Where(p => p.IsActive && p.Barcode != null && barcodes.Contains(p.Barcode))
                .ToDictionaryAsync(p => p.Barcode!, p => p.ProductId);

            var result = items.Select(item => new
            {
                item.Barcode,
                item.ProductName,
                item.Brand,
                item.Category,
                item.ImageUrl,
                item.NetWeight,
                item.ServingSize,
                item.CaloriesPer100g,
                item.SugarPer100g,
                item.ProteinPer100g,
                item.SodiumMgPer100g,
                item.NovaGroup,
                item.OffProductUrl,
                existingProductId = existingMap.TryGetValue(item.Barcode, out var pid) ? pid : (int?)null
            });

            return Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(502, new { message = $"Open Food Facts search is temporarily unavailable: {ex.Message}" });
        }
    }

    [HttpPost("import-off/{barcode}")]
    public async Task<IActionResult> ImportFromOpenFoodFacts(string barcode)
    {
        var cleanCode = new string((barcode ?? "").Where(char.IsDigit).ToArray());
        if (string.IsNullOrWhiteSpace(cleanCode))
            return BadRequest(new { message = "Invalid barcode." });

        var existing = await _context.Products.FirstOrDefaultAsync(p => p.Barcode == cleanCode && p.IsActive);
        if (existing != null)
        {
            var existingAssessed = _assessment.AssessProduct(existing);
            return Ok(new { product = existing, assessment = existingAssessed, alreadyExisted = true });
        }

        try
        {
            var imported = await _offService.FetchAndBuildProductAsync(cleanCode);
            if (imported == null)
                return NotFound(new { message = $"No packaged food product found in Open Food Facts for barcode {cleanCode}." });

            _context.Products.Add(imported);
            await _context.SaveChangesAsync();

            var assessed = _assessment.AssessProduct(imported);
            return Ok(new { product = imported, assessment = assessed, alreadyExisted = false });
        }
        catch (Exception ex)
        {
            return StatusCode(502, new { message = $"Unable to import product from Open Food Facts: {ex.Message}" });
        }
    }

    private async Task<List<object>> FindBetterAlternativesAsync(string? category, int? currentScore, int? excludeProductId)
    {
        if (string.IsNullOrWhiteSpace(category)) return new List<object>();

        var peers = await _context.Products
            .Where(p => p.IsActive && p.Category == category && p.ProductId != excludeProductId && p.HealthScore != null)
            .OrderByDescending(p => p.HealthScore)
            .Take(8)
            .ToListAsync();

        var minTarget = currentScore.HasValue ? currentScore.Value + 3 : 60;
        var better = peers
            .Where(p => p.HealthScore!.Value >= minTarget)
            .Take(3)
            .Select(p => (object)new
            {
                p.ProductId,
                p.ProductName,
                p.Brand,
                p.Category,
                p.ImageUrl,
                p.HealthScore,
                p.Verdict,
                p.NovaGroup,
                p.CaloriesPer100g,
                p.SugarPer100g,
                p.SodiumMgPer100g,
                p.ProteinPer100g,
                p.FiberPer100g,
                ImprovementReason = BuildImprovementReason(p, currentScore)
            })
            .ToList();

        return better;
    }

    private static string BuildImprovementReason(Product alt, int? currentScore)
    {
        var reasons = new List<string>();
        if (currentScore.HasValue && alt.HealthScore.HasValue)
            reasons.Add($"+{alt.HealthScore.Value - currentScore.Value} score points");
        if (alt.NovaGroup is 1 or 2 or 3)
            reasons.Add($"NOVA {alt.NovaGroup}");
        if (alt.SugarPer100g is <= 5m)
            reasons.Add($"Low sugar ({alt.SugarPer100g:0.#}g/100g)");
        if (alt.ProteinPer100g is >= 10m)
            reasons.Add($"{alt.ProteinPer100g:0.#}g protein/100g");
        if (alt.FiberPer100g is >= 5m)
            reasons.Add($"{alt.FiberPer100g:0.#}g fiber/100g");

        return reasons.Count > 0 ? string.Join(" • ", reasons) : "Stronger overall nutrient profile in this category";
    }
}

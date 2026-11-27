using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NutriLens.Api.Data;
using NutriLens.Api.Models;
using NutriLens.Api.Services;

namespace NutriLens.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ScansController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly FoodAssessmentService _assessment;
    private readonly IngredientDecoderService _decoder;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _config;
    private readonly AuthTokenService _auth;

    public ScansController(
        AppDbContext context,
        FoodAssessmentService assessment,
        IngredientDecoderService decoder,
        IHttpClientFactory httpClientFactory,
        IConfiguration config,
        AuthTokenService auth)
    {
        _context = context;
        _assessment = assessment;
        _decoder = decoder;
        _httpClientFactory = httpClientFactory;
        _config = config;
        _auth = auth;
    }

    private string AiServiceBaseUrl =>
        (_config["AiServiceUrl"] ?? "http://localhost:8000").TrimEnd('/');

    [HttpPost("analyze-image")]
    [RequestSizeLimit(12 * 1024 * 1024)]
    public async Task<IActionResult> AnalyzeImage([FromForm] IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { success = false, message = "Please upload a packaged food label image." });

        if (!file.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { success = false, message = "Only image files are supported." });

        try
        {
            var client = _httpClientFactory.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(240);

            using var content = new MultipartFormDataContent();
            await using var stream = file.OpenReadStream();
            using var fileContent = new StreamContent(stream);
            fileContent.Headers.ContentType = MediaTypeHeaderValue.Parse(file.ContentType);
            content.Add(fileContent, "file", file.FileName);

            using var response = await client.PostAsync($"{AiServiceBaseUrl}/analyze-image", content);
            var body = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
                return StatusCode(502, new { success = false, message = $"AI service error ({(int)response.StatusCode})." });

            using var doc = JsonDocument.Parse(body);
            var root = doc.RootElement;
            if (!root.TryGetProperty("success", out var okEl) || !okEl.GetBoolean())
            {
                return Ok(JsonSerializer.Deserialize<object>(body));
            }

            return Content(body, "application/json");
        }
        catch (Exception ex)
        {
            return StatusCode(502, new
            {
                success = false,
                message = $"Could not reach the AI vision service on {AiServiceBaseUrl}. Ensure FastAPI & Ollama are running. ({ex.Message})"
            });
        }
    }

    [HttpPost("evaluate")]
    public async Task<IActionResult> EvaluateScan([FromBody] EvaluateScanRequest req)
    {
        if (req == null)
            return BadRequest(new { message = "Invalid scan evaluation payload." });

        var assessment = _assessment.Assess(
            req.Category,
            req.ServingSizeG,
            req.Per100g,
            req.PerServing,
            req.IngredientsText,
            req.Allergens,
            null);

        // Find better alternatives in the same category when score is available
        var alternatives = new List<object>();
        if (!string.IsNullOrWhiteSpace(req.Category) && assessment.HealthScore.HasValue)
        {
            var minScore = assessment.HealthScore.Value + 3;
            var peers = await _context.Products
                .Where(p => p.IsActive && p.Category == req.Category && p.HealthScore != null && p.HealthScore >= minScore)
                .OrderByDescending(p => p.HealthScore)
                .Take(3)
                .ToListAsync();

            alternatives = peers.Select(p => (object)new
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
                ImprovementReason = $"+{p.HealthScore!.Value - assessment.HealthScore.Value} score points • NOVA {p.NovaGroup}"
            }).ToList();
        }

        // Optional strictly-separated AI narrative commentary
        object? aiCommentary = null;
        if (req.RequestAiSummary)
        {
            aiCommentary = await TryGetAiCommentaryAsync(
                req.ProductName,
                req.Category,
                req.IngredientsText,
                assessment.Verdict,
                assessment.Nova.Label,
                assessment.HighNutrientAlerts);
        }

        int? scanId = null;
        if (req.SaveToHistory)
        {
            var userId = _auth.ValidateTokenAndGetUserId(Request);
            var scan = new ScanHistory
            {
                UserId = userId,
                ProductName = string.IsNullOrWhiteSpace(req.ProductName) ? "Scanned Packaged Food" : req.ProductName.Trim(),
                Brand = req.Brand?.Trim(),
                Category = req.Category?.Trim(),
                Barcode = req.Barcode?.Trim(),
                NetWeight = req.NetWeight?.Trim(),
                ServingSizeText = req.ServingSizeText?.Trim(),
                ServingSizeG = req.ServingSizeG,
                NutritionBasis = assessment.EvaluationBasis,
                ExtractedJson = req.RawExtractedJson,
                CorrectedJson = JsonSerializer.Serialize(req),
                AssessmentJson = JsonSerializer.Serialize(assessment),
                HealthScore = assessment.HealthScore,
                NovaGroup = assessment.Nova.Group,
                Verdict = assessment.Verdict,
                SourceImageName = req.SourceImageName,
                CreatedAt = DateTime.UtcNow
            };
            _context.ScanHistories.Add(scan);
            await _context.SaveChangesAsync();
            scanId = scan.ScanId;
        }

        return Ok(new
        {
            scanId,
            productName = string.IsNullOrWhiteSpace(req.ProductName) ? "Scanned Packaged Food" : req.ProductName.Trim(),
            brand = req.Brand,
            category = req.Category,
            netWeight = req.NetWeight,
            servingSizeText = req.ServingSizeText,
            servingSizeG = req.ServingSizeG,
            servingsPerPack = req.ServingsPerPack,
            ingredientsText = req.IngredientsText,
            allergens = req.Allergens,
            assessment,
            betterAlternatives = alternatives,
            aiCommentary
        });
    }

    [HttpPost("decode-ingredients")]
    public IActionResult DecodeIngredients([FromBody] DecodeIngredientsRequest req)
    {
        var summary = _decoder.Decode(req?.IngredientsText, req?.Allergens);
        return Ok(summary);
    }

    [HttpGet("history")]
    public async Task<IActionResult> GetHistory()
    {
        var userId = _auth.ValidateTokenAndGetUserId(Request);
        var query = _context.ScanHistories.AsQueryable();
        if (userId.HasValue)
        {
            query = query.Where(s => s.UserId == userId.Value);
        }
        else
        {
            query = query.Where(s => s.UserId == null);
        }

        var list = await query
            .OrderByDescending(s => s.CreatedAt)
            .Take(25)
            .Select(s => new
            {
                s.ScanId,
                s.ProductName,
                s.Brand,
                s.Category,
                s.ServingSizeText,
                s.ServingSizeG,
                s.HealthScore,
                s.NovaGroup,
                s.Verdict,
                s.SourceImageName,
                s.CreatedAt
            })
            .ToListAsync();

        return Ok(list);
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetScan(int id)
    {
        var scan = await _context.ScanHistories.FirstOrDefaultAsync(s => s.ScanId == id);
        if (scan == null) return NotFound(new { message = "Scan record not found." });

        AssessmentResultDto? assessment = null;
        if (!string.IsNullOrWhiteSpace(scan.AssessmentJson))
        {
            assessment = JsonSerializer.Deserialize<AssessmentResultDto>(scan.AssessmentJson);
        }

        EvaluateScanRequest? corrected = null;
        if (!string.IsNullOrWhiteSpace(scan.CorrectedJson))
        {
            corrected = JsonSerializer.Deserialize<EvaluateScanRequest>(scan.CorrectedJson);
        }

        return Ok(new
        {
            scan.ScanId,
            scan.ProductName,
            scan.Brand,
            scan.Category,
            scan.Barcode,
            scan.NetWeight,
            scan.ServingSizeText,
            scan.ServingSizeG,
            scan.HealthScore,
            scan.NovaGroup,
            scan.Verdict,
            scan.SourceImageName,
            scan.CreatedAt,
            corrected,
            assessment
        });
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteScan(int id)
    {
        var userId = _auth.ValidateTokenAndGetUserId(Request);
        var scan = await _context.ScanHistories.FirstOrDefaultAsync(s => s.ScanId == id);
        if (scan == null) return NotFound();
        if (scan.UserId != null && scan.UserId != userId) return Forbid();

        _context.ScanHistories.Remove(scan);
        await _context.SaveChangesAsync();
        return Ok(new { deleted = true });
    }

    [HttpDelete("history")]
    public async Task<IActionResult> ClearHistory()
    {
        var userId = _auth.ValidateTokenAndGetUserId(Request);
        var scans = userId.HasValue
            ? await _context.ScanHistories.Where(s => s.UserId == userId.Value).ToListAsync()
            : await _context.ScanHistories.Where(s => s.UserId == null).ToListAsync();

        if (scans.Count > 0)
        {
            _context.ScanHistories.RemoveRange(scans);
            await _context.SaveChangesAsync();
        }
        return Ok(new { cleared = scans.Count });
    }

    private async Task<object?> TryGetAiCommentaryAsync(
        string? productName, string? category, string? ingredientsText,
        string verdict, string novaLabel, List<string> highAlerts)
    {
        try
        {
            var client = _httpClientFactory.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(60);
            var payload = JsonSerializer.Serialize(new
            {
                product_name = productName,
                category,
                ingredients_text = ingredientsText,
                verdict,
                nova_label = novaLabel,
                high_alerts = highAlerts
            });
            using var res = await client.PostAsync(
                $"{AiServiceBaseUrl}/explain",
                new StringContent(payload, Encoding.UTF8, "application/json"));

            if (!res.IsSuccessStatusCode) return null;
            var json = await res.Content.ReadAsStringAsync();
            return JsonSerializer.Deserialize<object>(json);
        }
        catch
        {
            return null;
        }
    }
}

public class EvaluateScanRequest
{
    public string? ProductName { get; set; }
    public string? Brand { get; set; }
    public string? Category { get; set; }
    public string? Barcode { get; set; }
    public string? NetWeight { get; set; }
    public string? ServingSizeText { get; set; }
    public decimal? ServingSizeG { get; set; }
    public string? ServingsPerPack { get; set; }
    public string? NutritionBasis { get; set; }
    public NutritionInputDto? Per100g { get; set; }
    public NutritionInputDto? PerServing { get; set; }
    public string? IngredientsText { get; set; }
    public string? Allergens { get; set; }
    public string? SourceImageName { get; set; }
    public string? RawExtractedJson { get; set; }
    public bool SaveToHistory { get; set; } = true;
    public bool RequestAiSummary { get; set; } = true;
}

public class DecodeIngredientsRequest
{
    public string? IngredientsText { get; set; }
    public string? Allergens { get; set; }
}

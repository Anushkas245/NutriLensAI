using System.Text.Json;
using NutriLens.Api.Models;

namespace NutriLens.Api.Services;

public class OpenFoodFactsService
{
    private readonly HttpClient _httpClient;
    private readonly FoodAssessmentService _assessment;

    private static readonly string Fields = string.Join(",", new[]
    {
        "code", "product_name", "brands", "quantity", "serving_size",
        "serving_quantity", "ingredients_text", "ingredients_text_en",
        "allergens_tags", "allergens", "nova_group", "nutriments",
        "image_front_url", "image_url", "categories_tags", "categories"
    });

    public OpenFoodFactsService(HttpClient httpClient, FoodAssessmentService assessment)
    {
        _httpClient = httpClient;
        _httpClient.Timeout = TimeSpan.FromSeconds(15);
        if (!_httpClient.DefaultRequestHeaders.UserAgent.Any())
        {
            _httpClient.DefaultRequestHeaders.UserAgent.ParseAdd("NutriLensAI/1.0 (https://github.com/Anushkas245/NutriLensAI)");
        }
        _assessment = assessment;
    }

    public async Task<List<OffSearchProductDto>> SearchAsync(string query, int pageSize = 12)
    {
        if (string.IsNullOrWhiteSpace(query)) return new List<OffSearchProductDto>();

        var url = $"https://world.openfoodfacts.org/cgi/search.pl?search_terms={Uri.EscapeDataString(query.Trim())}&search_simple=1&action=process&json=1&page_size={Math.Clamp(pageSize, 1, 24)}&fields={Fields}";
        using var response = await _httpClient.GetAsync(url);
        response.EnsureSuccessStatusCode();

        await using var stream = await response.Content.ReadAsStreamAsync();
        using var doc = await JsonDocument.ParseAsync(stream);

        var results = new List<OffSearchProductDto>();
        if (!doc.RootElement.TryGetProperty("products", out var productsEl) || productsEl.ValueKind != JsonValueKind.Array)
            return results;

        foreach (var item in productsEl.EnumerateArray())
        {
            var dto = MapFromOffElement(item);
            if (dto != null && !string.IsNullOrWhiteSpace(dto.ProductName))
            {
                results.Add(dto);
            }
        }

        return results;
    }

    public async Task<Product?> FetchAndBuildProductAsync(string barcode)
    {
        if (string.IsNullOrWhiteSpace(barcode)) return null;
        var cleanCode = new string(barcode.Where(char.IsDigit).ToArray());
        if (string.IsNullOrWhiteSpace(cleanCode)) return null;

        var url = $"https://world.openfoodfacts.org/api/v2/product/{cleanCode}.json?fields={Fields}";
        using var response = await _httpClient.GetAsync(url);
        if (!response.IsSuccessStatusCode) return null;

        await using var stream = await response.Content.ReadAsStreamAsync();
        using var doc = await JsonDocument.ParseAsync(stream);

        if (!doc.RootElement.TryGetProperty("product", out var prodEl) || prodEl.ValueKind != JsonValueKind.Object)
            return null;

        var dto = MapFromOffElement(prodEl);
        if (dto == null || string.IsNullOrWhiteSpace(dto.ProductName)) return null;

        var product = new Product
        {
            Barcode = dto.Barcode,
            ProductName = dto.ProductName.Length > 150 ? dto.ProductName[..150] : dto.ProductName,
            Brand = dto.Brand != null && dto.Brand.Length > 100 ? dto.Brand[..100] : dto.Brand,
            Category = dto.Category,
            ImageUrl = dto.ImageUrl,
            NetWeight = dto.NetWeight,
            ServingSize = dto.ServingSize,
            ServingSizeG = dto.ServingSizeG,
            NutritionBasis = "per_100g",
            CaloriesPer100g = dto.CaloriesPer100g,
            ProteinPer100g = dto.ProteinPer100g,
            CarbsPer100g = dto.CarbsPer100g,
            SugarPer100g = dto.SugarPer100g,
            AddedSugarPer100g = dto.AddedSugarPer100g,
            FatPer100g = dto.FatPer100g,
            SaturatedFatPer100g = dto.SaturatedFatPer100g,
            TransFatPer100g = dto.TransFatPer100g,
            FiberPer100g = dto.FiberPer100g,
            SodiumMgPer100g = dto.SodiumMgPer100g,
            Ingredients = dto.Ingredients,
            Allergens = dto.Allergens,
            DataSource = "Open Food Facts",
            OffProductUrl = $"https://world.openfoodfacts.org/product/{dto.Barcode}",
            LastVerifiedAt = DateTime.UtcNow,
            IsActive = true
        };

        if (product.ServingSizeG is > 0)
        {
            var ratio = product.ServingSizeG.Value / 100m;
            product.Calories = RoundOpt(product.CaloriesPer100g, ratio);
            product.ProteinG = RoundOpt(product.ProteinPer100g, ratio);
            product.CarbsG = RoundOpt(product.CarbsPer100g, ratio);
            product.SugarG = RoundOpt(product.SugarPer100g, ratio);
            product.AddedSugarG = RoundOpt(product.AddedSugarPer100g, ratio);
            product.FatG = RoundOpt(product.FatPer100g, ratio);
            product.SaturatedFatG = RoundOpt(product.SaturatedFatPer100g, ratio);
            product.TransFatG = RoundOpt(product.TransFatPer100g, ratio);
            product.FiberG = RoundOpt(product.FiberPer100g, ratio);
            product.SodiumMg = RoundOpt(product.SodiumMgPer100g, ratio);
        }

        var assessed = _assessment.AssessProduct(product);
        product.NovaGroup = assessed.Nova.Group ?? dto.NovaGroup;
        product.HealthScore = assessed.HealthScore;
        product.Verdict = assessed.Verdict;

        return product;
    }

    private static OffSearchProductDto? MapFromOffElement(JsonElement el)
    {
        var code = GetStr(el, "code");
        var name = GetStr(el, "product_name");
        if (string.IsNullOrWhiteSpace(code) || string.IsNullOrWhiteSpace(name)) return null;

        var brand = GetStr(el, "brands")?.Split(',').FirstOrDefault()?.Trim();
        var ingredients = GetStr(el, "ingredients_text_en") ?? GetStr(el, "ingredients_text");
        var imageUrl = GetStr(el, "image_front_url") ?? GetStr(el, "image_url");
        var netWeight = GetStr(el, "quantity");
        var servingSize = GetStr(el, "serving_size");
        var servingQty = GetDec(el, "serving_quantity");
        var nova = GetInt(el, "nova_group");

        decimal? kcal = null, protein = null, carbs = null, sugar = null, addedSugar = null,
                 fat = null, satFat = null, transFat = null, fiber = null, sodiumMg = null;

        if (el.TryGetProperty("nutriments", out var nut) && nut.ValueKind == JsonValueKind.Object)
        {
            kcal = GetDec(nut, "energy-kcal_100g");
            protein = GetDec(nut, "proteins_100g");
            carbs = GetDec(nut, "carbohydrates_100g");
            sugar = GetDec(nut, "sugars_100g");
            addedSugar = GetDec(nut, "added-sugars_100g");
            fat = GetDec(nut, "fat_100g");
            satFat = GetDec(nut, "saturated-fat_100g");
            transFat = GetDec(nut, "trans-fat_100g");
            fiber = GetDec(nut, "fiber_100g");

            var sodiumG = GetDec(nut, "sodium_100g");
            var saltG = GetDec(nut, "salt_100g");
            if (sodiumG.HasValue) sodiumMg = Math.Round(sodiumG.Value * 1000m, 1);
            else if (saltG.HasValue) sodiumMg = Math.Round(saltG.Value * 400m, 1);
        }

        string? allergens = null;
        if (el.TryGetProperty("allergens_tags", out var aTags) && aTags.ValueKind == JsonValueKind.Array)
        {
            var list = aTags.EnumerateArray()
                .Select(a => a.GetString()?.Replace("en:", "").Replace("-", " "))
                .Where(s => !string.IsNullOrWhiteSpace(s))
                .Select(s => char.ToUpperInvariant(s![0]) + s[1..])
                .ToList();
            if (list.Count > 0) allergens = string.Join(", ", list);
        }
        allergens ??= GetStr(el, "allergens");

        var category = InferPackagedCategory(el, name);

        return new OffSearchProductDto
        {
            Barcode = code,
            ProductName = name,
            Brand = brand,
            Category = category,
            ImageUrl = imageUrl,
            NetWeight = netWeight,
            ServingSize = servingSize,
            ServingSizeG = servingQty is > 0 ? servingQty : null,
            CaloriesPer100g = kcal,
            ProteinPer100g = protein,
            CarbsPer100g = carbs,
            SugarPer100g = sugar,
            AddedSugarPer100g = addedSugar,
            FatPer100g = fat,
            SaturatedFatPer100g = satFat,
            TransFatPer100g = transFat,
            FiberPer100g = fiber,
            SodiumMgPer100g = sodiumMg,
            Ingredients = ingredients,
            Allergens = allergens,
            NovaGroup = nova,
            OffProductUrl = $"https://world.openfoodfacts.org/product/{code}"
        };
    }

    private static string InferPackagedCategory(JsonElement el, string name)
    {
        var tags = GetStr(el, "categories") ?? "";
        if (el.TryGetProperty("categories_tags", out var ct) && ct.ValueKind == JsonValueKind.Array)
            tags += " " + string.Join(" ", ct.EnumerateArray().Select(x => x.GetString()));

        var text = (tags + " " + name).ToLowerInvariant();
        if (text.Contains("biscuit") || text.Contains("cookie") || text.Contains("cracker") || text.Contains("wafer")) return "Biscuits & Cookies";
        if (text.Contains("chocolate") || text.Contains("candy") || text.Contains("confection")) return "Chocolates & Confectionery";
        if (text.Contains("beverage") || text.Contains("juice") || text.Contains("soda") || text.Contains("drink") || text.Contains("tea") || text.Contains("coffee")) return "Beverages & Juices";
        if (text.Contains("noodle") || text.Contains("instant") || text.Contains("soup") || text.Contains("pasta")) return "Instant Foods & Noodles";
        if (text.Contains("cereal") || text.Contains("oat") || text.Contains("muesli") || text.Contains("flake") || text.Contains("breakfast")) return "Cereals & Breakfast";
        if (text.Contains("milk") || text.Contains("yogurt") || text.Contains("butter") || text.Contains("cheese") || text.Contains("dairy") || text.Contains("paneer")) return "Dairy Products";
        if (text.Contains("protein") && text.Contains("bar")) return "Protein Bars & Nutrition";
        if (text.Contains("poha") || text.Contains("sambar") || text.Contains("bhujia") || text.Contains("namkeen") || text.Contains("dal") || text.Contains("indian")) return "Packaged Indian Foods";
        if (text.Contains("snack") || text.Contains("chip") || text.Contains("crisp") || text.Contains("makhana") || text.Contains("popcorn")) return "Packaged Snacks";
        return "Other Packaged Foods";
    }

    private static decimal? RoundOpt(decimal? val, decimal factor) =>
        val.HasValue ? Math.Round(val.Value * factor, 2) : null;

    private static string? GetStr(JsonElement el, string prop)
    {
        if (el.TryGetProperty(prop, out var val) && val.ValueKind == JsonValueKind.String)
        {
            var s = val.GetString()?.Trim();
            return string.IsNullOrWhiteSpace(s) ? null : s;
        }
        return null;
    }

    private static decimal? GetDec(JsonElement el, string prop)
    {
        if (!el.TryGetProperty(prop, out var val)) return null;
        if (val.ValueKind == JsonValueKind.Number && val.TryGetDecimal(out var d)) return d;
        if (val.ValueKind == JsonValueKind.String && decimal.TryParse(val.GetString(), out var ds)) return ds;
        return null;
    }

    private static int? GetInt(JsonElement el, string prop)
    {
        if (!el.TryGetProperty(prop, out var val)) return null;
        if (val.ValueKind == JsonValueKind.Number && val.TryGetInt32(out var i)) return i;
        return null;
    }
}

public class OffSearchProductDto
{
    public string Barcode { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;
    public string? Brand { get; set; }
    public string Category { get; set; } = "Other Packaged Foods";
    public string? ImageUrl { get; set; }
    public string? NetWeight { get; set; }
    public string? ServingSize { get; set; }
    public decimal? ServingSizeG { get; set; }
    public decimal? CaloriesPer100g { get; set; }
    public decimal? ProteinPer100g { get; set; }
    public decimal? CarbsPer100g { get; set; }
    public decimal? SugarPer100g { get; set; }
    public decimal? AddedSugarPer100g { get; set; }
    public decimal? FatPer100g { get; set; }
    public decimal? SaturatedFatPer100g { get; set; }
    public decimal? TransFatPer100g { get; set; }
    public decimal? FiberPer100g { get; set; }
    public decimal? SodiumMgPer100g { get; set; }
    public string? Ingredients { get; set; }
    public string? Allergens { get; set; }
    public int? NovaGroup { get; set; }
    public string? OffProductUrl { get; set; }
}

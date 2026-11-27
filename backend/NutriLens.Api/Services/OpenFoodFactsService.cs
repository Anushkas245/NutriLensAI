using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Caching.Memory;
using NutriLens.Api.Models;

namespace NutriLens.Api.Services;

public class OpenFoodFactsService
{
    private readonly HttpClient _httpClient;
    private readonly FoodAssessmentService _assessment;
    private readonly IConfiguration _configuration;
    private readonly IMemoryCache _cache;

    private static readonly string OffFields = string.Join(",", new[]
    {
        "code", "product_name", "product_name_en", "brands", "quantity", "serving_size",
        "serving_quantity", "ingredients_text", "ingredients_text_en",
        "allergens_tags", "allergens", "nova_group", "nutriscore_grade", "nutrition_grades",
        "nutriments", "image_front_url", "image_url", "categories_tags", "categories"
    });

    public OpenFoodFactsService(
        HttpClient httpClient,
        FoodAssessmentService assessment,
        IConfiguration configuration,
        IMemoryCache cache)
    {
        _httpClient = httpClient;
        _httpClient.Timeout = TimeSpan.FromSeconds(25);
        if (!_httpClient.DefaultRequestHeaders.UserAgent.Any())
        {
            _httpClient.DefaultRequestHeaders.UserAgent.ParseAdd("NutriLensAI-PackagedFood/1.0 (https://github.com/Anushkas245/NutriLensAI)");
        }
        _assessment = assessment;
        _configuration = configuration;
        _cache = cache;
    }

    public async Task<ExternalSearchResponseDto> SearchExternalAsync(
        string query,
        string? category = null,
        string source = "all",
        int page = 1,
        int pageSize = 12)
    {
        var cleanQuery = (query ?? string.Empty).Trim();
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 24);

        var response = new ExternalSearchResponseDto
        {
            Query = cleanQuery,
            Page = page,
            PageSize = pageSize
        };

        var isBarcode = IsLikelyBarcode(cleanQuery);
        if (isBarcode)
        {
            var cleanCode = new string(cleanQuery.Where(char.IsDigit).ToArray());
            var barcodeTasks = new List<Task<ExternalFoodDto?>>();

            if (source is "all" or "off")
                barcodeTasks.Add(FetchOffProductWithFallbackAsync(cleanCode, response.Warnings));
            if (source is "all" or "usda")
                barcodeTasks.Add(SearchUsdaByBarcodeAsync(cleanCode, response.Warnings));

            var found = await Task.WhenAll(barcodeTasks);
            foreach (var item in found.Where(x => x != null))
            {
                if (item!.Source == "off" && !response.SourcesUsed.Contains("Open Food Facts"))
                    response.SourcesUsed.Add("Open Food Facts");
                if (item.Source == "usda" && !response.SourcesUsed.Contains("USDA FoodData Central"))
                    response.SourcesUsed.Add("USDA FoodData Central");
                response.Items.Add(item);
            }

            response.TotalCount = response.Items.Count;
            response.HasMore = false;
            return response;
        }

        var effectiveQuery = cleanQuery;
        if (string.IsNullOrWhiteSpace(effectiveQuery) && !string.IsNullOrWhiteSpace(category) && !category.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            effectiveQuery = category;
        }

        if (string.IsNullOrWhiteSpace(effectiveQuery))
            return response;

        if (source is "all" or "off")
        {
            var offResult = await SearchOpenFoodFactsV3Async(effectiveQuery, category, page, pageSize, response.Warnings);
            if (offResult.Items.Count > 0)
            {
                response.SourcesUsed.Add("Open Food Facts");
                response.Items.AddRange(offResult.Items);
                response.TotalCount = Math.Max(response.TotalCount, offResult.TotalCount);
                response.HasMore = response.HasMore || offResult.HasMore;
            }
        }

        if (source == "usda" || (source == "all" && response.Items.Count < 4))
        {
            var usdaResult = await SearchUsdaBrandedAsync(
                effectiveQuery,
                page,
                source == "usda" ? pageSize : Math.Max(4, pageSize - response.Items.Count),
                response.Warnings);

            if (usdaResult.Items.Count > 0)
            {
                response.SourcesUsed.Add("USDA FoodData Central");
                var seenCodes = response.Items
                    .Where(i => !string.IsNullOrWhiteSpace(i.Barcode))
                    .Select(i => i.Barcode!.TrimStart('0'))
                    .ToHashSet(StringComparer.OrdinalIgnoreCase);

                foreach (var u in usdaResult.Items)
                {
                    var normCode = u.Barcode?.TrimStart('0') ?? "";
                    if (!string.IsNullOrEmpty(normCode) && seenCodes.Contains(normCode))
                        continue;
                    response.Items.Add(u);
                }

                if (source == "usda")
                {
                    response.TotalCount = usdaResult.TotalCount;
                    response.HasMore = usdaResult.HasMore;
                }
                else
                {
                    response.TotalCount = Math.Max(response.TotalCount, response.Items.Count);
                    response.HasMore = response.HasMore || usdaResult.HasMore;
                }
            }
        }

        return response;
    }

    public async Task<List<ExternalFoodDto>> SearchAsync(string query, int pageSize = 12)
    {
        var res = await SearchExternalAsync(query, null, "off", 1, pageSize);
        return res.Items;
    }

    public async Task<ExternalFoodDetailDto?> FetchExternalDetailAsync(string source, string externalId)
    {
        if (string.Equals(source, "usda", StringComparison.OrdinalIgnoreCase))
        {
            return await FetchUsdaDetailAsync(externalId);
        }

        var cleanCode = new string((externalId ?? "").Where(char.IsDigit).ToArray());
        if (string.IsNullOrWhiteSpace(cleanCode)) return null;

        var dto = await FetchOffProductWithFallbackAsync(cleanCode, null);
        if (dto == null) return null;

        var product = MapDtoToTransientProduct(dto);
        var assessment = _assessment.AssessProduct(product);
        return new ExternalFoodDetailDto
        {
            Source = "off",
            ExternalId = dto.Barcode ?? cleanCode,
            NutriScoreGrade = dto.NutriScoreGrade,
            RawCategories = dto.RawCategories,
            Product = product,
            Assessment = assessment
        };
    }

    public async Task<Product?> FetchAndBuildProductAsync(string barcode)
    {
        var detail = await FetchExternalDetailAsync("off", barcode);
        return detail?.Product;
    }

    public async Task<Product?> FetchAndBuildExternalProductAsync(string source, string externalId)
    {
        var detail = await FetchExternalDetailAsync(source, externalId);
        return detail?.Product;
    }

    private async Task<(List<ExternalFoodDto> Items, int TotalCount, bool HasMore)> SearchOpenFoodFactsV3Async(
        string query,
        string? category,
        int page,
        int pageSize,
        List<string> warnings)
    {
        try
        {
            var searchQuery = query;
            if (!string.IsNullOrWhiteSpace(category) && !category.Equals("all", StringComparison.OrdinalIgnoreCase)
                && !query.Contains(category, StringComparison.OrdinalIgnoreCase))
            {
                var catKeyword = MapCategoryToOffKeyword(category);
                if (!string.IsNullOrWhiteSpace(catKeyword) && !query.Contains(catKeyword, StringComparison.OrdinalIgnoreCase))
                    searchQuery = $"{query} {catKeyword}";
            }

            var url = $"https://search.openfoodfacts.org/search?q={Uri.EscapeDataString(searchQuery)}&page={page}&page_size={pageSize}";
            using var res = await SendWithRetryAsync(url, TimeSpan.FromSeconds(14));
            if (res == null || !res.IsSuccessStatusCode)
            {
                return await SearchOpenFoodFactsLegacyAsync(query, page, pageSize, warnings);
            }

            await using var stream = await res.Content.ReadAsStreamAsync();
            using var doc = await JsonDocument.ParseAsync(stream);

            var totalCount = GetInt(doc.RootElement, "count") ?? 0;
            var hits = new List<ExternalFoodDto>();
            if (doc.RootElement.TryGetProperty("hits", out var hitsEl) && hitsEl.ValueKind == JsonValueKind.Array)
            {
                foreach (var hit in hitsEl.EnumerateArray())
                {
                    var mapped = MapFromOffElement(hit, "off");
                    if (mapped != null)
                    {
                        CacheExternalDto(mapped);
                        hits.Add(mapped);
                    }
                }
            }

            // Enrich hits gently (max 3 concurrent) via v2 product endpoint & cache full records
            var sem = new SemaphoreSlim(3);
            var enrichTasks = hits.Select(async item =>
            {
                if (string.IsNullOrWhiteSpace(item.Barcode)) return item;
                if (_cache.TryGetValue($"off:full:{item.Barcode}", out ExternalFoodDto? cached) && cached != null)
                    return cached;

                await sem.WaitAsync();
                try
                {
                    var enriched = await FetchOffBarcodeDtoAsync(item.Barcode, null, TimeSpan.FromSeconds(9));
                    if (enriched != null)
                    {
                        _cache.Set($"off:full:{item.Barcode}", enriched, TimeSpan.FromMinutes(20));
                        return enriched;
                    }
                    return item;
                }
                catch
                {
                    return item;
                }
                finally
                {
                    sem.Release();
                }
            }).ToList();

            var enrichedList = (await Task.WhenAll(enrichTasks)).ToList();
            bool hasMore = totalCount > page * pageSize || hits.Count == pageSize;
            return (enrichedList, totalCount, hasMore);
        }
        catch (Exception ex)
        {
            warnings.Add($"Open Food Facts search fallback triggered: {ex.Message}");
            return await SearchOpenFoodFactsLegacyAsync(query, page, pageSize, warnings);
        }
    }

    private async Task<(List<ExternalFoodDto> Items, int TotalCount, bool HasMore)> SearchOpenFoodFactsLegacyAsync(
        string query, int page, int pageSize, List<string> warnings)
    {
        try
        {
            var url = $"https://world.openfoodfacts.org/cgi/search.pl?search_terms={Uri.EscapeDataString(query)}&search_simple=1&action=process&json=1&page={page}&page_size={pageSize}&fields={OffFields}";
            using var res = await SendWithRetryAsync(url, TimeSpan.FromSeconds(15), maxRetries: 1);
            if (res == null || !res.IsSuccessStatusCode)
            {
                warnings.Add($"Open Food Facts legacy search returned {(res != null ? (int)res.StatusCode : 503)}.");
                return (new List<ExternalFoodDto>(), 0, false);
            }

            await using var stream = await res.Content.ReadAsStreamAsync();
            using var doc = await JsonDocument.ParseAsync(stream);
            var totalCount = GetInt(doc.RootElement, "count") ?? 0;

            var list = new List<ExternalFoodDto>();
            if (doc.RootElement.TryGetProperty("products", out var prodEl) && prodEl.ValueKind == JsonValueKind.Array)
            {
                foreach (var p in prodEl.EnumerateArray())
                {
                    var mapped = MapFromOffElement(p, "off");
                    if (mapped != null)
                    {
                        _cache.Set($"off:full:{mapped.Barcode}", mapped, TimeSpan.FromMinutes(20));
                        list.Add(mapped);
                    }
                }
            }
            return (list, totalCount, totalCount > page * pageSize);
        }
        catch (Exception ex)
        {
            warnings.Add($"Open Food Facts search unavailable: {ex.Message}");
            return (new List<ExternalFoodDto>(), 0, false);
        }
    }

    private async Task<ExternalFoodDto?> FetchOffProductWithFallbackAsync(string barcode, List<string>? warnings)
    {
        if (_cache.TryGetValue($"off:full:{barcode}", out ExternalFoodDto? fullCached) && fullCached != null)
            return fullCached;

        var direct = await FetchOffBarcodeDtoAsync(barcode, warnings, TimeSpan.FromSeconds(14));
        if (direct != null)
        {
            _cache.Set($"off:full:{barcode}", direct, TimeSpan.FromMinutes(20));
            return direct;
        }

        // Fallback to Search-a-licious if v2/product was temporarily rate-limited
        try
        {
            var v3Url = $"https://search.openfoodfacts.org/search?q={Uri.EscapeDataString(barcode)}&page_size=3";
            using var res = await SendWithRetryAsync(v3Url, TimeSpan.FromSeconds(10), maxRetries: 1);
            if (res != null && res.IsSuccessStatusCode)
            {
                await using var stream = await res.Content.ReadAsStreamAsync();
                using var doc = await JsonDocument.ParseAsync(stream);
                if (doc.RootElement.TryGetProperty("hits", out var hitsEl) && hitsEl.ValueKind == JsonValueKind.Array)
                {
                    foreach (var hit in hitsEl.EnumerateArray())
                    {
                        var mapped = MapFromOffElement(hit, "off");
                        if (mapped != null && (mapped.Barcode == barcode || mapped.Barcode?.TrimStart('0') == barcode.TrimStart('0')))
                        {
                            CacheExternalDto(mapped);
                            return mapped;
                        }
                    }
                }
            }
        }
        catch
        {
            // Fall through to partial cache
        }

        if (_cache.TryGetValue($"off:partial:{barcode}", out ExternalFoodDto? partialCached) && partialCached != null)
            return partialCached;

        return null;
    }

    private async Task<ExternalFoodDto?> FetchOffBarcodeDtoAsync(string barcode, List<string>? warnings, TimeSpan? timeout = null)
    {
        try
        {
            var url = $"https://world.openfoodfacts.org/api/v2/product/{barcode}.json?fields={OffFields}";
            using var res = await SendWithRetryAsync(url, timeout ?? TimeSpan.FromSeconds(12), maxRetries: 2);
            if (res == null || !res.IsSuccessStatusCode)
                return null;

            await using var stream = await res.Content.ReadAsStreamAsync();
            using var doc = await JsonDocument.ParseAsync(stream);
            if (doc.RootElement.TryGetProperty("status", out var statusEl) && statusEl.ValueKind == JsonValueKind.Number && statusEl.GetInt32() == 0)
                return null;

            if (!doc.RootElement.TryGetProperty("product", out var prodEl) || prodEl.ValueKind != JsonValueKind.Object)
                return null;

            return MapFromOffElement(prodEl, "off");
        }
        catch (Exception ex)
        {
            warnings?.Add($"Open Food Facts barcode lookup failed for {barcode}: {ex.Message}");
            return null;
        }
    }

    private async Task<(List<ExternalFoodDto> Items, int TotalCount, bool HasMore)> SearchUsdaBrandedAsync(
        string query, int page, int pageSize, List<string> warnings)
    {
        try
        {
            var apiKey = _configuration["UsdaApiKey"] ?? "DEMO_KEY";
            var url = $"https://api.nal.usda.gov/fdc/v1/foods/search?api_key={Uri.EscapeDataString(apiKey)}&query={Uri.EscapeDataString(query)}&dataType=Branded&pageNumber={page}&pageSize={Math.Clamp(pageSize, 1, 20)}";
            using var res = await SendWithRetryAsync(url, TimeSpan.FromSeconds(12), maxRetries: 1);
            if (res == null || !res.IsSuccessStatusCode)
            {
                if (res != null && (int)res.StatusCode == 429)
                    warnings.Add("USDA FoodData Central demo rate limit reached; showing Open Food Facts results.");
                return (new List<ExternalFoodDto>(), 0, false);
            }

            await using var stream = await res.Content.ReadAsStreamAsync();
            using var doc = await JsonDocument.ParseAsync(stream);
            var totalHits = GetInt(doc.RootElement, "totalHits") ?? 0;

            var items = new List<ExternalFoodDto>();
            if (doc.RootElement.TryGetProperty("foods", out var foodsEl) && foodsEl.ValueKind == JsonValueKind.Array)
            {
                foreach (var f in foodsEl.EnumerateArray())
                {
                    var mapped = MapFromUsdaSearchItem(f);
                    if (mapped != null)
                    {
                        _cache.Set($"usda:full:{mapped.ExternalId}", mapped, TimeSpan.FromMinutes(20));
                        items.Add(mapped);
                    }
                }
            }
            return (items, totalHits, totalHits > page * pageSize);
        }
        catch (Exception ex)
        {
            warnings.Add($"USDA FoodData Central unavailable: {ex.Message}");
            return (new List<ExternalFoodDto>(), 0, false);
        }
    }

    private async Task<ExternalFoodDto?> SearchUsdaByBarcodeAsync(string barcode, List<string> warnings)
    {
        var res = await SearchUsdaBrandedAsync(barcode, 1, 3, warnings);
        return res.Items.FirstOrDefault(i =>
            !string.IsNullOrWhiteSpace(i.Barcode) &&
            i.Barcode.TrimStart('0').Equals(barcode.TrimStart('0'), StringComparison.OrdinalIgnoreCase));
    }

    private async Task<ExternalFoodDetailDto?> FetchUsdaDetailAsync(string fdcId)
    {
        if (!int.TryParse(fdcId, out var id)) return null;

        ExternalFoodDto? dto = null;
        if (!_cache.TryGetValue($"usda:full:{id}", out dto) || dto == null)
        {
            var apiKey = _configuration["UsdaApiKey"] ?? "DEMO_KEY";
            var url = $"https://api.nal.usda.gov/fdc/v1/food/{id}?api_key={Uri.EscapeDataString(apiKey)}";
            using var res = await SendWithRetryAsync(url, TimeSpan.FromSeconds(12), maxRetries: 1);
            if (res == null || !res.IsSuccessStatusCode) return null;

            await using var stream = await res.Content.ReadAsStreamAsync();
            using var doc = await JsonDocument.ParseAsync(stream);
            dto = MapFromUsdaDetailItem(doc.RootElement);
        }

        if (dto == null) return null;
        var product = MapDtoToTransientProduct(dto);
        var assessment = _assessment.AssessProduct(product);
        return new ExternalFoodDetailDto
        {
            Source = "usda",
            ExternalId = dto.ExternalId,
            NutriScoreGrade = null,
            RawCategories = dto.RawCategories,
            Product = product,
            Assessment = assessment
        };
    }

    private void CacheExternalDto(ExternalFoodDto dto)
    {
        if (!string.IsNullOrWhiteSpace(dto.Barcode))
            _cache.Set($"off:partial:{dto.Barcode}", dto, TimeSpan.FromMinutes(20));
    }

    private async Task<HttpResponseMessage?> SendWithRetryAsync(string url, TimeSpan timeout, int maxRetries = 2)
    {
        for (int attempt = 0; attempt <= maxRetries; attempt++)
        {
            try
            {
                using var cts = new CancellationTokenSource(timeout);
                var res = await _httpClient.GetAsync(url, cts.Token);
                if ((int)res.StatusCode is 503 or 429 && attempt < maxRetries)
                {
                    res.Dispose();
                    await Task.Delay(600 * (attempt + 1));
                    continue;
                }
                return res;
            }
            catch (OperationCanceledException) when (attempt < maxRetries)
            {
                await Task.Delay(400);
            }
            catch (HttpRequestException) when (attempt < maxRetries)
            {
                await Task.Delay(400);
            }
        }
        return null;
    }

    private Product MapDtoToTransientProduct(ExternalFoodDto dto)
    {
        var product = new Product
        {
            Barcode = dto.Barcode,
            ProductName = dto.ProductName.Length > 150 ? dto.ProductName[..150] : dto.ProductName,
            Brand = dto.Brand != null && dto.Brand.Length > 100 ? dto.Brand[..100] : dto.Brand,
            Category = dto.Category,
            ImageUrl = dto.ImageUrl,
            NetWeight = dto.NetWeight?.Length > 60 ? dto.NetWeight[..60] : dto.NetWeight,
            ServingSize = dto.ServingSize?.Length > 50 ? dto.ServingSize[..50] : dto.ServingSize,
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
            Allergens = dto.Allergens?.Length > 500 ? dto.Allergens[..500] : dto.Allergens,
            DataSource = dto.DataSource,
            OffProductUrl = dto.SourceUrl,
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

    private ExternalFoodDto? MapFromOffElement(JsonElement el, string source)
    {
        var code = GetStr(el, "code");
        var name = GetStr(el, "product_name") ?? GetStr(el, "product_name_en");
        if (string.IsNullOrWhiteSpace(code) || string.IsNullOrWhiteSpace(name)) return null;

        var brand = ExtractBrand(el);
        var ingredients = GetStr(el, "ingredients_text_en") ?? GetStr(el, "ingredients_text");
        var imageUrl = GetStr(el, "image_front_url") ?? GetStr(el, "image_url");
        var netWeight = GetStr(el, "quantity");
        var servingSize = GetStr(el, "serving_size");
        var servingQty = GetDec(el, "serving_quantity");
        var nova = GetInt(el, "nova_group");

        var nutriscore = (GetStr(el, "nutriscore_grade") ?? GetStr(el, "nutrition_grades"))?.ToUpperInvariant();
        if (nutriscore is not ("A" or "B" or "C" or "D" or "E"))
            nutriscore = null;

        decimal? kcal = null, protein = null, carbs = null, sugar = null, addedSugar = null,
                 fat = null, satFat = null, transFat = null, fiber = null, sodiumMg = null;

        if (el.TryGetProperty("nutriments", out var nut) && nut.ValueKind == JsonValueKind.Object)
        {
            kcal = Round2(GetDec(nut, "energy-kcal_100g"));
            if (!kcal.HasValue)
            {
                var kj = GetDec(nut, "energy-kj_100g");
                if (kj.HasValue) kcal = Math.Round(kj.Value / 4.184m, 1);
            }
            protein = Round2(GetDec(nut, "proteins_100g"));
            carbs = Round2(GetDec(nut, "carbohydrates_100g"));
            sugar = Round2(GetDec(nut, "sugars_100g"));
            addedSugar = Round2(GetDec(nut, "added-sugars_100g"));
            fat = Round2(GetDec(nut, "fat_100g"));
            satFat = Round2(GetDec(nut, "saturated-fat_100g"));
            transFat = Round2(GetDec(nut, "trans-fat_100g"));
            fiber = Round2(GetDec(nut, "fiber_100g"));

            var sodiumG = GetDec(nut, "sodium_100g");
            var saltG = GetDec(nut, "salt_100g");
            if (sodiumG.HasValue) sodiumMg = Math.Round(sodiumG.Value * 1000m, 1);
            else if (saltG.HasValue) sodiumMg = Math.Round(saltG.Value * 400m, 1);
        }

        string? allergens = null;
        if (el.TryGetProperty("allergens_tags", out var aTags) && aTags.ValueKind == JsonValueKind.Array)
        {
            var list = aTags.EnumerateArray()
                .Select(a => StripLangPrefix(a.GetString()))
                .Where(s => !string.IsNullOrWhiteSpace(s))
                .Select(s => char.ToUpperInvariant(s![0]) + s[1..])
                .ToList();
            if (list.Count > 0) allergens = string.Join(", ", list);
        }
        allergens ??= GetStr(el, "allergens");

        var rawCategories = ExtractRawCategories(el);
        var category = InferPackagedCategory(string.Join(" ", rawCategories), name);

        var tempProduct = new Product
        {
            ProductName = name,
            Category = category,
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
            NovaGroup = nova
        };
        var assessed = _assessment.AssessProduct(tempProduct);

        return new ExternalFoodDto
        {
            Source = source,
            ExternalId = code,
            Barcode = code,
            ProductName = name,
            Brand = brand,
            Category = category,
            RawCategories = rawCategories,
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
            NovaGroup = assessed.Nova.Group ?? nova,
            NutriScoreGrade = nutriscore,
            HealthScore = assessed.HealthScore,
            Grade = assessed.Grade,
            Verdict = assessed.Verdict,
            DataCompleteness = assessed.DataCompleteness,
            DataSource = "Open Food Facts",
            SourceUrl = $"https://world.openfoodfacts.org/product/{code}"
        };
    }

    private ExternalFoodDto? MapFromUsdaSearchItem(JsonElement el)
    {
        var fdcId = GetInt(el, "fdcId");
        var name = GetStr(el, "description");
        if (!fdcId.HasValue || string.IsNullOrWhiteSpace(name)) return null;

        var brand = GetStr(el, "brandName") ?? GetStr(el, "brandOwner");
        var barcode = GetStr(el, "gtinUpc");
        var ingredients = GetStr(el, "ingredients");
        var foodCat = GetStr(el, "foodCategory");
        var servingSizeNum = GetDec(el, "servingSize");
        var servingUnit = GetStr(el, "servingSizeUnit") ?? "g";
        var servingText = servingSizeNum.HasValue ? $"{servingSizeNum:0.#} {servingUnit}" : GetStr(el, "householdServingFullText");

        decimal? kcal = null, protein = null, carbs = null, sugar = null, addedSugar = null,
                 fat = null, satFat = null, transFat = null, fiber = null, sodiumMg = null;

        if (el.TryGetProperty("foodNutrients", out var nuts) && nuts.ValueKind == JsonValueKind.Array)
        {
            foreach (var n in nuts.EnumerateArray())
            {
                var num = GetStr(n, "nutrientNumber");
                var val = Round2(GetDec(n, "value"));
                if (!val.HasValue) continue;
                switch (num)
                {
                    case "208":
                    case "957":
                        kcal ??= val;
                        break;
                    case "203": protein = val; break;
                    case "204": fat = val; break;
                    case "205": carbs = val; break;
                    case "269": sugar = val; break;
                    case "539": addedSugar = val; break;
                    case "291": fiber = val; break;
                    case "307": sodiumMg = val; break;
                    case "606": satFat = val; break;
                    case "605": transFat = val; break;
                }
            }
        }

        var rawCats = string.IsNullOrWhiteSpace(foodCat) ? new List<string>() : new List<string> { foodCat };
        var category = InferPackagedCategory(foodCat ?? "", name);

        var tempProduct = new Product
        {
            ProductName = ToTitleIfAllCaps(name),
            Category = category,
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
            Ingredients = ingredients
        };
        var assessed = _assessment.AssessProduct(tempProduct);

        return new ExternalFoodDto
        {
            Source = "usda",
            ExternalId = fdcId.Value.ToString(),
            Barcode = barcode,
            ProductName = ToTitleIfAllCaps(name),
            Brand = string.IsNullOrWhiteSpace(brand) ? null : ToTitleIfAllCaps(brand),
            Category = category,
            RawCategories = rawCats,
            ServingSize = servingText,
            ServingSizeG = servingUnit.Equals("g", StringComparison.OrdinalIgnoreCase) || servingUnit.Equals("ml", StringComparison.OrdinalIgnoreCase)
                ? servingSizeNum
                : null,
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
            Allergens = assessed.IngredientsDecoded.DetectedAllergens.Count > 0
                ? string.Join(", ", assessed.IngredientsDecoded.DetectedAllergens)
                : null,
            NovaGroup = assessed.Nova.Group,
            HealthScore = assessed.HealthScore,
            Grade = assessed.Grade,
            Verdict = assessed.Verdict,
            DataCompleteness = assessed.DataCompleteness,
            DataSource = "USDA FoodData Central",
            SourceUrl = $"https://fdc.nal.usda.gov/fdc-app.html#/food-details/{fdcId.Value}/nutrients"
        };
    }

    private ExternalFoodDto? MapFromUsdaDetailItem(JsonElement el)
    {
        var fdcId = GetInt(el, "fdcId");
        var name = GetStr(el, "description");
        if (!fdcId.HasValue || string.IsNullOrWhiteSpace(name)) return null;

        var brand = GetStr(el, "brandName") ?? GetStr(el, "brandOwner");
        var barcode = GetStr(el, "gtinUpc");
        var ingredients = GetStr(el, "ingredients");
        var foodCat = GetStr(el, "brandedFoodCategory") ?? GetStr(el, "foodCategory");
        var servingSizeNum = GetDec(el, "servingSize");
        var servingUnit = GetStr(el, "servingSizeUnit") ?? "g";
        var servingText = servingSizeNum.HasValue ? $"{servingSizeNum:0.#} {servingUnit}" : GetStr(el, "householdServingFullText");

        decimal? kcal = null, protein = null, carbs = null, sugar = null, addedSugar = null,
                 fat = null, satFat = null, transFat = null, fiber = null, sodiumMg = null;

        if (el.TryGetProperty("foodNutrients", out var nuts) && nuts.ValueKind == JsonValueKind.Array)
        {
            foreach (var n in nuts.EnumerateArray())
            {
                if (!n.TryGetProperty("nutrient", out var nutMeta) || nutMeta.ValueKind != JsonValueKind.Object) continue;
                var num = GetStr(nutMeta, "number");
                var val = Round2(GetDec(n, "amount"));
                if (!val.HasValue) continue;
                switch (num)
                {
                    case "208":
                    case "957":
                        kcal ??= val;
                        break;
                    case "203": protein = val; break;
                    case "204": fat = val; break;
                    case "205": carbs = val; break;
                    case "269": sugar = val; break;
                    case "539": addedSugar = val; break;
                    case "291": fiber = val; break;
                    case "307": sodiumMg = val; break;
                    case "606": satFat = val; break;
                    case "605": transFat = val; break;
                }
            }
        }

        var category = InferPackagedCategory(foodCat ?? "", name);
        return new ExternalFoodDto
        {
            Source = "usda",
            ExternalId = fdcId.Value.ToString(),
            Barcode = barcode,
            ProductName = ToTitleIfAllCaps(name),
            Brand = string.IsNullOrWhiteSpace(brand) ? null : ToTitleIfAllCaps(brand),
            Category = category,
            RawCategories = string.IsNullOrWhiteSpace(foodCat) ? new List<string>() : new List<string> { foodCat },
            ServingSize = servingText,
            ServingSizeG = servingUnit.Equals("g", StringComparison.OrdinalIgnoreCase) || servingUnit.Equals("ml", StringComparison.OrdinalIgnoreCase)
                ? servingSizeNum
                : null,
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
            DataSource = "USDA FoodData Central",
            SourceUrl = $"https://fdc.nal.usda.gov/fdc-app.html#/food-details/{fdcId.Value}/nutrients"
        };
    }

    private static string? ExtractBrand(JsonElement el)
    {
        if (!el.TryGetProperty("brands", out var bEl)) return null;
        if (bEl.ValueKind == JsonValueKind.String)
        {
            var first = bEl.GetString()?.Split(',').FirstOrDefault()?.Trim();
            return StripLangPrefix(first);
        }
        if (bEl.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in bEl.EnumerateArray())
            {
                var cleaned = StripLangPrefix(item.GetString());
                if (!string.IsNullOrWhiteSpace(cleaned)) return cleaned;
            }
        }
        return null;
    }

    private static List<string> ExtractRawCategories(JsonElement el)
    {
        var list = new List<string>();
        foreach (var prop in new[] { "categories_tags", "categories" })
        {
            if (!el.TryGetProperty(prop, out var cEl)) continue;
            if (cEl.ValueKind == JsonValueKind.Array)
            {
                foreach (var x in cEl.EnumerateArray())
                {
                    var s = StripLangPrefix(x.GetString());
                    if (!string.IsNullOrWhiteSpace(s) && !list.Contains(s, StringComparer.OrdinalIgnoreCase))
                        list.Add(s);
                }
            }
            else if (cEl.ValueKind == JsonValueKind.String)
            {
                foreach (var s in (cEl.GetString() ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries))
                {
                    var cleaned = StripLangPrefix(s);
                    if (!string.IsNullOrWhiteSpace(cleaned) && !list.Contains(cleaned, StringComparer.OrdinalIgnoreCase))
                        list.Add(cleaned);
                }
            }
        }
        return list.Take(6).ToList();
    }

    private static string? StripLangPrefix(string? val)
    {
        if (string.IsNullOrWhiteSpace(val)) return null;
        var s = Regex.Replace(val.Trim(), @"^[a-z]{2}:", "", RegexOptions.IgnoreCase).Replace('-', ' ').Trim();
        return string.IsNullOrWhiteSpace(s) ? null : s;
    }

    private static string MapCategoryToOffKeyword(string category) => category switch
    {
        "Packaged Snacks" => "snacks",
        "Biscuits & Cookies" => "biscuits",
        "Chocolates & Confectionery" => "chocolate",
        "Beverages & Juices" => "beverage",
        "Instant Foods & Noodles" => "noodles",
        "Cereals & Breakfast" => "cereals",
        "Dairy Products" => "dairy",
        "Packaged Indian Foods" => "indian",
        "Protein Bars & Nutrition" => "protein bar",
        _ => ""
    };

    private static bool IsLikelyBarcode(string input) =>
        Regex.IsMatch(input.Trim(), @"^\d{6,14}$");

    private static string ToTitleIfAllCaps(string s)
    {
        if (s.Length > 3 && s == s.ToUpperInvariant())
            return System.Globalization.CultureInfo.InvariantCulture.TextInfo.ToTitleCase(s.ToLowerInvariant());
        return s;
    }

    private static string InferPackagedCategory(string tags, string name)
    {
        var text = (tags + " " + name).ToLowerInvariant();
        if (text.Contains("biscuit") || text.Contains("cookie") || text.Contains("cracker") || text.Contains("wafer")) return "Biscuits & Cookies";
        if (text.Contains("chocolate") || text.Contains("candy") || text.Contains("confection")) return "Chocolates & Confectionery";
        if (text.Contains("beverage") || text.Contains("juice") || text.Contains("soda") || text.Contains("cola") || text.Contains("drink") || text.Contains("tea") || text.Contains("coffee")) return "Beverages & Juices";
        if (text.Contains("noodle") || text.Contains("instant") || text.Contains("soup") || text.Contains("pasta")) return "Instant Foods & Noodles";
        if (text.Contains("cereal") || text.Contains("oat") || text.Contains("muesli") || text.Contains("flake") || text.Contains("breakfast")) return "Cereals & Breakfast";
        if (text.Contains("milk") || text.Contains("yogurt") || text.Contains("butter") || text.Contains("cheese") || text.Contains("dairy") || text.Contains("paneer")) return "Dairy Products";
        if (text.Contains("protein") && text.Contains("bar")) return "Protein Bars & Nutrition";
        if (text.Contains("poha") || text.Contains("sambar") || text.Contains("bhujia") || text.Contains("namkeen") || text.Contains("dal") || text.Contains("indian")) return "Packaged Indian Foods";
        if (text.Contains("snack") || text.Contains("chip") || text.Contains("crisp") || text.Contains("makhana") || text.Contains("popcorn")) return "Packaged Snacks";
        return "Other Packaged Foods";
    }

    private static decimal? Round2(decimal? val) =>
        val.HasValue ? Math.Round(val.Value, 2) : null;

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

public class ExternalSearchResponseDto
{
    public string Query { get; set; } = string.Empty;
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 12;
    public int TotalCount { get; set; }
    public bool HasMore { get; set; }
    public List<string> SourcesUsed { get; set; } = new();
    public List<string> Warnings { get; set; } = new();
    public List<ExternalFoodDto> Items { get; set; } = new();
}

public class ExternalFoodDto
{
    public string Source { get; set; } = "off";
    public string ExternalId { get; set; } = string.Empty;
    public string? Barcode { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string? Brand { get; set; }
    public string Category { get; set; } = "Other Packaged Foods";
    public List<string> RawCategories { get; set; } = new();
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
    public string? NutriScoreGrade { get; set; }
    public int? HealthScore { get; set; }
    public string Grade { get; set; } = "N/A";
    public string Verdict { get; set; } = "Incomplete Data";
    public string DataCompleteness { get; set; } = "Insufficient";
    public string DataSource { get; set; } = "Open Food Facts";
    public string? SourceUrl { get; set; }
    public int? ExistingProductId { get; set; }
}

public class ExternalFoodDetailDto
{
    public string Source { get; set; } = "off";
    public string ExternalId { get; set; } = string.Empty;
    public string? NutriScoreGrade { get; set; }
    public List<string> RawCategories { get; set; } = new();
    public Product Product { get; set; } = new();
    public AssessmentResultDto Assessment { get; set; } = new();
}

using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using NutriLens.Api.Models;
using NutriLens.Api.Services;

namespace NutriLens.Api.Data;

public static class DatabaseInitializer
{
    public static async Task InitializeAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var assessment = scope.ServiceProvider.GetRequiredService<FoodAssessmentService>();
        var env = scope.ServiceProvider.GetRequiredService<IWebHostEnvironment>();

        // 1. Ensure database exists and upgrade existing Products table + create new tables idempotently
        await context.Database.EnsureCreatedAsync();

        var upgradeSql = @"
IF COL_LENGTH('Products', 'Barcode') IS NULL ALTER TABLE Products ADD Barcode NVARCHAR(80) NULL;
IF COL_LENGTH('Products', 'ImageUrl') IS NULL ALTER TABLE Products ADD ImageUrl NVARCHAR(500) NULL;
IF COL_LENGTH('Products', 'NetWeight') IS NULL ALTER TABLE Products ADD NetWeight NVARCHAR(60) NULL;
IF COL_LENGTH('Products', 'ServingSizeG') IS NULL ALTER TABLE Products ADD ServingSizeG DECIMAL(10,2) NULL;
IF COL_LENGTH('Products', 'ServingsPerPack') IS NULL ALTER TABLE Products ADD ServingsPerPack NVARCHAR(50) NULL;
IF COL_LENGTH('Products', 'NutritionBasis') IS NULL ALTER TABLE Products ADD NutritionBasis NVARCHAR(30) NULL;
IF COL_LENGTH('Products', 'CarbsG') IS NULL ALTER TABLE Products ADD CarbsG DECIMAL(10,2) NULL;
IF COL_LENGTH('Products', 'AddedSugarG') IS NULL ALTER TABLE Products ADD AddedSugarG DECIMAL(10,2) NULL;
IF COL_LENGTH('Products', 'FiberG') IS NULL ALTER TABLE Products ADD FiberG DECIMAL(10,2) NULL;
IF COL_LENGTH('Products', 'TransFatG') IS NULL ALTER TABLE Products ADD TransFatG DECIMAL(10,2) NULL;
IF COL_LENGTH('Products', 'CaloriesPer100g') IS NULL ALTER TABLE Products ADD CaloriesPer100g DECIMAL(10,2) NULL;
IF COL_LENGTH('Products', 'ProteinPer100g') IS NULL ALTER TABLE Products ADD ProteinPer100g DECIMAL(10,2) NULL;
IF COL_LENGTH('Products', 'CarbsPer100g') IS NULL ALTER TABLE Products ADD CarbsPer100g DECIMAL(10,2) NULL;
IF COL_LENGTH('Products', 'SugarPer100g') IS NULL ALTER TABLE Products ADD SugarPer100g DECIMAL(10,2) NULL;
IF COL_LENGTH('Products', 'AddedSugarPer100g') IS NULL ALTER TABLE Products ADD AddedSugarPer100g DECIMAL(10,2) NULL;
IF COL_LENGTH('Products', 'FatPer100g') IS NULL ALTER TABLE Products ADD FatPer100g DECIMAL(10,2) NULL;
IF COL_LENGTH('Products', 'SaturatedFatPer100g') IS NULL ALTER TABLE Products ADD SaturatedFatPer100g DECIMAL(10,2) NULL;
IF COL_LENGTH('Products', 'TransFatPer100g') IS NULL ALTER TABLE Products ADD TransFatPer100g DECIMAL(10,2) NULL;
IF COL_LENGTH('Products', 'FiberPer100g') IS NULL ALTER TABLE Products ADD FiberPer100g DECIMAL(10,2) NULL;
IF COL_LENGTH('Products', 'SodiumMgPer100g') IS NULL ALTER TABLE Products ADD SodiumMgPer100g DECIMAL(10,2) NULL;
IF COL_LENGTH('Products', 'OffProductUrl') IS NULL ALTER TABLE Products ADD OffProductUrl NVARCHAR(500) NULL;
IF COL_LENGTH('Products', 'NovaGroup') IS NULL ALTER TABLE Products ADD NovaGroup INT NULL;
IF COL_LENGTH('Products', 'HealthScore') IS NULL ALTER TABLE Products ADD HealthScore INT NULL;
IF COL_LENGTH('Products', 'Verdict') IS NULL ALTER TABLE Products ADD Verdict NVARCHAR(60) NULL;
IF COL_LENGTH('Products', 'CreatedAt') IS NULL ALTER TABLE Products ADD CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME();

IF OBJECT_ID('Users', 'U') IS NULL
BEGIN
    CREATE TABLE Users (
        UserId INT IDENTITY(1,1) PRIMARY KEY,
        FullName NVARCHAR(120) NOT NULL,
        Email NVARCHAR(180) NOT NULL UNIQUE,
        PasswordHash NVARCHAR(300) NOT NULL,
        DietaryPreferencesJson NVARCHAR(MAX) NULL,
        AllergensJson NVARCHAR(MAX) NULL,
        HealthGoalsJson NVARCHAR(MAX) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END

IF OBJECT_ID('ScanHistories', 'U') IS NULL
BEGIN
    CREATE TABLE ScanHistories (
        ScanId INT IDENTITY(1,1) PRIMARY KEY,
        UserId INT NULL FOREIGN KEY REFERENCES Users(UserId) ON DELETE SET NULL,
        ProductName NVARCHAR(150) NOT NULL,
        Brand NVARCHAR(100) NULL,
        Category NVARCHAR(80) NULL,
        Barcode NVARCHAR(80) NULL,
        NetWeight NVARCHAR(60) NULL,
        ServingSizeText NVARCHAR(60) NULL,
        ServingSizeG DECIMAL(10,2) NULL,
        NutritionBasis NVARCHAR(30) NULL,
        ExtractedJson NVARCHAR(MAX) NULL,
        CorrectedJson NVARCHAR(MAX) NULL,
        AssessmentJson NVARCHAR(MAX) NULL,
        HealthScore INT NULL,
        NovaGroup INT NULL,
        Verdict NVARCHAR(60) NULL,
        SourceImageName NVARCHAR(200) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END

IF OBJECT_ID('SavedProducts', 'U') IS NULL
BEGIN
    CREATE TABLE SavedProducts (
        SavedProductId INT IDENTITY(1,1) PRIMARY KEY,
        UserId INT NOT NULL FOREIGN KEY REFERENCES Users(UserId) ON DELETE CASCADE,
        ProductId INT NULL FOREIGN KEY REFERENCES Products(ProductId) ON DELETE SET NULL,
        ScanId INT NULL,
        ProductName NVARCHAR(150) NOT NULL,
        Brand NVARCHAR(100) NULL,
        Category NVARCHAR(80) NULL,
        HealthScore INT NULL,
        NovaGroup INT NULL,
        Verdict NVARCHAR(60) NULL,
        SnapshotJson NVARCHAR(MAX) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END

IF OBJECT_ID('RecentlyVieweds', 'U') IS NULL
BEGIN
    CREATE TABLE RecentlyVieweds (
        RecentlyViewedId INT IDENTITY(1,1) PRIMARY KEY,
        UserId INT NOT NULL FOREIGN KEY REFERENCES Users(UserId) ON DELETE CASCADE,
        ProductId INT NOT NULL FOREIGN KEY REFERENCES Products(ProductId) ON DELETE CASCADE,
        ViewedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
";
        await context.Database.ExecuteSqlRawAsync(upgradeSql);

        // 2. Deactivate old fictional demo test rows if present
        await context.Database.ExecuteSqlRawAsync(
            "UPDATE Products SET IsActive = 0 WHERE DataSource = 'Fictional test data' AND IsActive = 1");

        // 3. Seed real Open Food Facts packaged food products if not already seeded
        var seedPath = Path.Combine(env.ContentRootPath, "Data", "seed_products.json");
        if (File.Exists(seedPath))
        {
            var json = await File.ReadAllTextAsync(seedPath);
            var seedItems = JsonSerializer.Deserialize<List<SeedProductItem>>(json, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            }) ?? new List<SeedProductItem>();

            var existingBarcodes = await context.Products
                .Where(p => p.Barcode != null)
                .Select(p => p.Barcode!)
                .ToHashSetAsync();

            var toAdd = new List<Product>();
            foreach (var item in seedItems)
            {
                if (string.IsNullOrWhiteSpace(item.Barcode) || existingBarcodes.Contains(item.Barcode))
                    continue;

                var product = new Product
                {
                    Barcode = item.Barcode,
                    ProductName = item.ProductName ?? "Unnamed Packaged Food",
                    Brand = item.Brand,
                    Category = item.Category,
                    ImageUrl = item.ImageUrl,
                    NetWeight = item.NetWeight,
                    ServingSize = item.ServingSize,
                    ServingSizeG = item.ServingSizeG,
                    NutritionBasis = "per_100g",
                    CaloriesPer100g = item.CaloriesPer100g,
                    ProteinPer100g = item.ProteinPer100g,
                    CarbsPer100g = item.CarbsPer100g,
                    SugarPer100g = item.SugarPer100g,
                    AddedSugarPer100g = item.AddedSugarPer100g,
                    FatPer100g = item.FatPer100g,
                    SaturatedFatPer100g = item.SaturatedFatPer100g,
                    TransFatPer100g = item.TransFatPer100g,
                    FiberPer100g = item.FiberPer100g,
                    SodiumMgPer100g = item.SodiumMgPer100g,
                    Ingredients = item.Ingredients,
                    Allergens = item.Allergens,
                    DataSource = item.DataSource ?? "Open Food Facts",
                    OffProductUrl = item.OffProductUrl,
                    LastVerifiedAt = DateTime.UtcNow,
                    IsActive = true
                };

                // Compute per-serving values only if ServingSizeG is explicitly known
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

                var assessed = assessment.AssessProduct(product);
                product.NovaGroup = assessed.Nova.Group ?? item.OffNovaGroup;
                product.HealthScore = assessed.HealthScore;
                product.Verdict = assessed.Verdict;

                toAdd.Add(product);
                existingBarcodes.Add(item.Barcode);
            }

            if (toAdd.Count > 0)
            {
                context.Products.AddRange(toAdd);
                await context.SaveChangesAsync();
            }
        }
    }

    private static decimal? RoundOpt(decimal? val, decimal factor) =>
        val.HasValue ? Math.Round(val.Value * factor, 2) : null;

    private sealed class SeedProductItem
    {
        public string? Barcode { get; set; }
        public string? ProductName { get; set; }
        public string? Brand { get; set; }
        public string? Category { get; set; }
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
        public int? OffNovaGroup { get; set; }
        public string? DataSource { get; set; }
        public string? OffProductUrl { get; set; }
    }
}

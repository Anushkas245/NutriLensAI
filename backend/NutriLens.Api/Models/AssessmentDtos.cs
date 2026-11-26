namespace NutriLens.Api.Models;

public class NutrientMetricDto
{
    public string Key { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public string Unit { get; set; } = string.Empty;
    public decimal? Per100g { get; set; }
    public decimal? PerServing { get; set; }
    public decimal? DailyValue { get; set; }
    public decimal? DailyValuePercentPerServing { get; set; }
    public decimal? DailyValuePercentPer100g { get; set; }
    public string Level { get; set; } = "unavailable"; // "low", "moderate", "high", "positive", "neutral", "unavailable"
    public string? FlagMessage { get; set; }
}

public class ScoreBreakdownItemDto
{
    public string Rule { get; set; } = string.Empty;
    public string Detail { get; set; } = string.Empty;
    public int PointsDelta { get; set; }
    public string Sentiment { get; set; } = "neutral"; // "positive", "negative", "neutral"
}

public class DecodedIngredientDto
{
    public string RawName { get; set; } = string.Empty;
    public string NormalizedName { get; set; } = string.Empty;
    public int OrderIndex { get; set; }
    public string Category { get; set; } = "Whole / Culinary"; // Whole, Culinary, Sweetener, Refined Oil, Preservative, Additive / Emulsifier, Flavour Enhancer, Artificial Colour, Artificial Sweetener, Flavouring
    public string Purpose { get; set; } = string.Empty;
    public string PlainExplanation { get; set; } = string.Empty;
    public string ConcernLevel { get; set; } = "low"; // "low", "moderate", "watch"
    public string? InsCode { get; set; }
    public bool IsAdditive { get; set; }
    public bool IsPreservative { get; set; }
    public bool IsSweetener { get; set; }
    public bool IsArtificialColour { get; set; }
    public List<string> AllergenTags { get; set; } = new();
}

public class IngredientSummaryDto
{
    public int TotalCount { get; set; }
    public int AdditiveCount { get; set; }
    public int PreservativeCount { get; set; }
    public int SweetenerCount { get; set; }
    public int ArtificialColourCount { get; set; }
    public List<string> DetectedAllergens { get; set; } = new();
    public List<DecodedIngredientDto> Items { get; set; } = new();
}

public class NovaAssessmentDto
{
    public int? Group { get; set; }
    public string Label { get; set; } = "Insufficient Ingredient Data";
    public string Description { get; set; } = string.Empty;
    public List<string> Triggers { get; set; } = new();
}

public class AssessmentResultDto
{
    public bool ScoreAvailable { get; set; }
    public int? HealthScore { get; set; }
    public string Grade { get; set; } = "N/A"; // A, B, C, D, N/A
    public string Verdict { get; set; } = "Incomplete Data";
    public string VerdictSummary { get; set; } = string.Empty;
    public string EvaluationBasis { get; set; } = "unavailable"; // "per_100g", "per_serving", "unavailable"
    public bool IsPerServingCalculated { get; set; }
    public bool IsPer100gCalculated { get; set; }
    public string DataCompleteness { get; set; } = "Insufficient"; // Complete, Partial, Insufficient
    public List<string> MissingNutrients { get; set; } = new();
    public List<string> HighNutrientAlerts { get; set; } = new();
    public List<string> PositiveFactors { get; set; } = new();
    public List<string> NegativeFactors { get; set; } = new();
    public List<ScoreBreakdownItemDto> ScoreBreakdown { get; set; } = new();
    public NovaAssessmentDto Nova { get; set; } = new();
    public List<NutrientMetricDto> Nutrients { get; set; } = new();
    public IngredientSummaryDto IngredientsDecoded { get; set; } = new();
    public string MethodologyNote { get; set; } =
        "Deterministic assessment computed using transparent FSSAI / ICMR-NIN 2,000 kcal reference thresholds and NOVA processing markers. Missing nutrients are kept unavailable and never treated as zero.";
}

public class NutritionInputDto
{
    public decimal? Calories { get; set; }
    public decimal? CarbsG { get; set; }
    public decimal? SugarG { get; set; }
    public decimal? AddedSugarG { get; set; }
    public decimal? FatG { get; set; }
    public decimal? SaturatedFatG { get; set; }
    public decimal? TransFatG { get; set; }
    public decimal? FiberG { get; set; }
    public decimal? ProteinG { get; set; }
    public decimal? SodiumMg { get; set; }
}

using System.Text.RegularExpressions;
using NutriLens.Api.Models;

namespace NutriLens.Api.Services;

public class FoodAssessmentService
{
    public static readonly string[] PackagedFoodCategories =
    {
        "Packaged Snacks",
        "Biscuits & Cookies",
        "Chocolates & Confectionery",
        "Beverages & Juices",
        "Instant Foods & Noodles",
        "Cereals & Breakfast",
        "Dairy Products",
        "Packaged Indian Foods",
        "Protein Bars & Nutrition",
        "Other Packaged Foods",
    };

    // FSSAI / ICMR-NIN / WHO 2,000 kcal adult daily reference values
    private static readonly Dictionary<string, decimal> DailyValues = new()
    {
        ["calories"] = 2000m,
        ["total_fat"] = 67m,
        ["saturated_fat"] = 20m,
        ["trans_fat"] = 2m,
        ["total_carbohydrate"] = 300m,
        ["dietary_fiber"] = 25m,
        ["total_sugars"] = 50m,
        ["added_sugars"] = 25m,
        ["protein"] = 54m,
        ["sodium"] = 2000m,
    };

    private static readonly string[] Nova4Markers =
    {
        "maltodextrin", "high fructose corn syrup", "liquid glucose", "glucose syrup",
        "invert sugar", "dextrose", "modified starch", "hydrogenated", "interesterified",
        "soy protein isolate", "hydrolyzed vegetable protein", "nature identical",
        "artificial flavour", "artificial flavor", "flavour enhancer", "flavor enhancer",
        "emulsifier", "stabilizer", "stabiliser", "thickener", "anticaking",
        "sucralose", "aspartame", "acesulfame", "tbhq", "319", "320", "321",
        "471", "472", "476", "621", "627", "631", "635", "950", "951", "955",
        "102", "110", "122", "124", "129", "133", "150c", "150d", "415", "466", "407"
    };

    private static readonly string[] Nova3Markers =
    {
        "salt", "sugar", "palmolein", "palm oil", "sunflower oil", "vegetable oil",
        "butter", "ghee", "citric acid", "vinegar", "preservative", "202", "211"
    };

    private readonly IngredientDecoderService _ingredientDecoder;

    public FoodAssessmentService(IngredientDecoderService ingredientDecoder)
    {
        _ingredientDecoder = ingredientDecoder;
    }

    public AssessmentResultDto AssessProduct(Product p)
    {
        var per100g = new NutritionInputDto
        {
            Calories = p.CaloriesPer100g,
            ProteinG = p.ProteinPer100g,
            CarbsG = p.CarbsPer100g,
            SugarG = p.SugarPer100g,
            AddedSugarG = p.AddedSugarPer100g,
            FatG = p.FatPer100g,
            SaturatedFatG = p.SaturatedFatPer100g,
            TransFatG = p.TransFatPer100g,
            FiberG = p.FiberPer100g,
            SodiumMg = p.SodiumMgPer100g
        };

        var perServing = new NutritionInputDto
        {
            Calories = p.Calories,
            ProteinG = p.ProteinG,
            CarbsG = p.CarbsG,
            SugarG = p.SugarG,
            AddedSugarG = p.AddedSugarG,
            FatG = p.FatG,
            SaturatedFatG = p.SaturatedFatG,
            TransFatG = p.TransFatG,
            FiberG = p.FiberG,
            SodiumMg = p.SodiumMg
        };

        return Assess(p.Category, p.ServingSizeG, per100g, perServing, p.Ingredients, p.Allergens, p.NovaGroup);
    }

    public AssessmentResultDto Assess(
        string? category,
        decimal? servingSizeG,
        NutritionInputDto? per100gInput,
        NutritionInputDto? perServingInput,
        string? ingredientsText,
        string? explicitAllergens = null,
        int? knownNovaGroup = null)
    {
        var per100g = per100gInput ?? new NutritionInputDto();
        var perServing = perServingInput ?? new NutritionInputDto();

        bool has100gAny = HasAnyValue(per100g);
        bool hasServingAny = HasAnyValue(perServing);

        bool isPerServingCalculated = false;
        bool isPer100gCalculated = false;

        // Transparently derive per-serving from per-100g (or vice versa) ONLY when servingSizeG > 0
        if (servingSizeG.HasValue && servingSizeG.Value > 0)
        {
            var ratio = servingSizeG.Value / 100m;
            if (has100gAny && !hasServingAny)
            {
                perServing = Scale(per100g, ratio);
                isPerServingCalculated = true;
            }
            else if (hasServingAny && !has100gAny)
            {
                per100g = Scale(perServing, 100m / servingSizeG.Value);
                isPer100gCalculated = true;
            }
        }

        var decoded = _ingredientDecoder.Decode(ingredientsText, explicitAllergens);
        var nova = ClassifyNova(ingredientsText, decoded, knownNovaGroup);

        bool isBeverage = string.Equals(category, "Beverages & Juices", StringComparison.OrdinalIgnoreCase);

        // Build standardized nutrient metric rows
        var nutrients = BuildNutrientMetrics(per100g, perServing, isBeverage);

        // Determine evaluation basis (prefer per_100g for standardized comparison, fall back to per_serving)
        string basis = HasAnyValue(per100g) ? "per_100g" : (HasAnyValue(perServing) ? "per_serving" : "unavailable");

        var evalCalories = basis == "per_100g" ? per100g.Calories : perServing.Calories;
        var evalSugar = basis == "per_100g" ? (per100g.AddedSugarG ?? per100g.SugarG) : (perServing.AddedSugarG ?? perServing.SugarG);
        var evalSatFat = basis == "per_100g" ? per100g.SaturatedFatG : perServing.SaturatedFatG;
        var evalSodium = basis == "per_100g" ? per100g.SodiumMg : perServing.SodiumMg;
        var evalTransFat = basis == "per_100g" ? per100g.TransFatG : perServing.TransFatG;
        var evalFiber = basis == "per_100g" ? per100g.FiberG : perServing.FiberG;
        var evalProtein = basis == "per_100g" ? per100g.ProteinG : perServing.ProteinG;

        var missing = new List<string>();
        if (!evalCalories.HasValue) missing.Add("Calories / Energy");
        if (!evalSugar.HasValue) missing.Add("Sugars");
        if (!evalSatFat.HasValue) missing.Add("Saturated Fat");
        if (!evalSodium.HasValue) missing.Add("Sodium");
        if (!evalProtein.HasValue) missing.Add("Protein");
        if (!evalFiber.HasValue) missing.Add("Dietary Fiber");

        var corePresent = new[] { evalCalories, evalSugar, evalSatFat, evalSodium }.Count(v => v.HasValue);

        var result = new AssessmentResultDto
        {
            EvaluationBasis = basis,
            IsPerServingCalculated = isPerServingCalculated,
            IsPer100gCalculated = isPer100gCalculated,
            MissingNutrients = missing,
            DataCompleteness = corePresent == 4 ? "Complete" : (corePresent >= 2 ? "Partial" : "Insufficient"),
            Nova = nova,
            Nutrients = nutrients,
            IngredientsDecoded = decoded,
        };

        // High-nutrient alerts & positive/negative factors
        PopulateFactorsAndAlerts(result, per100g, perServing, isBeverage, decoded, nova);

        if (corePresent < 2)
        {
            result.ScoreAvailable = false;
            result.HealthScore = null;
            result.Grade = "N/A";
            result.Verdict = "Incomplete Data";
            result.VerdictSummary = "At least two core nutrients (calories, sugars, saturated fat, sodium) are required to compute a transparent score. Missing values are never assumed to be zero.";
            return result;
        }

        // Transparent deterministic scoring (start at 75 baseline for packaged food, adjust by evidence-based thresholds)
        int score = 78;
        var breakdown = new List<ScoreBreakdownItemDto>
        {
            new() { Rule = "Packaged food baseline", Detail = "Starting reference prior to nutrient & processing adjustments", PointsDelta = 78, Sentiment = "neutral" }
        };

        if (basis == "per_100g")
        {
            // Sugar penalty (per 100g / 100ml)
            if (evalSugar.HasValue)
            {
                decimal highCut = isBeverage ? 10m : 15m;
                decimal modCut = isBeverage ? 5m : 5m;
                if (evalSugar > highCut * 1.6m)
                {
                    score -= 24;
                    breakdown.Add(new() { Rule = "Very High Sugar", Detail = $"{evalSugar:0.#} g per 100{(isBeverage ? "ml" : "g")} exceeds {highCut * 1.6m:0.#} g", PointsDelta = -24, Sentiment = "negative" });
                }
                else if (evalSugar > highCut)
                {
                    score -= 16;
                    breakdown.Add(new() { Rule = "High Sugar (FSSAI HFSS watch)", Detail = $"{evalSugar:0.#} g exceeds {highCut:0.#} g / 100{(isBeverage ? "ml" : "g")}", PointsDelta = -16, Sentiment = "negative" });
                }
                else if (evalSugar > modCut)
                {
                    score -= 7;
                    breakdown.Add(new() { Rule = "Moderate Sugar", Detail = $"{evalSugar:0.#} g between {modCut:0.#}–{highCut:0.#} g", PointsDelta = -7, Sentiment = "negative" });
                }
                else
                {
                    score += 4;
                    breakdown.Add(new() { Rule = "Low Sugar", Detail = $"{evalSugar:0.#} g per 100{(isBeverage ? "ml" : "g")}", PointsDelta = 4, Sentiment = "positive" });
                }
            }

            // Sodium penalty (per 100g)
            if (evalSodium.HasValue)
            {
                decimal highNa = isBeverage ? 300m : 600m;
                if (evalSodium > 900m)
                {
                    score -= 22;
                    breakdown.Add(new() { Rule = "Very High Sodium", Detail = $"{evalSodium:0.#} mg / 100g (> 900 mg)", PointsDelta = -22, Sentiment = "negative" });
                }
                else if (evalSodium > highNa)
                {
                    score -= 14;
                    breakdown.Add(new() { Rule = "High Sodium", Detail = $"{evalSodium:0.#} mg / 100g (> {highNa:0.#} mg)", PointsDelta = -14, Sentiment = "negative" });
                }
                else if (evalSodium > 250m)
                {
                    score -= 6;
                    breakdown.Add(new() { Rule = "Moderate Sodium", Detail = $"{evalSodium:0.#} mg / 100g", PointsDelta = -6, Sentiment = "negative" });
                }
                else
                {
                    score += 3;
                    breakdown.Add(new() { Rule = "Low Sodium", Detail = $"{evalSodium:0.#} mg / 100g (≤ 250 mg)", PointsDelta = 3, Sentiment = "positive" });
                }
            }

            // Saturated fat penalty (per 100g)
            if (evalSatFat.HasValue)
            {
                decimal highSat = isBeverage ? 2.5m : 5m;
                if (evalSatFat > 10m)
                {
                    score -= 20;
                    breakdown.Add(new() { Rule = "Very High Saturated Fat", Detail = $"{evalSatFat:0.#} g / 100g (> 10 g)", PointsDelta = -20, Sentiment = "negative" });
                }
                else if (evalSatFat > highSat)
                {
                    score -= 12;
                    breakdown.Add(new() { Rule = "High Saturated Fat", Detail = $"{evalSatFat:0.#} g / 100g (> {highSat:0.#} g)", PointsDelta = -12, Sentiment = "negative" });
                }
                else if (evalSatFat > 1.5m)
                {
                    score -= 4;
                    breakdown.Add(new() { Rule = "Moderate Saturated Fat", Detail = $"{evalSatFat:0.#} g / 100g", PointsDelta = -4, Sentiment = "negative" });
                }
                else
                {
                    score += 3;
                    breakdown.Add(new() { Rule = "Low Saturated Fat", Detail = $"{evalSatFat:0.#} g / 100g (≤ 1.5 g)", PointsDelta = 3, Sentiment = "positive" });
                }
            }

            // Trans fat penalty
            if (evalTransFat.HasValue && evalTransFat > 0.2m)
            {
                score -= 15;
                breakdown.Add(new() { Rule = "Trans Fat Present", Detail = $"{evalTransFat:0.##} g / 100g (> 0.2 g limit)", PointsDelta = -15, Sentiment = "negative" });
            }

            // Protein & Fiber positives
            if (evalFiber.HasValue && evalFiber >= 6m)
            {
                score += 10;
                breakdown.Add(new() { Rule = "High Dietary Fiber", Detail = $"{evalFiber:0.#} g / 100g (≥ 6 g)", PointsDelta = 10, Sentiment = "positive" });
            }
            else if (evalFiber.HasValue && evalFiber >= 3m)
            {
                score += 5;
                breakdown.Add(new() { Rule = "Source of Fiber", Detail = $"{evalFiber:0.#} g / 100g (≥ 3 g)", PointsDelta = 5, Sentiment = "positive" });
            }

            if (evalProtein.HasValue && evalProtein >= 12m)
            {
                score += 10;
                breakdown.Add(new() { Rule = "High Protein", Detail = $"{evalProtein:0.#} g / 100g (≥ 12 g)", PointsDelta = 10, Sentiment = "positive" });
            }
            else if (evalProtein.HasValue && evalProtein >= 6m)
            {
                score += 5;
                breakdown.Add(new() { Rule = "Good Protein", Detail = $"{evalProtein:0.#} g / 100g (≥ 6 g)", PointsDelta = 5, Sentiment = "positive" });
            }
        }
        else
        {
            // Per-serving scoring when only per-serving is available
            if (evalSugar.HasValue)
            {
                if (evalSugar > 12m) { score -= 18; breakdown.Add(new() { Rule = "High Sugar per serving", Detail = $"{evalSugar:0.#} g / serving", PointsDelta = -18, Sentiment = "negative" }); }
                else if (evalSugar > 5m) { score -= 8; breakdown.Add(new() { Rule = "Moderate Sugar per serving", Detail = $"{evalSugar:0.#} g / serving", PointsDelta = -8, Sentiment = "negative" }); }
                else { score += 4; breakdown.Add(new() { Rule = "Low Sugar per serving", Detail = $"{evalSugar:0.#} g / serving", PointsDelta = 4, Sentiment = "positive" }); }
            }
            if (evalSodium.HasValue)
            {
                if (evalSodium > 400m) { score -= 18; breakdown.Add(new() { Rule = "High Sodium per serving", Detail = $"{evalSodium:0.#} mg / serving", PointsDelta = -18, Sentiment = "negative" }); }
                else if (evalSodium > 140m) { score -= 8; breakdown.Add(new() { Rule = "Moderate Sodium per serving", Detail = $"{evalSodium:0.#} mg / serving", PointsDelta = -8, Sentiment = "negative" }); }
                else { score += 3; breakdown.Add(new() { Rule = "Low Sodium per serving", Detail = $"{evalSodium:0.#} mg / serving", PointsDelta = 3, Sentiment = "positive" }); }
            }
            if (evalSatFat.HasValue)
            {
                if (evalSatFat > 4m) { score -= 16; breakdown.Add(new() { Rule = "High Saturated Fat per serving", Detail = $"{evalSatFat:0.#} g / serving", PointsDelta = -16, Sentiment = "negative" }); }
                else if (evalSatFat > 1.5m) { score -= 6; breakdown.Add(new() { Rule = "Moderate Saturated Fat per serving", Detail = $"{evalSatFat:0.#} g / serving", PointsDelta = -6, Sentiment = "negative" }); }
                else { score += 3; breakdown.Add(new() { Rule = "Low Saturated Fat per serving", Detail = $"{evalSatFat:0.#} g / serving", PointsDelta = 3, Sentiment = "positive" }); }
            }
            if (evalFiber.HasValue && evalFiber >= 3m) { score += 6; breakdown.Add(new() { Rule = "Good Fiber per serving", Detail = $"{evalFiber:0.#} g / serving", PointsDelta = 6, Sentiment = "positive" }); }
            if (evalProtein.HasValue && evalProtein >= 5m) { score += 6; breakdown.Add(new() { Rule = "Good Protein per serving", Detail = $"{evalProtein:0.#} g / serving", PointsDelta = 6, Sentiment = "positive" }); }
        }

        // Processing & additive adjustments
        if (nova.Group == 4)
        {
            score -= 14;
            breakdown.Add(new() { Rule = "NOVA 4 (Ultra-Processed)", Detail = "Contains industrial formulation or cosmetic additives", PointsDelta = -14, Sentiment = "negative" });
        }
        else if (nova.Group == 1)
        {
            score += 8;
            breakdown.Add(new() { Rule = "NOVA 1 (Minimally Processed)", Detail = "Whole or minimally processed ingredients", PointsDelta = 8, Sentiment = "positive" });
        }

        if (decoded.ArtificialColourCount > 0)
        {
            score -= 6;
            breakdown.Add(new() { Rule = "Artificial Colourants", Detail = $"{decoded.ArtificialColourCount} synthetic colour(s) detected", PointsDelta = -6, Sentiment = "negative" });
        }
        if (decoded.PreservativeCount > 0)
        {
            score -= 4;
            breakdown.Add(new() { Rule = "Added Preservatives", Detail = $"{decoded.PreservativeCount} preservative(s) detected", PointsDelta = -4, Sentiment = "negative" });
        }

        int finalScore = Math.Clamp(score, 0, 100);
        result.ScoreAvailable = true;
        result.HealthScore = finalScore;
        result.ScoreBreakdown = breakdown;

        if (finalScore >= 78)
        {
            result.Grade = "A";
            result.Verdict = "Clean Choice";
            result.VerdictSummary = "Balanced nutrient profile with low critical negative nutrients and minimal industrial processing.";
        }
        else if (finalScore >= 58)
        {
            result.Grade = "B";
            result.Verdict = "Moderate / Everyday";
            result.VerdictSummary = "Reasonable packaged option; watch portion sizes and compare sugar or sodium against peers.";
        }
        else if (finalScore >= 38)
        {
            result.Grade = "C";
            result.Verdict = "Limit Intake";
            result.VerdictSummary = "Elevated levels of sugar, sodium, saturated fat, or ultra-processed additives. Best enjoyed occasionally.";
        }
        else
        {
            result.Grade = "D";
            result.Verdict = "Ultra-Processed / High Concern";
            result.VerdictSummary = "Multiple high-concern nutrient thresholds and/or ultra-processed ingredients. Consider cleaner alternatives.";
        }

        return result;
    }

    private static NovaAssessmentDto ClassifyNova(string? ingredientsText, IngredientSummaryDto decoded, int? knownNovaGroup)
    {
        if (string.IsNullOrWhiteSpace(ingredientsText))
        {
            if (knownNovaGroup is >= 1 and <= 4)
            {
                return new NovaAssessmentDto
                {
                    Group = knownNovaGroup,
                    Label = NovaLabel(knownNovaGroup.Value),
                    Description = "NOVA classification sourced from Open Food Facts product metadata (full ingredient breakdown unavailable).",
                    Triggers = new List<string> { "Open Food Facts NOVA metadata" }
                };
            }
            return new NovaAssessmentDto
            {
                Group = null,
                Label = "Insufficient Ingredient Data",
                Description = "Ingredient list is required to classify food processing depth under NOVA.",
                Triggers = new List<string>()
            };
        }

        var lower = ingredientsText.ToLowerInvariant();
        var triggers = new List<string>();

        foreach (var marker in Nova4Markers)
        {
            if (Regex.IsMatch(lower, $@"\b{Regex.Escape(marker)}\b"))
                triggers.Add(marker);
        }

        if (decoded.ArtificialColourCount > 0) triggers.Add("artificial food colour");
        if (decoded.SweetenerCount > 0 && decoded.Items.Any(i => i.IsSweetener && i.Category.Contains("Artificial")))
            triggers.Add("high-intensity sweetener");

        if (triggers.Count > 0 || decoded.AdditiveCount >= 2)
        {
            return new NovaAssessmentDto
            {
                Group = 4,
                Label = NovaLabel(4),
                Description = "Contains industrial formulations, cosmetic additives (emulsifiers, flavour enhancers, synthetic colours, or refined syrups) not used in home cooking.",
                Triggers = triggers.Distinct().Take(6).ToList()
            };
        }

        var procTriggers = Nova3Markers.Where(m => Regex.IsMatch(lower, $@"\b{Regex.Escape(m)}\b")).ToList();
        if (procTriggers.Count > 0 || decoded.PreservativeCount > 0 || decoded.Items.Count >= 3)
        {
            return new NovaAssessmentDto
            {
                Group = 3,
                Label = NovaLabel(3),
                Description = "Processed packaged food combining whole ingredients with culinary salt, sugar, oil, or simple preservation.",
                Triggers = procTriggers.Distinct().Take(5).ToList()
            };
        }

        if (decoded.Items.Count <= 2 && decoded.Items.All(i => i.Category.Contains("Oil") || i.Category.Contains("Sugar") || i.RawName.Contains("Butter", StringComparison.OrdinalIgnoreCase)))
        {
            return new NovaAssessmentDto
            {
                Group = 2,
                Label = NovaLabel(2),
                Description = "Processed culinary ingredient (butter, oil, salt, or sugar) used for cooking and seasoning.",
                Triggers = new List<string> { "Single culinary ingredient" }
            };
        }

        return new NovaAssessmentDto
        {
            Group = 1,
            Label = NovaLabel(1),
            Description = "Unprocessed or minimally processed whole food without added salt, sugar, oils, or industrial additives.",
            Triggers = new List<string> { "Minimal single/whole-food ingredients" }
        };
    }

    private static string NovaLabel(int group) => group switch
    {
        1 => "NOVA 1 — Minimally Processed",
        2 => "NOVA 2 — Culinary Ingredient",
        3 => "NOVA 3 — Processed Food",
        4 => "NOVA 4 — Ultra-Processed Food",
        _ => "Unclassified"
    };

    private static void PopulateFactorsAndAlerts(
        AssessmentResultDto result,
        NutritionInputDto per100g,
        NutritionInputDto perServing,
        bool isBeverage,
        IngredientSummaryDto decoded,
        NovaAssessmentDto nova)
    {
        var sug = per100g.AddedSugarG ?? per100g.SugarG;
        if (sug.HasValue)
        {
            var limit = isBeverage ? 10m : 15m;
            if (sug > limit)
            {
                result.HighNutrientAlerts.Add($"High Sugar ({sug:0.#} g / 100{(isBeverage ? "ml" : "g")})");
                result.NegativeFactors.Add($"High sugar content at {sug:0.#} g per 100{(isBeverage ? "ml" : "g")} (FSSAI/traffic-light threshold > {limit} g).");
            }
            else if (sug <= 5m)
            {
                result.PositiveFactors.Add($"Low sugar ({sug:0.#} g / 100{(isBeverage ? "ml" : "g")}).");
            }
        }
        else if (perServing.SugarG > 10m)
        {
            result.HighNutrientAlerts.Add($"High Sugar ({perServing.SugarG:0.#} g / serving)");
            result.NegativeFactors.Add($"High sugar per serving ({perServing.SugarG:0.#} g).");
        }

        if (per100g.SodiumMg.HasValue)
        {
            var limit = isBeverage ? 300m : 600m;
            if (per100g.SodiumMg > limit)
            {
                result.HighNutrientAlerts.Add($"High Sodium ({per100g.SodiumMg:0.#} mg / 100g)");
                result.NegativeFactors.Add($"High sodium at {per100g.SodiumMg:0.#} mg per 100g ({per100g.SodiumMg / 2000m * 100m:0.#}% of 2,000 mg daily limit).");
            }
            else if (per100g.SodiumMg <= 120m)
            {
                result.PositiveFactors.Add($"Low sodium ({per100g.SodiumMg:0.#} mg / 100g).");
            }
        }
        else if (perServing.SodiumMg > 400m)
        {
            result.HighNutrientAlerts.Add($"High Sodium ({perServing.SodiumMg:0.#} mg / serving)");
            result.NegativeFactors.Add($"High sodium per serving ({perServing.SodiumMg:0.#} mg).");
        }

        if (per100g.SaturatedFatG.HasValue)
        {
            var limit = isBeverage ? 2.5m : 5m;
            if (per100g.SaturatedFatG > limit)
            {
                result.HighNutrientAlerts.Add($"High Saturated Fat ({per100g.SaturatedFatG:0.#} g / 100g)");
                result.NegativeFactors.Add($"High saturated fat at {per100g.SaturatedFatG:0.#} g per 100g (threshold > {limit} g).");
            }
            else if (per100g.SaturatedFatG <= 1.5m)
            {
                result.PositiveFactors.Add($"Low saturated fat ({per100g.SaturatedFatG:0.#} g / 100g).");
            }
        }

        if (per100g.TransFatG > 0.2m || perServing.TransFatG > 0.2m)
        {
            result.HighNutrientAlerts.Add("Contains Trans Fat");
            result.NegativeFactors.Add("Measurable trans fat detected; WHO advises keeping trans fats under 1% of energy.");
        }

        if (per100g.FiberG >= 3m || perServing.FiberG >= 3m)
        {
            var val = per100g.FiberG ?? perServing.FiberG;
            var unitBasis = per100g.FiberG.HasValue ? "100g" : "serving";
            result.PositiveFactors.Add($"Good source of dietary fiber ({val:0.#} g / {unitBasis}).");
        }

        if (per100g.ProteinG >= 8m || perServing.ProteinG >= 5m)
        {
            var val = per100g.ProteinG ?? perServing.ProteinG;
            var unitBasis = per100g.ProteinG.HasValue ? "100g" : "serving";
            result.PositiveFactors.Add($"Meaningful protein contribution ({val:0.#} g / {unitBasis}).");
        }

        if (nova.Group == 4)
        {
            result.NegativeFactors.Add($"Classified as NOVA 4 (Ultra-Processed) due to: {string.Join(", ", nova.Triggers.Take(4))}.");
        }
        else if (nova.Group == 1)
        {
            result.PositiveFactors.Add("Minimally processed (NOVA 1) with clean whole-food ingredients.");
        }
    }

    private static List<NutrientMetricDto> BuildNutrientMetrics(NutritionInputDto p100, NutritionInputDto pSrv, bool isBeverage)
    {
        return new List<NutrientMetricDto>
        {
            MakeMetric("calories", "Energy / Calories", "kcal", p100.Calories, pSrv.Calories, DailyValues["calories"], null, null, false),
            MakeMetric("protein", "Protein", "g", p100.ProteinG, pSrv.ProteinG, DailyValues["protein"], null, null, true),
            MakeMetric("total_carbohydrate", "Carbohydrates", "g", p100.CarbsG, pSrv.CarbsG, DailyValues["total_carbohydrate"], null, null, false),
            MakeMetric("total_sugars", "Total Sugars", "g", p100.SugarG, pSrv.SugarG, DailyValues["total_sugars"], isBeverage ? 5m : 5m, isBeverage ? 10m : 15m, false),
            MakeMetric("added_sugars", "Added Sugars", "g", p100.AddedSugarG, pSrv.AddedSugarG, DailyValues["added_sugars"], 2.5m, 10m, false),
            MakeMetric("dietary_fiber", "Dietary Fiber", "g", p100.FiberG, pSrv.FiberG, DailyValues["dietary_fiber"], null, null, true),
            MakeMetric("total_fat", "Total Fat", "g", p100.FatG, pSrv.FatG, DailyValues["total_fat"], 3m, 17.5m, false),
            MakeMetric("saturated_fat", "Saturated Fat", "g", p100.SaturatedFatG, pSrv.SaturatedFatG, DailyValues["saturated_fat"], 1.5m, isBeverage ? 2.5m : 5m, false),
            MakeMetric("trans_fat", "Trans Fat", "g", p100.TransFatG, pSrv.TransFatG, DailyValues["trans_fat"], 0.1m, 0.2m, false),
            MakeMetric("sodium", "Sodium", "mg", p100.SodiumMg, pSrv.SodiumMg, DailyValues["sodium"], 120m, isBeverage ? 300m : 600m, false),
        };
    }

    private static NutrientMetricDto MakeMetric(
        string key, string label, string unit,
        decimal? per100g, decimal? perServing, decimal dailyValue,
        decimal? lowMax, decimal? highMin, bool higherIsBetter)
    {
        string level = "unavailable";
        string? flag = null;
        var reference = per100g;

        if (per100g.HasValue || perServing.HasValue)
        {
            if (reference.HasValue && highMin.HasValue && lowMax.HasValue)
            {
                if (reference > highMin) { level = "high"; flag = $"High (> {highMin:0.#} {unit}/100g)"; }
                else if (reference > lowMax) { level = "moderate"; flag = "Moderate"; }
                else { level = "low"; flag = "Low"; }
            }
            else if (higherIsBetter && reference.HasValue)
            {
                if ((key == "protein" && reference >= 10m) || (key == "dietary_fiber" && reference >= 6m))
                {
                    level = "positive";
                    flag = "High source";
                }
                else
                {
                    level = "neutral";
                }
            }
            else
            {
                level = "neutral";
            }
        }

        return new NutrientMetricDto
        {
            Key = key,
            Label = label,
            Unit = unit,
            Per100g = per100g.HasValue ? Math.Round(per100g.Value, 2) : null,
            PerServing = perServing.HasValue ? Math.Round(perServing.Value, 2) : null,
            DailyValue = dailyValue,
            DailyValuePercentPer100g = per100g.HasValue && dailyValue > 0 ? Math.Round(per100g.Value / dailyValue * 100m, 1) : null,
            DailyValuePercentPerServing = perServing.HasValue && dailyValue > 0 ? Math.Round(perServing.Value / dailyValue * 100m, 1) : null,
            Level = level,
            FlagMessage = flag
        };
    }

    private static bool HasAnyValue(NutritionInputDto n) =>
        n.Calories.HasValue || n.ProteinG.HasValue || n.CarbsG.HasValue || n.SugarG.HasValue ||
        n.AddedSugarG.HasValue || n.FatG.HasValue || n.SaturatedFatG.HasValue ||
        n.TransFatG.HasValue || n.FiberG.HasValue || n.SodiumMg.HasValue;

    private static NutritionInputDto Scale(NutritionInputDto n, decimal factor) => new()
    {
        Calories = n.Calories.HasValue ? Math.Round(n.Calories.Value * factor, 2) : null,
        ProteinG = n.ProteinG.HasValue ? Math.Round(n.ProteinG.Value * factor, 2) : null,
        CarbsG = n.CarbsG.HasValue ? Math.Round(n.CarbsG.Value * factor, 2) : null,
        SugarG = n.SugarG.HasValue ? Math.Round(n.SugarG.Value * factor, 2) : null,
        AddedSugarG = n.AddedSugarG.HasValue ? Math.Round(n.AddedSugarG.Value * factor, 2) : null,
        FatG = n.FatG.HasValue ? Math.Round(n.FatG.Value * factor, 2) : null,
        SaturatedFatG = n.SaturatedFatG.HasValue ? Math.Round(n.SaturatedFatG.Value * factor, 2) : null,
        TransFatG = n.TransFatG.HasValue ? Math.Round(n.TransFatG.Value * factor, 2) : null,
        FiberG = n.FiberG.HasValue ? Math.Round(n.FiberG.Value * factor, 2) : null,
        SodiumMg = n.SodiumMg.HasValue ? Math.Round(n.SodiumMg.Value * factor, 2) : null,
    };
}

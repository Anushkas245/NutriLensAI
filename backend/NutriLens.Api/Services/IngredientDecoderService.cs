using System.Text.RegularExpressions;
using NutriLens.Api.Models;

namespace NutriLens.Api.Services;

public class IngredientDecoderService
{
    private sealed record IngredientRule(
        string[] Keywords,
        string Category,
        string Purpose,
        string Explanation,
        string ConcernLevel,
        bool IsAdditive = false,
        bool IsPreservative = false,
        bool IsSweetener = false,
        bool IsArtificialColour = false,
        string[]? Allergens = null);

    private static readonly Dictionary<string, (string Name, string Category, string Purpose, string Explanation, string Concern, bool Preservative, bool Sweetener, bool Colour)> InsDictionary = new(StringComparer.OrdinalIgnoreCase)
    {
        ["100"] = ("Curcumin / Turmeric Extract", "Natural Colour", "Natural yellow-orange colouring", "Plant-derived yellow pigment from turmeric.", "low", false, false, false),
        ["102"] = ("Tartrazine (INS 102)", "Artificial Colour", "Synthetic yellow food dye", "Synthetic azo dye linked with sensitivity in some individuals.", "watch", false, false, true),
        ["110"] = ("Sunset Yellow FCF (INS 110)", "Artificial Colour", "Synthetic orange-yellow food dye", "Synthetic coal-tar/petrochemical food dye used for bright orange colour.", "watch", false, false, true),
        ["122"] = ("Carmoisine (INS 122)", "Artificial Colour", "Synthetic red food dye", "Synthetic azo red colourant.", "watch", false, false, true),
        ["124"] = ("Ponceau 4R (INS 124)", "Artificial Colour", "Synthetic red food dye", "Synthetic red food colouring.", "watch", false, false, true),
        ["129"] = ("Allura Red AC (INS 129)", "Artificial Colour", "Synthetic red food dye", "Synthetic red dye used in confectionery and drinks.", "watch", false, false, true),
        ["133"] = ("Brilliant Blue FCF (INS 133)", "Artificial Colour", "Synthetic blue food dye", "Synthetic blue food colouring.", "watch", false, false, true),
        ["150a"] = ("Plain Caramel Colour (INS 150a)", "Colour", "Brown colouring", "Heated sugar caramel used for brown colour.", "low", false, false, false),
        ["150c"] = ("Ammonia Caramel (INS 150c)", "Artificial Colour", "Dark brown colouring", "Processed caramel colourant made with ammonia compounds.", "moderate", false, false, true),
        ["150d"] = ("Sulphite Ammonia Caramel (INS 150d)", "Artificial Colour", "Dark brown colouring in colas & sauces", "Industrial caramel colouring produced using sulphite and ammonia compounds.", "watch", false, false, true),
        ["160a"] = ("Beta-Carotene (INS 160a)", "Natural Colour", "Orange-yellow pigment / Vitamin A precursor", "Carotenoid pigment also found in carrots.", "low", false, false, false),
        ["170"] = ("Calcium Carbonate (INS 170)", "Additive / Mineral", "Firming agent, anticaking agent, or calcium source", "Mineral calcium salt commonly used in baked goods and fortified foods.", "low", false, false, false),
        ["200"] = ("Sorbic Acid (INS 200)", "Preservative", "Antifungal preservative", "Prevents mould and yeast growth to extend shelf life.", "moderate", true, false, false),
        ["202"] = ("Potassium Sorbate (INS 202)", "Preservative", "Mould & yeast inhibitor", "Common mild food preservative used in sauces, dairy, and baked snacks.", "moderate", true, false, false),
        ["211"] = ("Sodium Benzoate (INS 211)", "Preservative", "Antimicrobial preservative in acidic foods", "Common preservative in juices, pickles, and soft drinks; best kept moderate.", "watch", true, false, false),
        ["220"] = ("Sulphur Dioxide (INS 220)", "Preservative", "Antioxidant & preservative", "Sulphite preservative that can trigger reactions in sulphite-sensitive individuals.", "watch", true, false, false),
        ["223"] = ("Sodium Metabisulphite (INS 223)", "Preservative", "Dough conditioner & preservative", "Sulphite compound used in biscuits, dried fruit, and snacks.", "watch", true, false, false),
        ["250"] = ("Sodium Nitrite (INS 250)", "Preservative", "Curing preservative", "Used in cured meats to prevent bacterial growth.", "watch", true, false, false),
        ["260"] = ("Acetic Acid (INS 260)", "Acidity Regulator", "Vinegar acid / preservative", "Primary acid in vinegar; adjusts tanginess and shelf stability.", "low", false, false, false),
        ["270"] = ("Lactic Acid (INS 270)", "Acidity Regulator", "Natural fermentation acid", "Controls acidity and adds mild tartness.", "low", false, false, false),
        ["282"] = ("Calcium Propionate (INS 282)", "Preservative", "Anti-mould preservative in bread & bakery", "Extends bakery shelf life by inhibiting mould.", "moderate", true, false, false),
        ["296"] = ("Malic Acid (INS 296)", "Acidity Regulator", "Tart fruit acid", "Provides sour/apple-like tartness and balances flavour.", "low", false, false, false),
        ["300"] = ("Ascorbic Acid / Vitamin C (INS 300)", "Antioxidant", "Prevents oxidation & browning", "Vitamin C used as a clean antioxidant to keep food fresh.", "low", false, false, false),
        ["306"] = ("Tocopherols / Vitamin E (INS 306)", "Antioxidant", "Prevents oil rancidity", "Natural Vitamin E antioxidant that protects fats from spoiling.", "low", false, false, false),
        ["319"] = ("TBHQ (INS 319)", "Preservative / Antioxidant", "Synthetic antioxidant in fried snacks & oils", "Tertiary butylhydroquinone — synthetic petroleum-derived antioxidant used to keep oils shelf-stable.", "watch", true, false, false),
        ["320"] = ("BHA (INS 320)", "Preservative / Antioxidant", "Synthetic fat preservative", "Butylated hydroxyanisole — synthetic antioxidant to delay rancidity.", "watch", true, false, false),
        ["321"] = ("BHT (INS 321)", "Preservative / Antioxidant", "Synthetic fat preservative", "Butylated hydroxytoluene — synthetic antioxidant in processed oils.", "watch", true, false, false),
        ["322"] = ("Lecithin (INS 322)", "Additive / Emulsifier", "Blends oil and water smoothly", "Usually derived from soy or sunflower; keeps chocolate and biscuits uniform.", "low", false, false, false),
        ["330"] = ("Citric Acid (INS 330)", "Acidity Regulator", "Adds tartness and preserves freshness", "Common fruit-derived or fermented acid used for tangy taste and pH control.", "low", false, false, false),
        ["331"] = ("Sodium Citrate (INS 331)", "Acidity Regulator", "pH buffer and emulsifier", "Salt of citric acid used to control acidity in drinks and cheese.", "low", false, false, false),
        ["338"] = ("Phosphoric Acid (INS 338)", "Acidity Regulator", "Sharp acidifier in colas", "Adds sharp tang in dark carbonated soft drinks; high intake is discouraged.", "watch", false, false, false),
        ["407"] = ("Carrageenan (INS 407)", "Additive / Thickener", "Thickens and stabilizes dairy & drinks", "Seaweed-derived thickener used in flavoured milk and desserts.", "moderate", false, false, false),
        ["412"] = ("Guar Gum (INS 412)", "Additive / Thickener", "Plant-based thickener & stabilizer", "Soluble fiber from guar beans used to improve texture.", "low", false, false, false),
        ["415"] = ("Xanthan Gum (INS 415)", "Additive / Thickener", "Thickener & suspension stabilizer", "Fermented polysaccharide thickener common in sauces and gluten-free foods.", "low", false, false, false),
        ["440"] = ("Pectin (INS 440)", "Additive / Gelling Agent", "Plant fiber gelling agent", "Natural fruit fiber used to set jams and fruit drinks.", "low", false, false, false),
        ["451"] = ("Triphosphates (INS 451)", "Additive / Stabilizer", "Moisture retention & texture stabilizer", "Phosphate salt commonly used in instant noodles and processed foods.", "moderate", false, false, false),
        ["466"] = ("Carboxymethyl Cellulose / CMC (INS 466)", "Additive / Thickener", "Synthetic cellulose thickener", "Modified cellulose gum used to thicken ice creams, drinks, and sauces.", "moderate", false, false, false),
        ["471"] = ("Mono- and Diglycerides of Fatty Acids (INS 471)", "Additive / Emulsifier", "Industrial dough & fat emulsifier", "Keeps baked goods soft and prevents oil separation; marker of ultra-processed food.", "moderate", false, false, false),
        ["472e"] = ("DATEM (INS 472e)", "Additive / Emulsifier", "Dough strengthener", "Industrial emulsifier used in packaged breads and biscuits.", "moderate", false, false, false),
        ["476"] = ("PGPR (INS 476)", "Additive / Emulsifier", "Improves chocolate flow in manufacturing", "Polyglycerol polyricinoleate — synthetic emulsifier reducing cocoa butter needed.", "moderate", false, false, false),
        ["500"] = ("Sodium Carbonates / Baking Soda (INS 500)", "Raising Agent", "Helps biscuits & baked snacks rise", "Standard leavening agent (baking soda/carbonate) or acidity regulator.", "low", false, false, false),
        ["501"] = ("Potassium Carbonates (INS 501)", "Raising / Acidity Agent", "Alkalizing salt used in noodles & cocoa", "Helps create springy noodle texture or alkalized cocoa.", "low", false, false, false),
        ["503"] = ("Ammonium Carbonates (INS 503)", "Raising Agent", "Creates crisp texture in biscuits", "Traditional baking leavening salt used in crackers and cookies.", "low", false, false, false),
        ["508"] = ("Potassium Chloride (INS 508)", "Salt Substitute / Stabilizer", "Mineral salt & gelling helper", "Used to reduce sodium or stabilize texture in noodles and snacks.", "low", false, false, false),
        ["551"] = ("Silicon Dioxide (INS 551)", "Additive / Anticaking Agent", "Prevents spice & seasoning powders from clumping", "Inert mineral anticaking agent common in snack seasoning mixes.", "low", false, false, false),
        ["621"] = ("Monosodium Glutamate / MSG (INS 621)", "Flavour Enhancer", "Boosts savoury umami taste", "Glutamate salt that intensifies savoury flavour in noodles and snacks.", "moderate", false, false, false),
        ["627"] = ("Disodium Guanylate (INS 627)", "Flavour Enhancer", "Amplifies savoury snack flavour", "Nucleotide flavour enhancer used with salt/spices to boost umami taste.", "moderate", false, false, false),
        ["631"] = ("Disodium Inosinate (INS 631)", "Flavour Enhancer", "Amplifies savoury snack flavour", "Nucleotide flavour enhancer paired with 627/621 in chips and instant noodles.", "moderate", false, false, false),
        ["635"] = ("Disodium 5'-Ribonucleotides (INS 635)", "Flavour Enhancer", "Strong savoury taste booster", "Blend of INS 627 and 631 used in instant noodles and masala snacks.", "moderate", false, false, false),
        ["950"] = ("Acesulfame Potassium (INS 950)", "Artificial Sweetener", "Zero-calorie synthetic sweetener", "High-intensity artificial sweetener (200x sweeter than sugar).", "watch", false, true, false),
        ["951"] = ("Aspartame (INS 951)", "Artificial Sweetener", "Zero-calorie synthetic sweetener", "Artificial sweetener; unsafe for individuals with phenylketonuria (PKU).", "watch", false, true, false),
        ["955"] = ("Sucralose (INS 955)", "Artificial Sweetener", "Zero-calorie chlorinated sugar sweetener", "High-intensity artificial sweetener (~600x sweeter than sugar).", "watch", false, true, false),
        ["960"] = ("Steviol Glycosides / Stevia (INS 960)", "Natural-Origin Sweetener", "Zero-calorie plant leaf sweetener", "Purified sweet extract from the stevia plant.", "low", false, true, false),
        ["965"] = ("Maltitol (INS 965)", "Sugar Alcohol Sweetener", "Reduced-calorie sweetener", "Polyol sweetener used in sugar-free bars/chocolates; excess may cause bloating.", "moderate", false, true, false),
    };

    private static readonly List<IngredientRule> Rules = new()
    {
        new(["whole wheat", "rolled oats", "wholegrain oats", "oats", "ragi", "jowar", "bajra", "millets", "quinoa", "brown rice", "foxnut", "makhana"], "Whole Grain / Seed", "Primary whole-food carbohydrate & fiber base", "Minimally refined whole grain or seed providing natural dietary fiber and micronutrients.", "low"),
        new(["refined wheat flour", "maida", "wheat flour", "enriched flour"], "Refined Grain", "Primary flour base & structure", "Refined or milled wheat flour; when listed first, forms the majority of the product by weight.", "moderate"),
        new(["potato", "dehydrated potato", "potato flakes"], "Whole / Culinary Base", "Primary snack base", "Potato base used for chips or extruded snacks.", "low"),
        new(["chickpea", "gram flour", "besan", "lentil", "moong", "urad", "toor", "chana", "peanut", "almond", "cashew", "walnut", "pistachio"], "Legume / Nut", "Plant protein, texture & healthy fats", "Nutrient-dense legume, pulse, or nut contributing protein and fiber.", "low"),
        new(["milk solids", "skimmed milk", "whole milk", "toned milk", "milk", "cream", "butter", "paneer", "curd", "yogurt", "whey"], "Dairy Ingredient", "Dairy protein, richness & calcium", "Milk-derived ingredient; source of dairy protein and lactose.", "low", Allergens: ["Milk"]),
        new(["whey protein", "milk protein", "soy protein isolate", "pea protein"], "Protein Concentrate / Isolate", "Concentrated protein boost", "Industrially isolated protein powder used to increase protein density in bars and shakes.", "low"),
        new(["cocoa", "cocoa solids", "cocoa butter", "cocoa mass"], "Whole / Culinary Base", "Chocolate flavour and natural polyphenols", "Derived from roasted cacao beans; higher cocoa solids mean richer real chocolate.", "low"),
        new(["maltodextrin"], "Sweetener / Bulking Agent", "Carrier for flavours & rapid starch carbohydrate", "Highly processed starch powder with a high glycemic index used as filler or seasoning carrier.", "watch", IsAdditive: true, IsSweetener: true),
        new(["high fructose corn syrup", "hfcs", "corn syrup", "liquid glucose", "glucose syrup", "invert sugar", "fructose"], "Refined Sweetener", "Sweetness, moisture & browning", "Processed liquid sugar syrup; adds free sugars rapidly absorbed by the body.", "watch", IsSweetener: true),
        new(["sugar", "cane sugar", "jaggery", "honey", "dextrose", "maltose", "sucrose", "caramel"], "Added Sugar", "Sweetness, texture & preservation", "Added caloric sweetener. High placement near the top of the ingredient list indicates significant sugar content.", "moderate", IsSweetener: true),
        new(["palmolein", "palm oil", "refined palm", "vegetable fat", "hydrogenated", "interesterified"], "Refined / Industrial Oil", "Frying medium & shelf-stable texture", "Refined tropical or industrially modified fat high in saturated fat (or trans fat if partially hydrogenated).", "watch"),
        new(["sunflower oil", "groundnut oil", "mustard oil", "olive oil", "rice bran oil", "soybean oil", "cottonseed oil", "corn oil", "coconut oil", "edible vegetable oil"], "Culinary Oil", "Cooking medium & mouthfeel", "Culinary vegetable oil; calorie-dense, quality depends on processing and oil type.", "moderate"),
        new(["iodised salt", "iodized salt", "salt", "rock salt", "sea salt", "black salt"], "Culinary Seasoning", "Flavouring & natural preservation", "Sodium chloride; contributes directly to dietary sodium intake.", "moderate"),
        new(["nature identical", "artificial flavour", "artificial flavor", "flavouring substance", "flavoring substance"], "Flavouring Additive", "Mimics or intensifies aroma & taste", "Laboratory-formulated flavouring compounds used to standardize taste in packaged foods.", "moderate", IsAdditive: true),
        new(["natural flavour", "natural flavor", "spices", "condiments", "turmeric", "cumin", "coriander", "chilli", "pepper", "garlic", "onion", "ginger", "cardamom", "cinnamon"], "Spices & Herbs", "Natural aroma, taste & colour", "Culinary spices, herbs, or natural extracts.", "low"),
        new(["tomato paste", "fruit pulp", "mango pulp", "apple juice", "orange juice", "dates", "raisin"], "Fruit / Vegetable Base", "Natural fruit or vegetable component", "Fruit or vegetable base ingredient; check overall sugar if concentrated.", "low"),
        new(["emulsifier", "stabilizer", "stabiliser", "thickener", "humectant", "acidity regulator", "anticaking", "raising agent"], "Additive / Functional Agent", "Maintains texture, shelf life, or stability", "Functional food additive used in commercial manufacturing.", "moderate", IsAdditive: true),
        new(["preservative"], "Preservative", "Extends shelf life", "Chemical or natural agent preventing spoilage.", "moderate", IsAdditive: true, IsPreservative: true),
        new(["flavour enhancer", "flavor enhancer"], "Flavour Enhancer", "Boosts savoury/umami intensity", "Industrial taste amplifier often paired with snack seasonings.", "moderate", IsAdditive: true),
        new(["permitted synthetic food colour", "artificial colour", "synthetic colour", "food colour"], "Artificial Colour", "Visual appeal dye", "Added food colouring.", "watch", IsAdditive: true, IsArtificialColour: true),
    };

    private static readonly (string Allergen, string[] Patterns)[] AllergenMatchers =
    {
        ("Milk", new[] { "milk", "whey", "casein", "butter", "cheese", "paneer", "lactose", "cream", "curd", "yogurt", "ghee" }),
        ("Wheat / Gluten", new[] { "wheat", "maida", "barley", "rye", "malt", "semolina", "suji", "gluten", "atta" }),
        ("Soy", new[] { "soy", "soya", "soybean", "tofu" }),
        ("Peanuts", new[] { "peanut", "groundnut" }),
        ("Tree Nuts", new[] { "almond", "cashew", "walnut", "hazelnut", "pistachio", "pecan", "macadamia" }),
        ("Sesame", new[] { "sesame", "til", "tahini" }),
        ("Mustard", new[] { "mustard", "rai" }),
        ("Sulphites", new[] { "sulphite", "sulfite", "220", "221", "222", "223", "224", "150d" }),
        ("Egg", new[] { "egg", "albumen" }),
    };

    public IngredientSummaryDto Decode(string? ingredientsText, string? explicitAllergens = null)
    {
        var summary = new IngredientSummaryDto();
        var detectedAllergens = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        if (!string.IsNullOrWhiteSpace(explicitAllergens))
        {
            foreach (var token in explicitAllergens.Split(new[] { ',', ';', '\n' }, StringSplitOptions.RemoveEmptyEntries))
            {
                var cleaned = token.Trim();
                if (!string.IsNullOrWhiteSpace(cleaned))
                    detectedAllergens.Add(cleaned);
            }
        }

        if (string.IsNullOrWhiteSpace(ingredientsText))
        {
            summary.DetectedAllergens = detectedAllergens.OrderBy(x => x).ToList();
            return summary;
        }

        var normalizedText = ingredientsText
            .Replace("&quot;", "\"")
            .Replace("&amp;", "&")
            .Replace("\r", " ")
            .Replace("\n", " ");

        // Remove common trailing footnotes like "*As flavouring agent"
        var tokens = SplitTopLevelAndNestedTokens(normalizedText);

        var index = 1;
        foreach (var raw in tokens)
        {
            var decoded = DecodeSingle(raw, index++);
            summary.Items.Add(decoded);
            if (decoded.IsAdditive) summary.AdditiveCount++;
            if (decoded.IsPreservative) summary.PreservativeCount++;
            if (decoded.IsSweetener) summary.SweetenerCount++;
            if (decoded.IsArtificialColour) summary.ArtificialColourCount++;
            foreach (var allergen in decoded.AllergenTags)
                detectedAllergens.Add(allergen);
        }

        summary.TotalCount = summary.Items.Count;
        summary.DetectedAllergens = detectedAllergens.OrderBy(x => x).ToList();
        return summary;
    }

    private static List<string> SplitTopLevelAndNestedTokens(string text)
    {
        var tokens = new List<string>();
        var current = new System.Text.StringBuilder();
        var depth = 0;

        foreach (var ch in text)
        {
            if (ch == '(' || ch == '[')
            {
                depth++;
                current.Append(ch);
            }
            else if (ch == ')' || ch == ']')
            {
                if (depth > 0) depth--;
                current.Append(ch);
            }
            else if ((ch == ',' || ch == ';') && depth == 0)
            {
                AddCleanedTokens(tokens, current.ToString());
                current.Clear();
            }
            else
            {
                current.Append(ch);
            }
        }
        AddCleanedTokens(tokens, current.ToString());
        return tokens;
    }

    private static void AddCleanedTokens(List<string> list, string raw)
    {
        var trimmed = raw.Trim().Trim('.', '"', '\'');
        if (string.IsNullOrWhiteSpace(trimmed) || trimmed.Length < 2)
            return;

        // Strip leading "Ingredients:" prefix if present
        trimmed = Regex.Replace(trimmed, @"^ingredients?\s*:\s*", "", RegexOptions.IgnoreCase).Trim();
        if (string.IsNullOrWhiteSpace(trimmed)) return;

        // If the token contains a parenthetical group like "Seasoning (Maltodextrin, Salt, INS 551)",
        // keep the outer context and also extract inner functional sub-ingredients cleanly
        var match = Regex.Match(trimmed, @"^([^(]+)\((.+)\)$");
        if (match.Success)
        {
            var prefix = match.Groups[1].Value.Trim();
            var inner = match.Groups[2].Value.Trim();
            // If inner is purely an INS code or percentage (e.g., "(551)" or "(627, 631)" or "(18%)"), keep whole token intact
            if (Regex.IsMatch(inner, @"^[\d\s,a-zA-Z%.-]{1,18}$") && !inner.Contains(','))
            {
                list.Add(trimmed);
                return;
            }
            if (Regex.IsMatch(inner, @"^(?:ins|e)?\s*\d{3}[a-z]?(?:\s*,\s*(?:ins|e)?\s*\d{3}[a-z]?)*$", RegexOptions.IgnoreCase))
            {
                // Split multi-code additives like "Flavour Enhancers (627, 631)" into individual items for clarity
                var codes = inner.Split(',', StringSplitOptions.RemoveEmptyEntries);
                foreach (var code in codes)
                    list.Add($"{prefix} ({code.Trim()})");
                return;
            }
            if (!string.IsNullOrWhiteSpace(prefix) && inner.Contains(','))
            {
                // Expand nested ingredient list e.g. Seasoning (Maltodextrin, Salt, Sugar)
                foreach (var sub in inner.Split(',', StringSplitOptions.RemoveEmptyEntries))
                {
                    var s = sub.Trim();
                    if (s.Length >= 2)
                        list.Add(s);
                }
                return;
            }
        }

        list.Add(trimmed);
    }

    private static DecodedIngredientDto DecodeSingle(string raw, int index)
    {
        var lower = raw.ToLowerInvariant();
        var allergens = new List<string>();
        foreach (var (allergen, patterns) in AllergenMatchers)
        {
            if (patterns.Any(p => Regex.IsMatch(lower, $@"\b{Regex.Escape(p)}\b")))
                allergens.Add(allergen);
        }

        // 1. Check explicit INS / E-number codes like "(551)", "INS 322", "E330", "INS 150d"
        var insMatch = Regex.Match(lower, @"(?:\bins\b\s*[-:]?\s*|\be\s*|\()(\d{3}[a-z]?)(?:\)|(?=\b))");
        if (insMatch.Success)
        {
            var code = insMatch.Groups[1].Value;
            if (InsDictionary.TryGetValue(code, out var ins))
            {
                return new DecodedIngredientDto
                {
                    RawName = raw,
                    NormalizedName = ins.Name,
                    OrderIndex = index,
                    Category = ins.Category,
                    Purpose = ins.Purpose,
                    PlainExplanation = ins.Explanation,
                    ConcernLevel = ins.Concern,
                    InsCode = $"INS {code.ToUpperInvariant()}",
                    IsAdditive = true,
                    IsPreservative = ins.Preservative,
                    IsSweetener = ins.Sweetener,
                    IsArtificialColour = ins.Colour,
                    AllergenTags = allergens
                };
            }
            return new DecodedIngredientDto
            {
                RawName = raw,
                NormalizedName = raw,
                OrderIndex = index,
                Category = "Registered Additive (INS/E-Code)",
                Purpose = "Food additive / technological function",
                PlainExplanation = $"Food additive identified by code INS {code.ToUpperInvariant()} used for texture, stability, colour, or preservation.",
                ConcernLevel = "moderate",
                InsCode = $"INS {code.ToUpperInvariant()}",
                IsAdditive = true,
                AllergenTags = allergens
            };
        }

        // 2. Match known ingredient rules
        foreach (var rule in Rules)
        {
            if (rule.Keywords.Any(k => lower.Contains(k)))
            {
                if (rule.Allergens != null)
                {
                    foreach (var a in rule.Allergens)
                        if (!allergens.Contains(a)) allergens.Add(a);
                }

                return new DecodedIngredientDto
                {
                    RawName = raw,
                    NormalizedName = CleanDisplayName(raw),
                    OrderIndex = index,
                    Category = rule.Category,
                    Purpose = rule.Purpose,
                    PlainExplanation = rule.Explanation,
                    ConcernLevel = rule.ConcernLevel,
                    IsAdditive = rule.IsAdditive,
                    IsPreservative = rule.IsPreservative,
                    IsSweetener = rule.IsSweetener,
                    IsArtificialColour = rule.IsArtificialColour,
                    AllergenTags = allergens
                };
            }
        }

        // 3. Default whole/unclassified culinary ingredient
        return new DecodedIngredientDto
        {
            RawName = raw,
            NormalizedName = CleanDisplayName(raw),
            OrderIndex = index,
            Category = "Culinary / Base Ingredient",
            Purpose = "Core food ingredient or flavour component",
            PlainExplanation = "Standard food ingredient listed on the package. Listed in descending order by weight.",
            ConcernLevel = "low",
            AllergenTags = allergens
        };
    }

    private static string CleanDisplayName(string raw)
    {
        var cleaned = Regex.Replace(raw, @"\s+", " ").Trim();
        if (cleaned.Length == 0) return raw;
        return char.ToUpperInvariant(cleaned[0]) + cleaned[1..];
    }
}

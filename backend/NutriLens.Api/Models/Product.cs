using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace NutriLens.Api.Models;

public class Product
{
    [Key]
    public int ProductId { get; set; }

    [Required, MaxLength(150)]
    public string ProductName { get; set; } = string.Empty;

    [MaxLength(100)]
    public string? Brand { get; set; }

    [MaxLength(80)]
    public string? Category { get; set; }

    [MaxLength(80)]
    public string? Barcode { get; set; }

    [MaxLength(500)]
    public string? ImageUrl { get; set; }

    [MaxLength(60)]
    public string? NetWeight { get; set; }

    [MaxLength(50)]
    public string? ServingSize { get; set; }

    [Column(TypeName = "decimal(10,2)")]
    public decimal? ServingSizeG { get; set; }

    [MaxLength(50)]
    public string? ServingsPerPack { get; set; }

    [MaxLength(30)]
    public string? NutritionBasis { get; set; } // "per_100g", "per_serving", "both"

    // Per serving (or primary reported serving values)
    [Column(TypeName = "decimal(10,2)")]
    public decimal? Calories { get; set; }

    [Column(TypeName = "decimal(10,2)")]
    public decimal? CarbsG { get; set; }

    [Column(TypeName = "decimal(10,2)")]
    public decimal? SugarG { get; set; }

    [Column(TypeName = "decimal(10,2)")]
    public decimal? AddedSugarG { get; set; }

    [Column(TypeName = "decimal(10,2)")]
    public decimal? SodiumMg { get; set; }

    [Column(TypeName = "decimal(10,2)")]
    public decimal? ProteinG { get; set; }

    [Column(TypeName = "decimal(10,2)")]
    public decimal? FatG { get; set; }

    [Column(TypeName = "decimal(10,2)")]
    public decimal? SaturatedFatG { get; set; }

    [Column(TypeName = "decimal(10,2)")]
    public decimal? TransFatG { get; set; }

    [Column(TypeName = "decimal(10,2)")]
    public decimal? FiberG { get; set; }

    // Standardized Per 100g / 100ml values
    [Column(TypeName = "decimal(10,2)")]
    public decimal? CaloriesPer100g { get; set; }

    [Column(TypeName = "decimal(10,2)")]
    public decimal? ProteinPer100g { get; set; }

    [Column(TypeName = "decimal(10,2)")]
    public decimal? CarbsPer100g { get; set; }

    [Column(TypeName = "decimal(10,2)")]
    public decimal? SugarPer100g { get; set; }

    [Column(TypeName = "decimal(10,2)")]
    public decimal? AddedSugarPer100g { get; set; }

    [Column(TypeName = "decimal(10,2)")]
    public decimal? FatPer100g { get; set; }

    [Column(TypeName = "decimal(10,2)")]
    public decimal? SaturatedFatPer100g { get; set; }

    [Column(TypeName = "decimal(10,2)")]
    public decimal? TransFatPer100g { get; set; }

    [Column(TypeName = "decimal(10,2)")]
    public decimal? FiberPer100g { get; set; }

    [Column(TypeName = "decimal(10,2)")]
    public decimal? SodiumMgPer100g { get; set; }

    public string? Ingredients { get; set; }

    [MaxLength(500)]
    public string? Allergens { get; set; }

    [MaxLength(300)]
    public string? DataSource { get; set; }

    [MaxLength(500)]
    public string? OffProductUrl { get; set; }

    public int? NovaGroup { get; set; }
    public int? HealthScore { get; set; }

    [MaxLength(60)]
    public string? Verdict { get; set; }

    public DateTime? LastVerifiedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public bool IsActive { get; set; } = true;
}

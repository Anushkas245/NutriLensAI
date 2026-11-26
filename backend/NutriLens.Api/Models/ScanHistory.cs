using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace NutriLens.Api.Models;

public class ScanHistory
{
    [Key]
    public int ScanId { get; set; }

    public int? UserId { get; set; }

    [ForeignKey(nameof(UserId))]
    public User? User { get; set; }

    [MaxLength(150)]
    public string ProductName { get; set; } = "Scanned Packaged Food";

    [MaxLength(100)]
    public string? Brand { get; set; }

    [MaxLength(80)]
    public string? Category { get; set; }

    [MaxLength(80)]
    public string? Barcode { get; set; }

    [MaxLength(60)]
    public string? NetWeight { get; set; }

    [MaxLength(60)]
    public string? ServingSizeText { get; set; }

    [Column(TypeName = "decimal(10,2)")]
    public decimal? ServingSizeG { get; set; }

    [MaxLength(30)]
    public string? NutritionBasis { get; set; }

    public string? ExtractedJson { get; set; }
    public string? CorrectedJson { get; set; }
    public string? AssessmentJson { get; set; }

    public int? HealthScore { get; set; }
    public int? NovaGroup { get; set; }

    [MaxLength(60)]
    public string? Verdict { get; set; }

    [MaxLength(200)]
    public string? SourceImageName { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

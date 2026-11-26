using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace NutriLens.Api.Models;

public class SavedProduct
{
    [Key]
    public int SavedProductId { get; set; }

    public int UserId { get; set; }

    [ForeignKey(nameof(UserId))]
    public User? User { get; set; }

    public int? ProductId { get; set; }

    [ForeignKey(nameof(ProductId))]
    public Product? Product { get; set; }

    public int? ScanId { get; set; }

    [MaxLength(150)]
    public string ProductName { get; set; } = string.Empty;

    [MaxLength(100)]
    public string? Brand { get; set; }

    [MaxLength(80)]
    public string? Category { get; set; }

    public int? HealthScore { get; set; }
    public int? NovaGroup { get; set; }

    [MaxLength(60)]
    public string? Verdict { get; set; }

    public string? SnapshotJson { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

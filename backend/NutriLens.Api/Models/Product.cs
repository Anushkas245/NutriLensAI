
namespace NutriLens.Api.Models;

public class Product
{
    public int ProductId { get; set; }

    public string ProductName { get; set; } = string.Empty;
    public string? Brand { get; set; }
    public string? Category { get; set; }
    public string? ServingSize { get; set; }

    public decimal? Calories { get; set; }
    public decimal? SugarG { get; set; }
    public decimal? SodiumMg { get; set; }
    public decimal? ProteinG { get; set; }
    public decimal? FatG { get; set; }
    public decimal? SaturatedFatG { get; set; }

    public string? Ingredients { get; set; }
    public string? Allergens { get; set; }
    public string? DataSource { get; set; }
    public DateTime? LastVerifiedAt { get; set; }

    public bool IsActive { get; set; } = true;
}

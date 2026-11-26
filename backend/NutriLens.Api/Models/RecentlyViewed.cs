using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace NutriLens.Api.Models;

public class RecentlyViewed
{
    [Key]
    public int RecentlyViewedId { get; set; }

    public int UserId { get; set; }

    [ForeignKey(nameof(UserId))]
    public User? User { get; set; }

    public int ProductId { get; set; }

    [ForeignKey(nameof(ProductId))]
    public Product? Product { get; set; }

    public DateTime ViewedAt { get; set; } = DateTime.UtcNow;
}

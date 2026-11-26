using System.ComponentModel.DataAnnotations;

namespace NutriLens.Api.Models;

public class User
{
    [Key]
    public int UserId { get; set; }

    [Required, MaxLength(120)]
    public string FullName { get; set; } = string.Empty;

    [Required, MaxLength(180)]
    public string Email { get; set; } = string.Empty;

    [Required, MaxLength(300)]
    public string PasswordHash { get; set; } = string.Empty;

    public string? DietaryPreferencesJson { get; set; }
    public string? AllergensJson { get; set; }
    public string? HealthGoalsJson { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}


using Microsoft.EntityFrameworkCore;
using NutriLens.Api.Models;

namespace NutriLens.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options)
        : base(options)
    {
    }

    public DbSet<Product> Products => Set<Product>();
}

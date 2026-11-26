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
    public DbSet<User> Users => Set<User>();
    public DbSet<ScanHistory> ScanHistories => Set<ScanHistory>();
    public DbSet<SavedProduct> SavedProducts => Set<SavedProduct>();
    public DbSet<RecentlyViewed> RecentlyVieweds => Set<RecentlyViewed>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<User>()
            .HasIndex(u => u.Email)
            .IsUnique();

        modelBuilder.Entity<Product>()
            .HasIndex(p => p.Barcode);

        modelBuilder.Entity<Product>()
            .HasIndex(p => p.Category);
    }
}

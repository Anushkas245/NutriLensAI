using Microsoft.EntityFrameworkCore;
using NutriLens.Api.Data;
using NutriLens.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddHttpClient();

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(
        builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddSingleton<IngredientDecoderService>();
builder.Services.AddSingleton<FoodAssessmentService>();
builder.Services.AddSingleton<AuthTokenService>();
builder.Services.AddHttpClient<OpenFoodFactsService>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("ReactFrontend", policy =>
    {
        policy.WithOrigins(
            "http://localhost:5173",
            "http://localhost:5174"
        )
        .AllowAnyHeader()
        .AllowAnyMethod();
    });
});

var app = builder.Build();

await DatabaseInitializer.InitializeAsync(app.Services);

app.UseCors("ReactFrontend");

app.MapControllers();

app.Run();

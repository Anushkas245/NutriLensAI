using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace NutriLens.Api.Services;

public class AuthTokenService
{
    private readonly byte[] _secret;

    public AuthTokenService(IConfiguration configuration)
    {
        var configured = configuration["Auth:JwtSecret"];
        // Deterministic dev fallback derived from machine/app string if not configured
        var keyMaterial = string.IsNullOrWhiteSpace(configured)
            ? "NutriLensAI-Dev-Secret-Key-Change-In-Production-2026!"
            : configured;
        _secret = SHA256.HashData(Encoding.UTF8.GetBytes(keyMaterial));
    }

    public string HashPassword(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(16);
        var hash = Rfc2898DeriveBytes.Pbkdf2(password, salt, 100_000, HashAlgorithmName.SHA256, 32);
        return $"{Convert.ToBase64String(salt)}.{Convert.ToBase64String(hash)}";
    }

    public bool VerifyPassword(string password, string storedHash)
    {
        var parts = storedHash.Split('.');
        if (parts.Length != 2) return false;
        try
        {
            var salt = Convert.FromBase64String(parts[0]);
            var expected = Convert.FromBase64String(parts[1]);
            var actual = Rfc2898DeriveBytes.Pbkdf2(password, salt, 100_000, HashAlgorithmName.SHA256, 32);
            return CryptographicOperations.FixedTimeEquals(expected, actual);
        }
        catch
        {
            return false;
        }
    }

    public string CreateToken(int userId, string email, string fullName)
    {
        var header = Base64UrlEncode(Encoding.UTF8.GetBytes("{\"alg\":\"HS256\",\"typ\":\"JWT\"}"));
        var exp = DateTimeOffset.UtcNow.AddDays(14).ToUnixTimeSeconds();
        var payloadJson = JsonSerializer.Serialize(new { sub = userId, email, name = fullName, exp });
        var payload = Base64UrlEncode(Encoding.UTF8.GetBytes(payloadJson));
        var signingInput = $"{header}.{payload}";
        using var hmac = new HMACSHA256(_secret);
        var signature = Base64UrlEncode(hmac.ComputeHash(Encoding.UTF8.GetBytes(signingInput)));
        return $"{signingInput}.{signature}";
    }

    public int? ValidateTokenAndGetUserId(HttpRequest request)
    {
        var auth = request.Headers.Authorization.FirstOrDefault();
        if (string.IsNullOrWhiteSpace(auth) || !auth.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            return null;

        var token = auth["Bearer ".Length..].Trim();
        var parts = token.Split('.');
        if (parts.Length != 3) return null;

        try
        {
            var signingInput = $"{parts[0]}.{parts[1]}";
            using var hmac = new HMACSHA256(_secret);
            var expectedSig = Base64UrlEncode(hmac.ComputeHash(Encoding.UTF8.GetBytes(signingInput)));
            if (!CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(expectedSig), Encoding.UTF8.GetBytes(parts[2])))
                return null;

            var payloadBytes = Base64UrlDecode(parts[1]);
            using var doc = JsonDocument.Parse(payloadBytes);
            var root = doc.RootElement;
            if (!root.TryGetProperty("exp", out var expEl) || expEl.GetInt64() < DateTimeOffset.UtcNow.ToUnixTimeSeconds())
                return null;

            if (root.TryGetProperty("sub", out var subEl) && subEl.TryGetInt32(out var userId))
                return userId;

            return null;
        }
        catch
        {
            return null;
        }
    }

    private static string Base64UrlEncode(byte[] data) =>
        Convert.ToBase64String(data).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static byte[] Base64UrlDecode(string input)
    {
        var padded = input.Replace('-', '+').Replace('_', '/');
        switch (padded.Length % 4)
        {
            case 2: padded += "=="; break;
            case 3: padded += "="; break;
        }
        return Convert.FromBase64String(padded);
    }
}

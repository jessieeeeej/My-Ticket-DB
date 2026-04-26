using myticketdb.API.Data;
using myticketdb.API.Models;

namespace myticketdb.API.Services;

public class RiskResult
{
    public int Score { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty; // PASS / REVIEW / BLOCK
}

public class RiskCheckService
{
    private readonly HttpClient _http;
    private readonly AppDbContext _db;

    public RiskCheckService(HttpClient http, AppDbContext db)
    {
        _http = http;
        _db = db;
    }

    public bool IsBlacklisted(int userId)
        => _db.Blacklists.Any(b => b.UserId == userId);

    public async Task<RiskResult> CheckAsync(
        int userId, string ip, string userAgent,
        int requestsPerMinute, int accountAgeDays, int ticketCount)
    {
        var payload = new
        {
            userId, ip, userAgent,
            requestsPerMinute, accountAgeDays, ticketCount
        };

        var resp = await _http.PostAsJsonAsync(
            "http://localhost:8000/agent/risk-score", payload);

        if (!resp.IsSuccessStatusCode)
            return new RiskResult { Score = 0, Reason = "AI unavailable", Action = "PASS" };

        return await resp.Content.ReadFromJsonAsync<RiskResult>()
            ?? new RiskResult { Score = 0, Action = "PASS" };
    }

    public async Task SaveToAuditQueue(int userId, RiskResult risk)
    {
        _db.AuditQueues.Add(new AuditQueue
        {
            UserId = userId,
            RiskScore = risk.Score,
            Reason = risk.Reason,
            Action = risk.Action,
            Resolved = false,
            CreatedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync();
    }

    public async Task SaveToBlacklist(int userId, RiskResult risk)
    {
        if (!_db.Blacklists.Any(b => b.UserId == userId))
        {
            _db.Blacklists.Add(new Blacklist
            {
                UserId = userId,
                Reason = risk.Reason,
                BlockedAt = DateTime.UtcNow
            });
            await _db.SaveChangesAsync();
        }
    }
}
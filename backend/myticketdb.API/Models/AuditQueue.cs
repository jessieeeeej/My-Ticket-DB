namespace myticketdb.API.Models;

public class AuditQueue
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public int RiskScore { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public bool Resolved { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public User User { get; set; } = null!;
}
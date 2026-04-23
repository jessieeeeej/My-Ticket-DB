namespace myticketdb.API.Models;

public class Blacklist
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Reason { get; set; } = string.Empty;
    public DateTime BlockedAt { get; set; } = DateTime.UtcNow;
    public User User { get; set; } = null!;
}
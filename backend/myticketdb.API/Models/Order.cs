namespace myticketdb.API.Models;

public enum OrderStatus { Pending, Paid, Cancelled, Expired }

public class Order
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public int TicketTypeId { get; set; }
    public int Quantity { get; set; }
    public OrderStatus Status { get; set; } = OrderStatus.Pending;
    public string IdempotencyKey { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public User User { get; set; } = null!;
    public TicketType TicketType { get; set; } = null!;
}
namespace myticketdb.API.Models;

public class TicketType
{
    public int Id { get; set; }
    public int EventId { get; set; }
    public string ZoneName { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public int TotalQty { get; set; }
    public int RemainingQty { get; set; }
    public Event Event { get; set; } = null!;
    public ICollection<Order> Orders { get; set; } = new List<Order>();
}
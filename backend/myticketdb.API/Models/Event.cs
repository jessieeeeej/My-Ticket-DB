namespace myticketdb.API.Models;

public class Event
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Venue { get; set; } = string.Empty;
    public DateTime EventDate { get; set; }
    public string Description { get; set; } = string.Empty;
    public DateTime? SaleStartTime { get; set; } // null = 已開售
    public ICollection<TicketType> TicketTypes { get; set; } = new List<TicketType>();
}
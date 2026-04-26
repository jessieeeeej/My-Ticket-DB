using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using myticketdb.API.Data;

namespace myticketdb.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class EventsController : ControllerBase
{
    private readonly AppDbContext _db;

    public EventsController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var events = await _db.Events
            .Include(e => e.TicketTypes)
            .Select(e => new {
                e.Id,
                e.Name,
                e.Venue,
                e.EventDate,
                e.Description,
                e.SaleStartTime,
                TicketTypes = e.TicketTypes.Select(tt => new {
                    tt.Id,
                    tt.ZoneName,
                    tt.Price,
                    tt.TotalQty,
                    tt.RemainingQty
                })
            })
            .OrderByDescending(e => e.EventDate)
            .ToListAsync();
        return Ok(events);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var ev = await _db.Events
            .Include(e => e.TicketTypes)
            .FirstOrDefaultAsync(e => e.Id == id);
        if (ev == null) return NotFound();
        return Ok(ev);
    }
}
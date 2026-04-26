using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using myticketdb.API.Data;
using myticketdb.API.Models;

namespace myticketdb.API.Controllers;

[ApiController]
[Route("api/[controller]")]

public class AdminController : ControllerBase
{
    private readonly AppDbContext _db;
    public AdminController(AppDbContext db) => _db = db;

    private bool IsAdmin(int userId)
        => _db.Users.Any(u => u.Id == userId && u.Role == "ADMIN");

    // 審核佇列
    [HttpGet("audit-queue")]
    public async Task<IActionResult> GetAuditQueue()
    {
        var items = await _db.AuditQueues
            .Where(a => !a.Resolved)
            .OrderByDescending(a => a.RiskScore)
            .ToListAsync();
        return Ok(items);
    }

    // 放行
    [HttpPut("audit-queue/{id}/resolve")]
    public async Task<IActionResult> Resolve(int id)
    {
        var item = await _db.AuditQueues.FindAsync(id);
        if (item == null) return NotFound();
        item.Resolved = true;
        await _db.SaveChangesAsync();
        return Ok(new { message = "已放行" });
    }

    // 封鎖
    [HttpPost("blacklist/{userId}")]
    public async Task<IActionResult> Block(int userId, [FromBody] string reason)
    {
        if (_db.Blacklists.Any(b => b.UserId == userId))
            return BadRequest(new { message = "已在黑名單" });

        _db.Blacklists.Add(new Blacklist
        {
            UserId = userId,
            Reason = reason,
            BlockedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync();
        return Ok(new { message = "已封鎖" });
    }

    // 黑名單列表
    [HttpGet("blacklist")]
    public async Task<IActionResult> GetBlacklist()
    {
        var list = await _db.Blacklists.OrderByDescending(b => b.BlockedAt).ToListAsync();
        return Ok(list);
    }

    // Dashboard 統計
    [HttpGet("dashboard")]
    public async Task<IActionResult> GetDashboard([FromQuery] int userId)
    {
        if (!IsAdmin(userId))
            return StatusCode(403, new { message = "權限不足" });
            
        var today = DateTime.UtcNow.Date;

        var totalOrders = await _db.Orders.CountAsync();
        var todayOrders = await _db.Orders.CountAsync(o => o.CreatedAt >= today);
        var successOrders = await _db.Orders.CountAsync(o => o.Status == OrderStatus.Paid);
        var pendingOrders = await _db.Orders.CountAsync(o => o.Status == OrderStatus.Pending);
        var cancelledOrders = await _db.Orders.CountAsync(o => o.Status == OrderStatus.Cancelled);
        var blockedCount = await _db.Blacklists.CountAsync();
        var auditCount = await _db.AuditQueues.CountAsync(a => !a.Resolved);

        // 每小時訂單數（過去24小時）
        var last24h = DateTime.UtcNow.AddHours(-24);
        var hourlyOrders = await _db.Orders
            .Where(o => o.CreatedAt >= last24h)
            .GroupBy(o => o.CreatedAt.Hour)
            .Select(g => new { Hour = g.Key, Count = g.Count() })
            .OrderBy(x => x.Hour)
            .ToListAsync();

        // 各活動售票狀況
        var eventStats = await _db.Events
            .Include(e => e.TicketTypes)
            .Select(e => new {
                e.Id,
                e.Name,
                TotalQty = e.TicketTypes.Sum(tt => tt.TotalQty),
                RemainingQty = e.TicketTypes.Sum(tt => tt.RemainingQty),
                SoldQty = e.TicketTypes.Sum(tt => tt.TotalQty - tt.RemainingQty),
            })
            .ToListAsync();

        return Ok(new {
            totalOrders,
            todayOrders,
            successOrders,
            pendingOrders,
            cancelledOrders,
            blockedCount,
            auditCount,
            hourlyOrders,
            eventStats,
            successRate = totalOrders > 0
                ? Math.Round((double)successOrders / totalOrders * 100, 1)
                : 0
        });
    }

    // 訂單列表
    [HttpGet("orders")]
    public async Task<IActionResult> GetOrders(
        [FromQuery] string? status,
        [FromQuery] int? eventId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var query = _db.Orders
            .Include(o => o.User)
            .Include(o => o.TicketType)
                .ThenInclude(tt => tt.Event)
            .AsQueryable();

        if (!string.IsNullOrEmpty(status) && Enum.TryParse<OrderStatus>(status, out var s))
            query = query.Where(o => o.Status == s);

        if (eventId.HasValue)
            query = query.Where(o => o.TicketType.EventId == eventId);

        var total = await query.CountAsync();
        var orders = await query
            .OrderByDescending(o => o.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(o => new {
                o.Id,
                o.Status,
                o.Quantity,
                o.CreatedAt,
                o.IdempotencyKey,
                User = new { o.User.Id, o.User.Username, o.User.Email },
                TicketType = new {
                    o.TicketType.Id,
                    o.TicketType.ZoneName,
                    o.TicketType.Price,
                    Event = new { o.TicketType.Event.Id, o.TicketType.Event.Name }
                }
            })
            .ToListAsync();

        return Ok(new { total, page, pageSize, orders });
    }

    // 更新訂單狀態
    [HttpPut("orders/{id}/status")]
    public async Task<IActionResult> UpdateOrderStatus(int id, [FromBody] string status)
    {
        var order = await _db.Orders.FindAsync(id);
        if (order == null) return NotFound();

        if (!Enum.TryParse<OrderStatus>(status, out var s))
            return BadRequest(new { message = "無效狀態" });

        order.Status = s;
        await _db.SaveChangesAsync();
        return Ok(new { message = "已更新" });
    }

    // 庫存列表
    [HttpGet("inventory")]
    public async Task<IActionResult> GetInventory(
        [FromServices] StackExchange.Redis.IConnectionMultiplexer redis)
    {
        var redisDb = redis.GetDatabase();
        var ticketTypes = await _db.TicketTypes
            .Include(tt => tt.Event)
            .OrderBy(tt => tt.EventId)
            .Select(tt => new {
                tt.Id,
                tt.ZoneName,
                tt.Price,
                tt.TotalQty,
                tt.RemainingQty,
                Event = new { tt.Event.Id, tt.Event.Name }
            })
            .ToListAsync();

        // 同時拿 Redis 的即時庫存
        var result = new List<object>();
        foreach (var tt in ticketTypes)
        {
            var redisStock = await redisDb.StringGetAsync($"ticket:{tt.Id}:stock");
            result.Add(new {
                tt.Id,
                tt.ZoneName,
                tt.Price,
                tt.TotalQty,
                DbStock = tt.RemainingQty,
                RedisStock = redisStock.HasValue ? (int)redisStock : -1,
                EventId = tt.Event.Id,
                EventName = tt.Event.Name,
                SoldQty = tt.TotalQty - tt.RemainingQty,
                SoldPct = Math.Round((double)(tt.TotalQty - tt.RemainingQty) / tt.TotalQty * 100, 1)
            });
        }

        return Ok(result);
    }

    // 手動調整庫存
    [HttpPut("inventory/{ticketTypeId}/adjust")]
    public async Task<IActionResult> AdjustStock(
        int ticketTypeId,
        [FromBody] int newStock,
        [FromServices] StackExchange.Redis.IConnectionMultiplexer redis)
    {
        var tt = await _db.TicketTypes.FindAsync(ticketTypeId);
        if (tt == null) return NotFound();

        if (newStock < 0 || newStock > tt.TotalQty)
            return BadRequest(new { message = $"庫存需在 0 到 {tt.TotalQty} 之間" });

        // 同步更新 DB 和 Redis
        tt.RemainingQty = newStock;
        await _db.SaveChangesAsync();

        var redisDb = redis.GetDatabase();
        redisDb.StringSet($"ticket:{ticketTypeId}:stock", newStock);

        return Ok(new { message = "庫存已更新", dbStock = newStock, redisStock = newStock });
    }
}
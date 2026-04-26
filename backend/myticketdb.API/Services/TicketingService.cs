using myticketdb.API.Data;
using myticketdb.API.Models;
using StackExchange.Redis;
using RedisOrder = StackExchange.Redis.Order;
using Microsoft.EntityFrameworkCore;

namespace myticketdb.API.Services;

public class TicketingService
{
    private readonly IConnectionMultiplexer _redis;
    private readonly AppDbContext _db;

    public TicketingService(IConnectionMultiplexer redis, AppDbContext db)
    {
        _redis = redis;
        _db = db;
    }

    // Lua Script：原子查庫存 + 扣減
    private const string DecrStockLua = @"
        local stock = tonumber(redis.call('GET', KEYS[1]))
        if stock == nil then return -1 end
        if stock < tonumber(ARGV[1]) then return 0 end
        redis.call('DECRBY', KEYS[1], ARGV[1])
        return 1
    ";

    public async Task<(bool Success, string Message, int OrderId)> PurchaseAsync(
        int userId, int ticketTypeId, int quantity, string idempotencyKey)
    {
        // 1. 冪等性檢查
        var existing = _db.Orders.FirstOrDefault(o => o.IdempotencyKey == idempotencyKey);
        if (existing != null)
            return (true, "已存在訂單（冪等）", existing.Id);

        // 2. Redis Lua Script 原子扣票
        var redisDb = _redis.GetDatabase();
        var key = $"ticket:{ticketTypeId}:stock";
        var result = (int)await redisDb.ScriptEvaluateAsync(
            DecrStockLua,
            new RedisKey[] { key },
            new RedisValue[] { quantity });

        if (result == 0) return (false, "票已售罄", 0);
        if (result == -1) return (false, "票種不存在", 0);

        // 3. 寫入 DB 訂單
        var order = new myticketdb.API.Models.Order
        {
            UserId = userId,
            TicketTypeId = ticketTypeId,
            Quantity = quantity,
            Status = OrderStatus.Pending,
            IdempotencyKey = idempotencyKey,
            CreatedAt = DateTime.UtcNow
        };
        _db.Orders.Add(order);
        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            var dup = _db.Orders.FirstOrDefault(o => o.IdempotencyKey == idempotencyKey);
            if (dup != null)
                return (true, "已存在訂單（冪等）", dup.Id);
            return (false, "建立訂單失敗", 0);
        }
        return (true, "搶票成功", order.Id);
    }

    public async Task<bool> PayAsync(int orderId)
    {
        var order = await _db.Orders.FindAsync(orderId);
        if (order == null) return false;
        
        order.Status = OrderStatus.Paid;
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<object> GetUserOrdersAsync(int userId)
    {
        return await _db.Orders
            .Include(o => o.TicketType)
                .ThenInclude(tt => tt.Event)
            .Where(o => o.UserId == userId)
            .OrderByDescending(o => o.CreatedAt)
            .Select(o => new {
                o.Id,
                o.Status,
                o.Quantity,
                o.CreatedAt,
                TicketType = new {
                    o.TicketType.ZoneName,
                    o.TicketType.Price,
                    Event = new {
                        o.TicketType.Event.Name,
                        o.TicketType.Event.Venue,
                        o.TicketType.Event.EventDate,
                    }
                }
            })
            .ToListAsync();
    }
}
using Microsoft.AspNetCore.Mvc;
using myticketdb.API.Services;

namespace myticketdb.API.Controllers;

public record PurchaseRequest(
    int UserId,
    int TicketTypeId,
    int Quantity,
    string IdempotencyKey);

[ApiController]
[Route("api/[controller]")]
public class TicketingController : ControllerBase
{
    private readonly TicketingService _svc;
    private readonly RiskCheckService _risk;

    public TicketingController(TicketingService svc, RiskCheckService risk)
    {
        _svc = svc;
        _risk = risk;
    }

    [HttpPost("purchase")]
    public async Task<IActionResult> Purchase([FromBody] PurchaseRequest req)
    {
        // 1. 黑名單直接擋
        if (_risk.IsBlacklisted(req.UserId))
            return StatusCode(403, new { message = "此帳號已被封鎖" });

        // 2. AI 風險評分
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        var ua = Request.Headers.UserAgent.ToString();
        var riskResult = await _risk.CheckAsync(
            req.UserId, ip, ua,
            requestsPerMinute: 1,   // 簡化：實際可用 Redis 計數
            accountAgeDays: 30,
            ticketCount: req.Quantity);

        if (riskResult.Action == "BLOCK")
        {
            await _risk.SaveToBlacklist(req.UserId, riskResult);
            return StatusCode(403, new { message = "偵測到異常行為，已封鎖", reason = riskResult.Reason });
        }

        if (riskResult.Action == "REVIEW")
        {
            await _risk.SaveToAuditQueue(req.UserId, riskResult);
            // REVIEW 仍然放行，但有記錄
        }

        // 3. 正常搶票流程
        var (success, message, orderId) = await _svc.PurchaseAsync(
            req.UserId, req.TicketTypeId, req.Quantity, req.IdempotencyKey);

        if (!success) return BadRequest(new { message });
        return Ok(new { message, orderId, riskScore = riskResult.Score });
    }

    [HttpGet("stock/{ticketTypeId}")]
    public async Task<IActionResult> GetStock(
        int ticketTypeId,
        [FromServices] StackExchange.Redis.IConnectionMultiplexer redis)
    {
        var val = await redis.GetDatabase()
            .StringGetAsync($"ticket:{ticketTypeId}:stock");
        return Ok(new { ticketTypeId, stock = (int)val });
    }

    [HttpPost("pay/{orderId}")]
    public async Task<IActionResult> Pay(int orderId)
    {
        var success = await _svc.PayAsync(orderId);
        if (!success) return NotFound(new { message = "訂單不存在" });
        return Ok(new { message = "付款成功", orderId });
    }

    [HttpGet("orders/user/{userId}")]
    public async Task<IActionResult> GetUserOrders(int userId)
    {
        var orders = await _svc.GetUserOrdersAsync(userId);
        return Ok(orders);
    }
}
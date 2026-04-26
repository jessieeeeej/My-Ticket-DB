using BCrypt.Net;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using myticketdb.API.Data;
using myticketdb.API.Models;

namespace myticketdb.API.Controllers;

public record RegisterRequest(string Username, string Email, string Password);
public record LoginRequest(string Username, string Password);

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _db;
    public AuthController(AppDbContext db) => _db = db;

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest req)
    {
        // 檢查用戶名是否已存在
        if (await _db.Users.AnyAsync(u => u.Username == req.Username))
            return BadRequest(new { message = "此用戶名已被使用" });

        if (await _db.Users.AnyAsync(u => u.Email == req.Email))
            return BadRequest(new { message = "此 Email 已被註冊" });

        if (req.Password.Length < 6)
            return BadRequest(new { message = "密碼至少需要 6 個字元" });

        var user = new User
        {
            Username = req.Username,
            Email = req.Email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password),
            Role = "USER",
            CreatedAt = DateTime.UtcNow,
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        return Ok(new {
            id = user.Id,
            username = user.Username,
            email = user.Email,
            role = user.Role,
        });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest req)
    {
        var user = await _db.Users
            .FirstOrDefaultAsync(u => u.Username == req.Username);

        if (user == null || !BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
            return Unauthorized(new { message = "用戶名或密碼錯誤" });

        return Ok(new {
            id = user.Id,
            username = user.Username,
            email = user.Email,
            role = user.Role,
        });
    }

    [HttpGet("me/{userId}")]
    public async Task<IActionResult> GetMe(int userId)
    {
        var user = await _db.Users.FindAsync(userId);
        if (user == null) return NotFound();
        return Ok(new {
            id = user.Id,
            username = user.Username,
            email = user.Email,
            role = user.Role,
        });
    }
}
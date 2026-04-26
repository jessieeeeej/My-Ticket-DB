using Microsoft.EntityFrameworkCore;
using myticketdb.API.Data;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddScoped<myticketdb.API.Services.TicketingService>();
builder.Services.AddHttpClient();
builder.Services.AddScoped<myticketdb.API.Services.RiskCheckService>();
// MySQL
var connStr = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseMySql(connStr, ServerVersion.AutoDetect(connStr)));

// Redis
builder.Services.AddSingleton<StackExchange.Redis.IConnectionMultiplexer>(
    StackExchange.Redis.ConnectionMultiplexer.Connect(
        builder.Configuration.GetConnectionString("Redis")!));

// CORS（讓 React 可以打過來）
builder.Services.AddCors(options =>
    options.AddPolicy("AllowAll", p =>
        p.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader()));

var app = builder.Build();

// Seed
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    DbSeeder.Seed(db);
}

// 把票量寫進 Redis
var redis = app.Services.GetRequiredService<StackExchange.Redis.IConnectionMultiplexer>();
var redisDb = redis.GetDatabase();
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var ticketTypes = db.TicketTypes.ToList();
    foreach (var tt in ticketTypes)
    {
        redisDb.StringSet($"ticket:{tt.Id}:stock", tt.RemainingQty);
    }
}

app.UseSwagger();
app.UseSwaggerUI();
app.UseCors("AllowAll");
app.MapControllers();
app.Run();
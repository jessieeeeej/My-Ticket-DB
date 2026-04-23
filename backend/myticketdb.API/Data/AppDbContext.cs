using Microsoft.EntityFrameworkCore;
using myticketdb.API.Models;

namespace myticketdb.API.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Event> Events => Set<Event>();
    public DbSet<TicketType> TicketTypes => Set<TicketType>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<Blacklist> Blacklists => Set<Blacklist>();
    public DbSet<AuditQueue> AuditQueues => Set<AuditQueue>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // IdempotencyKey 不能重複
        modelBuilder.Entity<Order>()
            .HasIndex(o => o.IdempotencyKey)
            .IsUnique();

        // TicketType.Price 精度設定
        modelBuilder.Entity<TicketType>()
            .Property(t => t.Price)
            .HasColumnType("decimal(10,2)");
    }
}
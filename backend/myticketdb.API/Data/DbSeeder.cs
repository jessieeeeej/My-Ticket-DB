using myticketdb.API.Models;

namespace myticketdb.API.Data;
using BCrypt.Net;

public static class DbSeeder
{
    public static void Seed(AppDbContext db)
    {
        if (!db.Events.Any())
        {
            var events = new List<Event>
            {
                new() {
                    Name = "五月天 諾亞方舟",
                    Venue = "台北小巨蛋",
                    EventDate = new DateTime(2025, 6, 14, 19, 30, 0),
                    Description = "五月天世界巡迴演唱會台北場",
                    TicketTypes = new List<TicketType>
                    {
                        new() { ZoneName = "搖滾站票區", Price = 3800, TotalQty = 300, RemainingQty = 0 },
                        new() { ZoneName = "一般座位區A", Price = 2800, TotalQty = 500, RemainingQty = 0 },
                        new() { ZoneName = "VIP貴賓席",  Price = 6800, TotalQty = 20,  RemainingQty = 0 }
                    }
                },
                new() {
                    Name = "周杰倫 嘉年華",
                    Venue = "高雄巨蛋",
                    EventDate = new DateTime(2025, 7, 5, 19, 0, 0),
                    Description = "周杰倫台灣巡迴演唱會高雄場",
                    TicketTypes = new List<TicketType>
                    {
                        new() { ZoneName = "搖滾區",    Price = 3200, TotalQty = 400, RemainingQty = 0 },
                        new() { ZoneName = "一般座位區", Price = 2200, TotalQty = 800, RemainingQty = 0 }
                    }
                },
                new() {
                    Name = "TWICE 5TH WORLD TOUR 台灣場",
                    Venue = "台北小巨蛋",
                    EventDate = new DateTime(2026, 9, 20, 18, 30, 0),
                    Description = "TWICE 第五次世界巡迴演唱會台灣場",
                    SaleStartTime = null,
                    TicketTypes = new List<TicketType>
                    {
                        new() { ZoneName = "搖滾站票區", Price = 3800, TotalQty = 500,  RemainingQty = 320 },
                        new() { ZoneName = "一般座位區", Price = 2800, TotalQty = 1000, RemainingQty = 680 },
                        new() { ZoneName = "VIP貴賓席",  Price = 6800, TotalQty = 50,   RemainingQty = 12  }
                    }
                },
                new() {
                    Name = "BLACKPINK WORLD TOUR 台灣場",
                    Venue = "桃園國際棒球場",
                    EventDate = new DateTime(2026, 10, 11, 19, 0, 0),
                    Description = "BLACKPINK 世界巡迴演唱會台灣場",
                    SaleStartTime = null,
                    TicketTypes = new List<TicketType>
                    {
                        new() { ZoneName = "搖滾站票區", Price = 3500, TotalQty = 800,  RemainingQty = 540 },
                        new() { ZoneName = "一般座位區", Price = 2500, TotalQty = 2000, RemainingQty = 1450 },
                        new() { ZoneName = "VIP貴賓席",  Price = 7500, TotalQty = 100,  RemainingQty = 38  }
                    }
                },
                new() {
                    Name = "BTS yet to come 台灣場",
                    Venue = "台北大巨蛋",
                    EventDate = new DateTime(2026, 11, 15, 19, 0, 0),
                    Description = "BTS 世界巡迴演唱會台灣場，售票即將開始",
                    SaleStartTime = new DateTime(2026, 5, 1, 4, 0, 0, DateTimeKind.Utc),
                    TicketTypes = new List<TicketType>
                    {
                        new() { ZoneName = "搖滾站票區", Price = 4200, TotalQty = 1000, RemainingQty = 1000 },
                        new() { ZoneName = "一般座位區", Price = 3200, TotalQty = 3000, RemainingQty = 3000 },
                        new() { ZoneName = "VIP貴賓席",  Price = 8800, TotalQty = 150,  RemainingQty = 150  }
                    }
                }
            };

            db.Events.AddRange(events);
            db.SaveChanges();
        }

        if (!db.Users.Any())
        {
            db.Users.AddRange(new List<User>
            {
                new() {
                    Username = "testuser",
                    Email = "testuser@zzzticket.com",
                    PasswordHash = BCrypt.HashPassword("testuser123"),
                    Role = "ADMIN",
                    CreatedAt = DateTime.UtcNow,
                },
                new() {
                    Username = "jessie",
                    Email = "jessie@test.com",
                    PasswordHash = BCrypt.HashPassword("jessie123"),
                    Role = "USER",
                    CreatedAt = DateTime.UtcNow,
                }
            });
            db.SaveChanges();
        }
    }
}
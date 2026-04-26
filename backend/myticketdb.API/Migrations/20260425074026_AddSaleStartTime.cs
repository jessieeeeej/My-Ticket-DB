using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace myticketdb.API.Migrations
{
    /// <inheritdoc />
    public partial class AddSaleStartTime : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "SaleStartTime",
                table: "Events",
                type: "datetime(6)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SaleStartTime",
                table: "Events");
        }
    }
}

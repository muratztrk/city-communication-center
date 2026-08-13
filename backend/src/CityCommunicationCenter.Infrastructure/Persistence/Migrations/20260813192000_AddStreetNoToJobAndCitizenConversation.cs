using CityCommunicationCenter.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CityCommunicationCenter.Infrastructure.Persistence.Migrations;

[DbContext(typeof(CityCommunicationCenterDbContext))]
[Migration("20260813192000_AddStreetNoToJobAndCitizenConversation")]
public partial class AddStreetNoToJobAndCitizenConversation : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "streetno",
            table: "jobs",
            type: "text",
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "streetno",
            table: "citizenconversations",
            type: "text",
            nullable: true);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "streetno",
            table: "jobs");

        migrationBuilder.DropColumn(
            name: "streetno",
            table: "citizenconversations");
    }
}

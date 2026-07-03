using CityCommunicationCenter.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CityCommunicationCenter.Infrastructure.Persistence.Migrations;

[DbContext(typeof(CityCommunicationCenterDbContext))]
[Migration("20260703102000_AddCitizenConversationProfileFields")]
public partial class AddCitizenConversationProfileFields : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "label",
            table: "citizenconversations",
            type: "text",
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "neighborhood",
            table: "citizenconversations",
            type: "text",
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "openaddress",
            table: "citizenconversations",
            type: "text",
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "street",
            table: "citizenconversations",
            type: "text",
            nullable: true);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "label",
            table: "citizenconversations");

        migrationBuilder.DropColumn(
            name: "neighborhood",
            table: "citizenconversations");

        migrationBuilder.DropColumn(
            name: "openaddress",
            table: "citizenconversations");

        migrationBuilder.DropColumn(
            name: "street",
            table: "citizenconversations");
    }
}

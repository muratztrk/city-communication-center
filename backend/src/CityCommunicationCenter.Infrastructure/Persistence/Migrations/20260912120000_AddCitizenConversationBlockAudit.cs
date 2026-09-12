using CityCommunicationCenter.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CityCommunicationCenter.Infrastructure.Persistence.Migrations;

[DbContext(typeof(CityCommunicationCenterDbContext))]
[Migration("20260912120000_AddCitizenConversationBlockAudit")]
public partial class AddCitizenConversationBlockAudit : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<DateTimeOffset>(
            name: "blockedatutc",
            table: "citizenconversations",
            type: "timestamp with time zone",
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "blockedbydisplayname",
            table: "citizenconversations",
            type: "text",
            nullable: true);

        migrationBuilder.AddColumn<Guid>(
            name: "blockedbyuserid",
            table: "citizenconversations",
            type: "uuid",
            nullable: true);

        migrationBuilder.AddColumn<DateTimeOffset>(
            name: "unblockedatutc",
            table: "citizenconversations",
            type: "timestamp with time zone",
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "unblockedbydisplayname",
            table: "citizenconversations",
            type: "text",
            nullable: true);

        migrationBuilder.AddColumn<Guid>(
            name: "unblockedbyuserid",
            table: "citizenconversations",
            type: "uuid",
            nullable: true);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "blockedatutc",
            table: "citizenconversations");

        migrationBuilder.DropColumn(
            name: "blockedbydisplayname",
            table: "citizenconversations");

        migrationBuilder.DropColumn(
            name: "blockedbyuserid",
            table: "citizenconversations");

        migrationBuilder.DropColumn(
            name: "unblockedatutc",
            table: "citizenconversations");

        migrationBuilder.DropColumn(
            name: "unblockedbydisplayname",
            table: "citizenconversations");

        migrationBuilder.DropColumn(
            name: "unblockedbyuserid",
            table: "citizenconversations");
    }
}

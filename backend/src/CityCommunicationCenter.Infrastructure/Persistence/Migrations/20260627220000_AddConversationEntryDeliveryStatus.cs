using CityCommunicationCenter.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CityCommunicationCenter.Infrastructure.Persistence.Migrations;

[DbContext(typeof(CityCommunicationCenterDbContext))]
[Migration("20260627220000_AddConversationEntryDeliveryStatus")]
public partial class AddConversationEntryDeliveryStatus : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "deliverystatus",
            table: "socialconversationentries",
            type: "text",
            nullable: true);

        migrationBuilder.AddColumn<DateTimeOffset>(
            name: "deliverystatusupdatedatutc",
            table: "socialconversationentries",
            type: "timestamp with time zone",
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "deliveryerror",
            table: "socialconversationentries",
            type: "character varying(500)",
            maxLength: 500,
            nullable: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "deliverystatus",
            table: "socialconversationentries");

        migrationBuilder.DropColumn(
            name: "deliverystatusupdatedatutc",
            table: "socialconversationentries");

        migrationBuilder.DropColumn(
            name: "deliveryerror",
            table: "socialconversationentries");
    }
}

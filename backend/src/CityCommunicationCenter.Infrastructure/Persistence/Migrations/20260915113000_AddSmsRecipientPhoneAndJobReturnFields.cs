using CityCommunicationCenter.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CityCommunicationCenter.Infrastructure.Persistence.Migrations;

[DbContext(typeof(CityCommunicationCenterDbContext))]
[Migration("20260915113000_AddSmsRecipientPhoneAndJobReturnFields")]
public partial class AddSmsRecipientPhoneAndJobReturnFields : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "recipientphone",
            table: "smsoutboundlogs",
            type: "character varying(32)",
            maxLength: 32,
            nullable: true);

        migrationBuilder.AddColumn<DateTimeOffset>(
            name: "returnedtooperatoratutc",
            table: "jobs",
            type: "timestamp with time zone",
            nullable: true);

        migrationBuilder.AddColumn<Guid>(
            name: "returnedtooperatorbyuserid",
            table: "jobs",
            type: "uuid",
            nullable: true);

        migrationBuilder.AddColumn<Guid>(
            name: "returnedtooperatorfromdepartmentid",
            table: "jobs",
            type: "uuid",
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "returnedtooperatorreason",
            table: "jobs",
            type: "character varying(400)",
            maxLength: 400,
            nullable: true);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "recipientphone",
            table: "smsoutboundlogs");

        migrationBuilder.DropColumn(
            name: "returnedtooperatoratutc",
            table: "jobs");

        migrationBuilder.DropColumn(
            name: "returnedtooperatorbyuserid",
            table: "jobs");

        migrationBuilder.DropColumn(
            name: "returnedtooperatorfromdepartmentid",
            table: "jobs");

        migrationBuilder.DropColumn(
            name: "returnedtooperatorreason",
            table: "jobs");
    }
}

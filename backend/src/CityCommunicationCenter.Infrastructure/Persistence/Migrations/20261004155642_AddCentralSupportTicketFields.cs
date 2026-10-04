using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CityCommunicationCenter.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCentralSupportTicketFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "centralstatus",
                table: "supportrequests",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "centralsyncedatutc",
                table: "supportrequests",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "centralsyncerror",
                table: "supportrequests",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "centralticketno",
                table: "supportrequests",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "centralstatus",
                table: "supportrequests");

            migrationBuilder.DropColumn(
                name: "centralsyncedatutc",
                table: "supportrequests");

            migrationBuilder.DropColumn(
                name: "centralsyncerror",
                table: "supportrequests");

            migrationBuilder.DropColumn(
                name: "centralticketno",
                table: "supportrequests");
        }
    }
}

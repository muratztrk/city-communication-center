using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CityCommunicationCenter.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddJobAddressFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "neighborhood",
                table: "jobs",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "openaddress",
                table: "jobs",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "street",
                table: "jobs",
                type: "text",
                nullable: true);

            migrationBuilder.UpdateData(
                table: "jobs",
                keyColumn: "jobid",
                keyValue: new Guid("9a5b3f2e-6c1a-4b0d-8e7f-2d3c4b5a6987"),
                columns: new[] { "neighborhood", "openaddress", "street" },
                values: new object[] { null, null, null });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "neighborhood",
                table: "jobs");

            migrationBuilder.DropColumn(
                name: "openaddress",
                table: "jobs");

            migrationBuilder.DropColumn(
                name: "street",
                table: "jobs");
        }
    }
}

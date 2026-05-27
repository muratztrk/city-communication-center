using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CityCommunicationCenter.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddLocationFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "latitude",
                table: "socialmessages",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "longitude",
                table: "socialmessages",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "latitude",
                table: "jobs",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "longitude",
                table: "jobs",
                type: "double precision",
                nullable: true);

            migrationBuilder.UpdateData(
                table: "jobs",
                keyColumn: "jobid",
                keyValue: new Guid("9a5b3f2e-6c1a-4b0d-8e7f-2d3c4b5a6987"),
                columns: new[] { "latitude", "longitude" },
                values: new object[] { null, null });

            migrationBuilder.UpdateData(
                table: "socialmessages",
                keyColumn: "socialmessageid",
                keyValue: new Guid("8e90888d-dc75-4264-a78b-f0a7abc9a9ab"),
                columns: new[] { "latitude", "longitude" },
                values: new object[] { null, null });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "latitude",
                table: "socialmessages");

            migrationBuilder.DropColumn(
                name: "longitude",
                table: "socialmessages");

            migrationBuilder.DropColumn(
                name: "latitude",
                table: "jobs");

            migrationBuilder.DropColumn(
                name: "longitude",
                table: "jobs");
        }
    }
}

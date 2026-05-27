using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CityCommunicationCenter.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddJobTaskSequenceNumbers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "tasknumber",
                table: "tasks",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "tasknumberyear",
                table: "tasks",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "jobnumber",
                table: "jobs",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "jobnumberyear",
                table: "jobs",
                type: "integer",
                nullable: true);

            migrationBuilder.UpdateData(
                table: "jobs",
                keyColumn: "jobid",
                keyValue: new Guid("9a5b3f2e-6c1a-4b0d-8e7f-2d3c4b5a6987"),
                columns: new[] { "jobnumber", "jobnumberyear" },
                values: new object[] { null, null });

            migrationBuilder.UpdateData(
                table: "tasks",
                keyColumn: "taskid",
                keyValue: new Guid("6de6e0b3-a74e-4f24-bdbc-4d6e0cb6d38c"),
                columns: new[] { "tasknumber", "tasknumberyear" },
                values: new object[] { null, null });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "tasknumber",
                table: "tasks");

            migrationBuilder.DropColumn(
                name: "tasknumberyear",
                table: "tasks");

            migrationBuilder.DropColumn(
                name: "jobnumber",
                table: "jobs");

            migrationBuilder.DropColumn(
                name: "jobnumberyear",
                table: "jobs");
        }
    }
}

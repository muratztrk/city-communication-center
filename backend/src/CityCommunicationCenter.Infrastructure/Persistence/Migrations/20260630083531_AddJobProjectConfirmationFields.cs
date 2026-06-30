using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CityCommunicationCenter.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddJobProjectConfirmationFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "isprojectcreatorrequested",
                table: "jobs",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "isprojectownerconfirmed",
                table: "jobs",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.UpdateData(
                table: "jobs",
                keyColumn: "jobid",
                keyValue: new Guid("9a5b3f2e-6c1a-4b0d-8e7f-2d3c4b5a6987"),
                columns: new[] { "isprojectcreatorrequested", "isprojectownerconfirmed" },
                values: new object[] { false, false });

            migrationBuilder.Sql("""
                UPDATE jobs
                SET isprojectownerconfirmed = TRUE
                WHERE status NOT IN ('PendingOwnerApproval', 'Draft', 'RevisionRequested');
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "isprojectcreatorrequested",
                table: "jobs");

            migrationBuilder.DropColumn(
                name: "isprojectownerconfirmed",
                table: "jobs");
        }
    }
}

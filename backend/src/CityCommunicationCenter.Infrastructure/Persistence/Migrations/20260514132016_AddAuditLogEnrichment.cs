using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CityCommunicationCenter.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddAuditLogEnrichment : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "actordisplayname",
                table: "auditlogs",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "departmentname",
                table: "auditlogs",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "notes",
                table: "auditlogs",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "statusatevent",
                table: "auditlogs",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "actordisplayname",
                table: "auditlogs");

            migrationBuilder.DropColumn(
                name: "departmentname",
                table: "auditlogs");

            migrationBuilder.DropColumn(
                name: "notes",
                table: "auditlogs");

            migrationBuilder.DropColumn(
                name: "statusatevent",
                table: "auditlogs");
        }
    }
}

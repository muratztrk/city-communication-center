using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CityCommunicationCenter.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddJobRequestMetadata : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "requesttype",
                table: "jobs",
                type: "text",
                nullable: false,
                defaultValue: "InternalUnit");

            migrationBuilder.AddColumn<bool>(
                name: "isproject",
                table: "jobs",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "citizenname",
                table: "jobs",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "citizenphone",
                table: "jobs",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "requesttype",
                table: "jobs");

            migrationBuilder.DropColumn(
                name: "isproject",
                table: "jobs");

            migrationBuilder.DropColumn(
                name: "citizenname",
                table: "jobs");

            migrationBuilder.DropColumn(
                name: "citizenphone",
                table: "jobs");
        }
    }
}

using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CityCommunicationCenter.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddWhatsAppTemplateTimedReply : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "activedaysjson",
                table: "whatsapptemplates",
                type: "text",
                nullable: false,
                defaultValue: "[\"monday\",\"tuesday\",\"wednesday\",\"thursday\",\"friday\",\"saturday\",\"sunday\"]");

            migrationBuilder.AddColumn<bool>(
                name: "timedreplyenabled",
                table: "whatsapptemplates",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "timedreplyendtime",
                table: "whatsapptemplates",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "timedreplystarttime",
                table: "whatsapptemplates",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "activedaysjson",
                table: "whatsapptemplates");

            migrationBuilder.DropColumn(
                name: "timedreplyenabled",
                table: "whatsapptemplates");

            migrationBuilder.DropColumn(
                name: "timedreplyendtime",
                table: "whatsapptemplates");

            migrationBuilder.DropColumn(
                name: "timedreplystarttime",
                table: "whatsapptemplates");
        }
    }
}

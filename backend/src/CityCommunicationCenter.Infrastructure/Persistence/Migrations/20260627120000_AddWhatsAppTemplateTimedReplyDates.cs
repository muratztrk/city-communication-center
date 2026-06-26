using CityCommunicationCenter.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CityCommunicationCenter.Infrastructure.Persistence.Migrations;

[DbContext(typeof(CityCommunicationCenterDbContext))]
[Migration("20260627120000_AddWhatsAppTemplateTimedReplyDates")]
public partial class AddWhatsAppTemplateTimedReplyDates : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "timedreplyenddate",
            table: "whatsapptemplates",
            type: "text",
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "timedreplystartdate",
            table: "whatsapptemplates",
            type: "text",
            nullable: true);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "timedreplyenddate",
            table: "whatsapptemplates");

        migrationBuilder.DropColumn(
            name: "timedreplystartdate",
            table: "whatsapptemplates");
    }
}

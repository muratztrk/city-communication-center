using CityCommunicationCenter.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CityCommunicationCenter.Infrastructure.Persistence.Migrations;

[DbContext(typeof(CityCommunicationCenterDbContext))]
[Migration("20260711193000_AddWhatsAppMetaTemplateFields")]
public partial class AddWhatsAppMetaTemplateFields : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "metalanguagecode",
            table: "whatsapptemplates",
            type: "character varying(20)",
            maxLength: 20,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "metaexternalid",
            table: "whatsapptemplates",
            type: "character varying(64)",
            maxLength: 64,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "metastatus",
            table: "whatsapptemplates",
            type: "character varying(32)",
            maxLength: 32,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "whatsapptemplatename",
            table: "socialconversationentries",
            type: "character varying(512)",
            maxLength: 512,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "whatsapptemplatelanguage",
            table: "socialconversationentries",
            type: "character varying(20)",
            maxLength: 20,
            nullable: true);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "metalanguagecode",
            table: "whatsapptemplates");

        migrationBuilder.DropColumn(
            name: "metaexternalid",
            table: "whatsapptemplates");

        migrationBuilder.DropColumn(
            name: "metastatus",
            table: "whatsapptemplates");

        migrationBuilder.DropColumn(
            name: "whatsapptemplatename",
            table: "socialconversationentries");

        migrationBuilder.DropColumn(
            name: "whatsapptemplatelanguage",
            table: "socialconversationentries");
    }
}

using CityCommunicationCenter.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CityCommunicationCenter.Infrastructure.Persistence.Migrations;

[DbContext(typeof(CityCommunicationCenterDbContext))]
[Migration("20261014130000_AddCitizenConversationWhatsAppIdentity")]
public partial class AddCitizenConversationWhatsAppIdentity : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "whatsappprofilename",
            table: "citizenconversations",
            type: "text",
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "whatsappusername",
            table: "citizenconversations",
            type: "text",
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "whatsappuserid",
            table: "citizenconversations",
            type: "text",
            nullable: true);

        migrationBuilder.DropIndex(
            name: "ix_citizenconversations_tenant_phone_unique",
            table: "citizenconversations");

        migrationBuilder.Sql(
            """
            UPDATE citizenconversations
            SET whatsappuserid = citizenphone,
                whatsappprofilename = COALESCE(whatsappprofilename, NULLIF(citizenname, '')),
                citizenphone = ''
            WHERE citizenphone ~ '^[A-Za-z]{2}\.[A-Za-z0-9.]+$';
            """);

        migrationBuilder.CreateIndex(
            name: "ix_citizenconversations_tenant_phone_unique",
            table: "citizenconversations",
            columns: new[] { "tenantid", "citizenphone" },
            unique: true,
            filter: "citizenphone <> ''");

        migrationBuilder.CreateIndex(
            name: "ix_citizenconversations_tenant_whatsappuserid_unique",
            table: "citizenconversations",
            columns: new[] { "tenantid", "whatsappuserid" },
            unique: true,
            filter: "whatsappuserid IS NOT NULL");
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            UPDATE citizenconversations
            SET citizenphone = whatsappuserid
            WHERE citizenphone = ''
              AND whatsappuserid IS NOT NULL;
            """);

        migrationBuilder.DropIndex(
            name: "ix_citizenconversations_tenant_whatsappuserid_unique",
            table: "citizenconversations");

        migrationBuilder.DropIndex(
            name: "ix_citizenconversations_tenant_phone_unique",
            table: "citizenconversations");

        migrationBuilder.CreateIndex(
            name: "ix_citizenconversations_tenant_phone_unique",
            table: "citizenconversations",
            columns: new[] { "tenantid", "citizenphone" },
            unique: true);

        migrationBuilder.DropColumn(
            name: "whatsappuserid",
            table: "citizenconversations");

        migrationBuilder.DropColumn(
            name: "whatsappusername",
            table: "citizenconversations");

        migrationBuilder.DropColumn(
            name: "whatsappprofilename",
            table: "citizenconversations");
    }
}

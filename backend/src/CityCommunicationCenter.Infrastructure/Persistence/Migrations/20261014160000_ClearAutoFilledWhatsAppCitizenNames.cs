using CityCommunicationCenter.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CityCommunicationCenter.Infrastructure.Persistence.Migrations;

[DbContext(typeof(CityCommunicationCenterDbContext))]
[Migration("20261014160000_ClearAutoFilledWhatsAppCitizenNames")]
public partial class ClearAutoFilledWhatsAppCitizenNames : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        // Telefonsuz hesapta profil adı Vatandaş Adı kutusuna kopyalanmıştı (#4209).
        // Operatörün sonradan kaydettiği ad, telefon doluysa durur.
        migrationBuilder.Sql(
            """
            UPDATE citizenconversations
            SET whatsappuserid = COALESCE(NULLIF(whatsappuserid, ''), citizenphone),
                citizenphone = ''
            WHERE citizenphone ~ '^[A-Za-z]{2}\.[A-Za-z0-9.]+$';

            UPDATE citizenconversations
            SET citizenname = NULL
            WHERE COALESCE(citizenphone, '') = ''
              AND whatsappprofilename IS NOT NULL
              AND citizenname = whatsappprofilename;
            """);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
    }
}

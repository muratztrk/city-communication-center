using CityCommunicationCenter.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CityCommunicationCenter.Infrastructure.Persistence.Migrations;

[DbContext(typeof(CityCommunicationCenterDbContext))]
[Migration("20260922130000_RewriteReviewedNotificationEnding")]
public partial class RewriteReviewedNotificationEnding : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        // #6ab26637: mevcut "Mesaj incelendi" satırlarının bitişi de yeni cümleyle aynı olsun.
        migrationBuilder.Sql("""
            UPDATE notifications
            SET message = replace(message, 'incelemesi tamamlandı.', 'incelendi.')
            WHERE title = 'Mesaj incelendi'
              AND message LIKE '%incelemesi tamamlandı.%';
            """);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
    }
}

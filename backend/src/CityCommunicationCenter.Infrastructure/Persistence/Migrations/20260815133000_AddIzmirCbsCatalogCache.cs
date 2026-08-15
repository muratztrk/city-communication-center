using CityCommunicationCenter.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CityCommunicationCenter.Infrastructure.Persistence.Migrations;

[DbContext(typeof(CityCommunicationCenterDbContext))]
[Migration("20260815133000_AddIzmirCbsCatalogCache")]
public partial class AddIzmirCbsCatalogCache : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "izmircbscatalogcache",
            columns: table => new
            {
                cachekey = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                payloadjson = table.Column<string>(type: "text", nullable: false),
                updatedatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_izmircbscatalogcache", x => x.cachekey);
            });
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "izmircbscatalogcache");
    }
}

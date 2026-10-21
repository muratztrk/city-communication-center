using CityCommunicationCenter.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CityCommunicationCenter.Infrastructure.Persistence.Migrations;

[DbContext(typeof(CityCommunicationCenterDbContext))]
[Migration("20261021180000_AddEDevletBasvuruCitizenNotes")]
public partial class AddEDevletBasvuruCitizenNotes : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "citizennotesjson",
            table: "edevletbasvurular",
            type: "text",
            nullable: true);

        migrationBuilder.AddColumn<DateTimeOffset>(
            name: "reopenedatutc",
            table: "edevletbasvurular",
            type: "timestamp with time zone",
            nullable: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "citizennotesjson",
            table: "edevletbasvurular");

        migrationBuilder.DropColumn(
            name: "reopenedatutc",
            table: "edevletbasvurular");
    }
}

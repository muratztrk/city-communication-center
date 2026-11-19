using CityCommunicationCenter.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CityCommunicationCenter.Infrastructure.Persistence.Migrations;

[DbContext(typeof(CityCommunicationCenterDbContext))]
[Migration("20261112210000_AddUserLastSuccessfulLoginAtUtc")]
public partial class AddUserLastSuccessfulLoginAtUtc : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<DateTimeOffset>(
            name: "lastsuccessfulloginatutc",
            table: "users",
            type: "timestamp with time zone",
            nullable: true);

        migrationBuilder.Sql(
            """
            UPDATE users AS u
            SET lastsuccessfulloginatutc = latest.eventtimeutc
            FROM (
                SELECT actoruserid, MAX(eventtimeutc) AS eventtimeutc
                FROM auditlogs
                WHERE action = 'Login' AND actoruserid IS NOT NULL
                GROUP BY actoruserid
            ) AS latest
            WHERE u.userid = latest.actoruserid;
            """);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "lastsuccessfulloginatutc",
            table: "users");
    }
}

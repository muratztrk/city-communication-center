using System;
using CityCommunicationCenter.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CityCommunicationCenter.Infrastructure.Persistence.Migrations;

[DbContext(typeof(CityCommunicationCenterDbContext))]
[Migration("20261005203500_AddSupportRequestResolvedAtUtc")]
public partial class AddSupportRequestResolvedAtUtc : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<DateTimeOffset>(
            name: "resolvedatutc",
            table: "supportrequests",
            type: "timestamp with time zone",
            nullable: true);

        migrationBuilder.Sql("""
            UPDATE supportrequests
            SET resolvedatutc = COALESCE(updatedatutc, centralsyncedatutc, createdatutc)
            WHERE resolvedatutc IS NULL
              AND lower(coalesce(centralstatus, '')) = 'resolved';
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "resolvedatutc",
            table: "supportrequests");
    }
}

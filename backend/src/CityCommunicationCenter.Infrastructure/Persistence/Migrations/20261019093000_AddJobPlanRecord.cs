using CityCommunicationCenter.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CityCommunicationCenter.Infrastructure.Persistence.Migrations;

[DbContext(typeof(CityCommunicationCenterDbContext))]
[Migration("20261019093000_AddJobPlanRecord")]
public partial class AddJobPlanRecord : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<DateTimeOffset>(
            name: "planrecordedatutc",
            table: "jobs",
            type: "timestamp with time zone",
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "plannedbydisplayname",
            table: "jobs",
            type: "text",
            nullable: true);

        migrationBuilder.Sql(
            """
            UPDATE jobs AS j
            SET planrecordedatutc = j.plannedatutc,
                plannedbydisplayname = u.displayname
            FROM users AS u
            WHERE j.plannedatutc IS NOT NULL
              AND u.userid = j.updatedbyuserid;

            UPDATE jobs
            SET planrecordedatutc = plannedatutc
            WHERE plannedatutc IS NOT NULL
              AND planrecordedatutc IS NULL;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "planrecordedatutc",
            table: "jobs");

        migrationBuilder.DropColumn(
            name: "plannedbydisplayname",
            table: "jobs");
    }
}

using System;
using CityCommunicationCenter.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CityCommunicationCenter.Infrastructure.Persistence.Migrations;

[DbContext(typeof(CityCommunicationCenterDbContext))]
[Migration("20261005173000_AddDepartmentReviewTargetOpenedAtUtc")]
public partial class AddDepartmentReviewTargetOpenedAtUtc : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<DateTimeOffset>(
            name: "targetdepartmentopenedatutc",
            table: "citizenconversationdepartmentreviews",
            type: "timestamp with time zone",
            nullable: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "targetdepartmentopenedatutc",
            table: "citizenconversationdepartmentreviews");
    }
}

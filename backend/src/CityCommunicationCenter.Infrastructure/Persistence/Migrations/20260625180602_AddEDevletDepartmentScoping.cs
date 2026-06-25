using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CityCommunicationCenter.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddEDevletDepartmentScoping : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "departmentid",
                table: "edevletdailyactivityplans",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<int>(
                name: "plannumber",
                table: "edevletdailyactivityplans",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "plannumberyear",
                table: "edevletdailyactivityplans",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "status",
                table: "edevletdailyactivityplans",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "Active");

            migrationBuilder.AddColumn<Guid>(
                name: "departmentid",
                table: "edevletactivitytypes",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.Sql("""
                UPDATE edevletactivitytypes AS t
                SET departmentid = u.departmentid
                FROM users AS u
                WHERE t.createdbyuserid = u.userid
                  AND t.departmentid = '00000000-0000-0000-0000-000000000000';

                UPDATE edevletactivitytypes AS t
                SET departmentid = d.departmentid
                FROM (
                    SELECT DISTINCT ON (tenantid) tenantid, departmentid
                    FROM departments
                    ORDER BY tenantid, departmentid
                ) AS d
                WHERE t.tenantid = d.tenantid
                  AND t.departmentid = '00000000-0000-0000-0000-000000000000';

                UPDATE edevletdailyactivityplans AS p
                SET departmentid = u.departmentid
                FROM users AS u
                WHERE p.createdbyuserid = u.userid
                  AND p.departmentid = '00000000-0000-0000-0000-000000000000';

                UPDATE edevletdailyactivityplans AS p
                SET departmentid = d.departmentid
                FROM (
                    SELECT DISTINCT ON (tenantid) tenantid, departmentid
                    FROM departments
                    ORDER BY tenantid, departmentid
                ) AS d
                WHERE p.tenantid = d.tenantid
                  AND p.departmentid = '00000000-0000-0000-0000-000000000000';

                UPDATE edevletdailyactivityplans
                SET status = 'Active'
                WHERE status = '' OR status IS NULL;
                """);

            migrationBuilder.CreateIndex(
                name: "IX_edevletdailyactivityplans_tenantid_departmentid",
                table: "edevletdailyactivityplans",
                columns: new[] { "tenantid", "departmentid" });

            migrationBuilder.CreateIndex(
                name: "IX_edevletactivitytypes_tenantid_departmentid",
                table: "edevletactivitytypes",
                columns: new[] { "tenantid", "departmentid" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_edevletdailyactivityplans_tenantid_departmentid",
                table: "edevletdailyactivityplans");

            migrationBuilder.DropIndex(
                name: "IX_edevletactivitytypes_tenantid_departmentid",
                table: "edevletactivitytypes");

            migrationBuilder.DropColumn(
                name: "departmentid",
                table: "edevletdailyactivityplans");

            migrationBuilder.DropColumn(
                name: "plannumber",
                table: "edevletdailyactivityplans");

            migrationBuilder.DropColumn(
                name: "plannumberyear",
                table: "edevletdailyactivityplans");

            migrationBuilder.DropColumn(
                name: "status",
                table: "edevletdailyactivityplans");

            migrationBuilder.DropColumn(
                name: "departmentid",
                table: "edevletactivitytypes");
        }
    }
}

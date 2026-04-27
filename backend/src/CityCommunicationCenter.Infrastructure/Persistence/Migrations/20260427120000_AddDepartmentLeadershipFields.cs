using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Infrastructure;

#nullable disable

namespace CityCommunicationCenter.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(CityCommunicationCenterDbContext))]
    [Migration("20260427120000_AddDepartmentLeadershipFields")]
    public partial class AddDepartmentLeadershipFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "deputymanageruserid",
                table: "departments",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "responsibleuseridsjson",
                table: "departments",
                type: "text",
                nullable: false,
                defaultValue: "[]");

            migrationBuilder.CreateIndex(
                name: "ix_departments_tenantid_deputymanageruserid",
                table: "departments",
                columns: new[] { "tenantid", "deputymanageruserid" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_departments_tenantid_deputymanageruserid",
                table: "departments");

            migrationBuilder.DropColumn(
                name: "deputymanageruserid",
                table: "departments");

            migrationBuilder.DropColumn(
                name: "responsibleuseridsjson",
                table: "departments");
        }
    }
}

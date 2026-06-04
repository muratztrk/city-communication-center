using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CityCommunicationCenter.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSyslogSettingsJson : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "syslogsettingsjson",
                table: "tenantsettings",
                type: "text",
                nullable: true);

            migrationBuilder.UpdateData(
                table: "tenantsettings",
                keyColumn: "tenantsettingid",
                keyValue: new Guid("3f3efab4-c18c-4dd2-a227-c28af61d4fd5"),
                column: "syslogsettingsjson",
                value: null);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "syslogsettingsjson",
                table: "tenantsettings");
        }
    }
}

using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CityCommunicationCenter.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTenantScopedLdapAndUserSource : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "username",
                table: "users",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "usersource",
                table: "users",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ldapsettingsjson",
                table: "tenantsettings",
                type: "text",
                nullable: true);

            migrationBuilder.UpdateData(
                table: "tenantsettings",
                keyColumn: "tenantsettingid",
                keyValue: new Guid("3f3efab4-c18c-4dd2-a227-c28af61d4fd5"),
                column: "ldapsettingsjson",
                value: "{\"enabled\":true,\"autoProvisionUsers\":false,\"domain\":\"tire.bel.tr\",\"userAttribute\":\"mail\"}");

            migrationBuilder.UpdateData(
                table: "users",
                keyColumn: "userid",
                keyValue: new Guid("1358d4aa-b1ae-486c-a1db-a757ea18f2c3"),
                columns: new[] { "usersource", "username" },
                values: new object[] { "Manual", null });

            migrationBuilder.UpdateData(
                table: "users",
                keyColumn: "userid",
                keyValue: new Guid("1e96916a-889a-4701-a0e6-71dc6571ac18"),
                columns: new[] { "usersource", "username" },
                values: new object[] { "Manual", null });

            migrationBuilder.UpdateData(
                table: "users",
                keyColumn: "userid",
                keyValue: new Guid("4b1efb47-0311-4ef7-9a0c-f4c41dcb8b48"),
                columns: new[] { "usersource", "username" },
                values: new object[] { "Manual", null });

            migrationBuilder.UpdateData(
                table: "users",
                keyColumn: "userid",
                keyValue: new Guid("d6fc7a5b-5cb2-4c59-8a82-7843041421a5"),
                columns: new[] { "usersource", "username" },
                values: new object[] { "Manual", null });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "username",
                table: "users");

            migrationBuilder.DropColumn(
                name: "usersource",
                table: "users");

            migrationBuilder.DropColumn(
                name: "ldapsettingsjson",
                table: "tenantsettings");
        }
    }
}

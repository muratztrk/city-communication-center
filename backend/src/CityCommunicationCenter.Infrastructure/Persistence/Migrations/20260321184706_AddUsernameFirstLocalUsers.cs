using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CityCommunicationCenter.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddUsernameFirstLocalUsers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_users_tenantid",
                table: "users");

            migrationBuilder.UpdateData(
                table: "users",
                keyColumn: "userid",
                keyValue: new Guid("1358d4aa-b1ae-486c-a1db-a757ea18f2c3"),
                column: "username",
                value: "emre.celik");

            migrationBuilder.UpdateData(
                table: "users",
                keyColumn: "userid",
                keyValue: new Guid("1e96916a-889a-4701-a0e6-71dc6571ac18"),
                column: "username",
                value: "ali.yildiz");

            migrationBuilder.UpdateData(
                table: "users",
                keyColumn: "userid",
                keyValue: new Guid("4b1efb47-0311-4ef7-9a0c-f4c41dcb8b48"),
                column: "username",
                value: "admin");

            migrationBuilder.UpdateData(
                table: "users",
                keyColumn: "userid",
                keyValue: new Guid("d6fc7a5b-5cb2-4c59-8a82-7843041421a5"),
                column: "username",
                value: "zeynep.kara");

            migrationBuilder.CreateIndex(
                name: "IX_users_tenantid_username",
                table: "users",
                columns: new[] { "tenantid", "username" },
                unique: true,
                filter: "username IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_users_tenantid_username",
                table: "users");

            migrationBuilder.UpdateData(
                table: "users",
                keyColumn: "userid",
                keyValue: new Guid("1358d4aa-b1ae-486c-a1db-a757ea18f2c3"),
                column: "username",
                value: null);

            migrationBuilder.UpdateData(
                table: "users",
                keyColumn: "userid",
                keyValue: new Guid("1e96916a-889a-4701-a0e6-71dc6571ac18"),
                column: "username",
                value: null);

            migrationBuilder.UpdateData(
                table: "users",
                keyColumn: "userid",
                keyValue: new Guid("4b1efb47-0311-4ef7-9a0c-f4c41dcb8b48"),
                column: "username",
                value: null);

            migrationBuilder.UpdateData(
                table: "users",
                keyColumn: "userid",
                keyValue: new Guid("d6fc7a5b-5cb2-4c59-8a82-7843041421a5"),
                column: "username",
                value: null);

            migrationBuilder.CreateIndex(
                name: "IX_users_tenantid",
                table: "users",
                column: "tenantid");
        }
    }
}

using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CityCommunicationCenter.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddAdaptiveTenantAuthentication : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "authpolicyjson",
                table: "tenantsettings",
                type: "text",
                nullable: true);

            migrationBuilder.UpdateData(
                table: "tenantsettings",
                keyColumn: "tenantsettingid",
                keyValue: new Guid("3f3efab4-c18c-4dd2-a227-c28af61d4fd5"),
                column: "authpolicyjson",
                value: "{\"automaticSignInEnabled\":true,\"automaticSignInMode\":\"TrustedHeader\",\"trustedNetworkCidrs\":[\"127.0.0.1/32\",\"::1/128\",\"10.0.0.0/8\",\"172.16.0.0/12\",\"192.168.0.0/16\"],\"trustedProxyCidrs\":[\"127.0.0.1/32\",\"::1/128\",\"10.0.0.0/8\",\"172.16.0.0/12\",\"192.168.0.0/16\"],\"identityHeaderName\":\"X-Authenticated-User\",\"requireSecondFactorOutsideTrustedNetwork\":true,\"secondFactorProvider\":\"Mock\",\"codeLength\":6,\"codeTtlSeconds\":300,\"allowMockCodePreview\":true}");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "authpolicyjson",
                table: "tenantsettings");
        }
    }
}

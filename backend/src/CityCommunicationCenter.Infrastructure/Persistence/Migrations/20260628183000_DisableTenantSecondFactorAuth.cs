using CityCommunicationCenter.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CityCommunicationCenter.Infrastructure.Persistence.Migrations;

[DbContext(typeof(CityCommunicationCenterDbContext))]
[Migration("20260628183000_DisableTenantSecondFactorAuth")]
public partial class DisableTenantSecondFactorAuth : Migration
{
    private const string DisabledAuthPolicyJson =
        "{\"automaticSignInEnabled\":true,\"automaticSignInMode\":\"TrustedHeader\",\"trustedNetworkCidrs\":[\"127.0.0.1/32\",\"::1/128\",\"10.0.0.0/8\",\"172.16.0.0/12\",\"192.168.0.0/16\"],\"trustedProxyCidrs\":[\"127.0.0.1/32\",\"::1/128\",\"10.0.0.0/8\",\"172.16.0.0/12\",\"192.168.0.0/16\"],\"identityHeaderName\":\"X-Authenticated-User\",\"requireSecondFactorOutsideTrustedNetwork\":false,\"secondFactorProvider\":\"Disabled\",\"codeLength\":6,\"codeTtlSeconds\":300,\"allowMockCodePreview\":false}";

    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.UpdateData(
            table: "tenantsettings",
            keyColumn: "tenantsettingid",
            keyValue: InitialData.TenantSettingId,
            column: "authpolicyjson",
            value: DisabledAuthPolicyJson);

        migrationBuilder.Sql("""
            UPDATE tenantsettings
            SET authpolicyjson = REPLACE(
                REPLACE(
                    REPLACE(authpolicyjson, '"requireSecondFactorOutsideTrustedNetwork":true', '"requireSecondFactorOutsideTrustedNetwork":false'),
                    '"secondFactorProvider":"Mock"', '"secondFactorProvider":"Disabled"'),
                '"allowMockCodePreview":true', '"allowMockCodePreview":false')
            WHERE authpolicyjson IS NOT NULL
              AND authpolicyjson LIKE '%"requireSecondFactorOutsideTrustedNetwork":true%';
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        const string enabledAuthPolicyJson =
            "{\"automaticSignInEnabled\":true,\"automaticSignInMode\":\"TrustedHeader\",\"trustedNetworkCidrs\":[\"127.0.0.1/32\",\"::1/128\",\"10.0.0.0/8\",\"172.16.0.0/12\",\"192.168.0.0/16\"],\"trustedProxyCidrs\":[\"127.0.0.1/32\",\"::1/128\",\"10.0.0.0/8\",\"172.16.0.0/12\",\"192.168.0.0/16\"],\"identityHeaderName\":\"X-Authenticated-User\",\"requireSecondFactorOutsideTrustedNetwork\":true,\"secondFactorProvider\":\"Mock\",\"codeLength\":6,\"codeTtlSeconds\":300,\"allowMockCodePreview\":true}";

        migrationBuilder.UpdateData(
            table: "tenantsettings",
            keyColumn: "tenantsettingid",
            keyValue: InitialData.TenantSettingId,
            column: "authpolicyjson",
            value: enabledAuthPolicyJson);
    }
}

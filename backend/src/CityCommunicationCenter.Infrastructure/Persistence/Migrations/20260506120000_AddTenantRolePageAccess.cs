using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CityCommunicationCenter.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(CityCommunicationCenterDbContext))]
    [Migration("20260506120000_AddTenantRolePageAccess")]
    public partial class AddTenantRolePageAccess : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "rolepageaccessjson",
                table: "tenantsettings",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "rolepageaccessjson",
                table: "tenantsettings");
        }
    }
}

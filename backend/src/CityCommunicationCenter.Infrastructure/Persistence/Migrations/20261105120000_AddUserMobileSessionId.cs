using CityCommunicationCenter.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CityCommunicationCenter.Infrastructure.Persistence.Migrations;

[DbContext(typeof(CityCommunicationCenterDbContext))]
[Migration("20261105120000_AddUserMobileSessionId")]
public partial class AddUserMobileSessionId : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<Guid>(
            name: "mobilesessionid",
            table: "users",
            type: "uuid",
            nullable: true);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "mobilesessionid",
            table: "users");
    }
}

using CityCommunicationCenter.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CityCommunicationCenter.Infrastructure.Persistence.Migrations;

[DbContext(typeof(CityCommunicationCenterDbContext))]
[Migration("20260629120000_AddUserQuickReplyTemplates")]
public partial class AddUserQuickReplyTemplates : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "userquickreplytemplates",
            columns: table => new
            {
                templateid = table.Column<Guid>(type: "uuid", nullable: false),
                userid = table.Column<Guid>(type: "uuid", nullable: false),
                name = table.Column<string>(type: "text", nullable: false),
                content = table.Column<string>(type: "text", nullable: false),
                tenantid = table.Column<Guid>(type: "uuid", nullable: false),
                createdatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                createdbyuserid = table.Column<Guid>(type: "uuid", nullable: true),
                updatedatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                updatedbyuserid = table.Column<Guid>(type: "uuid", nullable: true),
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_userquickreplytemplates", x => x.templateid);
                table.ForeignKey(
                    name: "FK_userquickreplytemplates_tenants_tenantid",
                    column: x => x.tenantid,
                    principalTable: "tenants",
                    principalColumn: "tenantid",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex(
            name: "IX_userquickreplytemplates_tenantid_userid",
            table: "userquickreplytemplates",
            columns: new[] { "tenantid", "userid" });
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "userquickreplytemplates");
    }
}

using CityCommunicationCenter.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CityCommunicationCenter.Infrastructure.Persistence.Migrations;

[DbContext(typeof(CityCommunicationCenterDbContext))]
[Migration("20260929180000_AddMailOutboundLogs")]
public partial class AddMailOutboundLogs : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "mailoutboundlogs",
            columns: table => new
            {
                mailoutboundlogid = table.Column<Guid>(type: "uuid", nullable: false),
                kind = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                recipientemail = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                recipientuserid = table.Column<Guid>(type: "uuid", nullable: true),
                jobid = table.Column<Guid>(type: "uuid", nullable: true),
                taskid = table.Column<Guid>(type: "uuid", nullable: true),
                requestnumber = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                subject = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                success = table.Column<bool>(type: "boolean", nullable: false),
                errormessage = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                textlength = table.Column<int>(type: "integer", nullable: false),
                bodypreview = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                tenantid = table.Column<Guid>(type: "uuid", nullable: false),
                createdatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                createdbyuserid = table.Column<Guid>(type: "uuid", nullable: true),
                updatedatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                updatedbyuserid = table.Column<Guid>(type: "uuid", nullable: true),
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_mailoutboundlogs", x => x.mailoutboundlogid);
            });

        migrationBuilder.CreateIndex(
            name: "IX_mailoutboundlogs_tenantid_createdatutc",
            table: "mailoutboundlogs",
            columns: new[] { "tenantid", "createdatutc" });

        migrationBuilder.CreateIndex(
            name: "IX_mailoutboundlogs_tenantid_jobid",
            table: "mailoutboundlogs",
            columns: new[] { "tenantid", "jobid" });

        migrationBuilder.CreateIndex(
            name: "IX_mailoutboundlogs_tenantid_kind_createdatutc",
            table: "mailoutboundlogs",
            columns: new[] { "tenantid", "kind", "createdatutc" });
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "mailoutboundlogs");
    }
}

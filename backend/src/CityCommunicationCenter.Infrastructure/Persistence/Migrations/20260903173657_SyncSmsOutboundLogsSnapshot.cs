using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CityCommunicationCenter.Infrastructure.Persistence.Migrations;

public partial class SyncSmsOutboundLogsSnapshot : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "smsoutboundlogs",
            columns: table => new
            {
                smsoutboundlogid = table.Column<Guid>(type: "uuid", nullable: false),
                kind = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                recipientphonemasked = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                recipientuserid = table.Column<Guid>(type: "uuid", nullable: true),
                jobid = table.Column<Guid>(type: "uuid", nullable: true),
                socialmessageid = table.Column<Guid>(type: "uuid", nullable: true),
                taskid = table.Column<Guid>(type: "uuid", nullable: true),
                requestnumber = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                success = table.Column<bool>(type: "boolean", nullable: false),
                provider = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                providercode = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                providermessage = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
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
                table.PrimaryKey("PK_smsoutboundlogs", x => x.smsoutboundlogid);
            });

        migrationBuilder.CreateIndex(
            name: "IX_smsoutboundlogs_tenantid_createdatutc",
            table: "smsoutboundlogs",
            columns: new[] { "tenantid", "createdatutc" });

        migrationBuilder.CreateIndex(
            name: "IX_smsoutboundlogs_tenantid_jobid",
            table: "smsoutboundlogs",
            columns: new[] { "tenantid", "jobid" });

        migrationBuilder.CreateIndex(
            name: "IX_smsoutboundlogs_tenantid_kind_createdatutc",
            table: "smsoutboundlogs",
            columns: new[] { "tenantid", "kind", "createdatutc" });
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "smsoutboundlogs");
    }
}

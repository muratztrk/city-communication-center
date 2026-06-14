using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CityCommunicationCenter.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddWhatsAppTemplates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "whatsapptemplates",
                columns: table => new
                {
                    templateid = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "text", nullable: false),
                    content = table.Column<string>(type: "text", nullable: false),
                    isactive = table.Column<bool>(type: "boolean", nullable: false),
                    channel = table.Column<string>(type: "text", nullable: false),
                    isgeneral = table.Column<bool>(type: "boolean", nullable: false),
                    autoreply = table.Column<bool>(type: "boolean", nullable: false),
                    replydelaysecs = table.Column<int>(type: "integer", nullable: false),
                    haskeyword = table.Column<bool>(type: "boolean", nullable: false),
                    querytype = table.Column<string>(type: "text", nullable: false),
                    keywordsjson = table.Column<string>(type: "text", nullable: false),
                    tenantid = table.Column<Guid>(type: "uuid", nullable: false),
                    createdatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    createdbyuserid = table.Column<Guid>(type: "uuid", nullable: true),
                    updatedatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    updatedbyuserid = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_whatsapptemplates", x => x.templateid);
                    table.ForeignKey(
                        name: "FK_whatsapptemplates_tenants_tenantid",
                        column: x => x.tenantid,
                        principalTable: "tenants",
                        principalColumn: "tenantid",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_whatsapptemplates_tenantid_channel_isactive",
                table: "whatsapptemplates",
                columns: new[] { "tenantid", "channel", "isactive" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "whatsapptemplates");
        }
    }
}

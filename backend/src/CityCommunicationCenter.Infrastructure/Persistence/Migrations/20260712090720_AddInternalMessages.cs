using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CityCommunicationCenter.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddInternalMessages : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "internalconversations",
                columns: table => new
                {
                    internalconversationid = table.Column<Guid>(type: "uuid", nullable: false),
                    useraid = table.Column<Guid>(type: "uuid", nullable: false),
                    userbid = table.Column<Guid>(type: "uuid", nullable: false),
                    lastmessageatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    tenantid = table.Column<Guid>(type: "uuid", nullable: false),
                    createdatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    createdbyuserid = table.Column<Guid>(type: "uuid", nullable: true),
                    updatedatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    updatedbyuserid = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_internalconversations", x => x.internalconversationid);
                });

            migrationBuilder.CreateTable(
                name: "internalmessages",
                columns: table => new
                {
                    internalmessageid = table.Column<Guid>(type: "uuid", nullable: false),
                    internalconversationid = table.Column<Guid>(type: "uuid", nullable: false),
                    senderuserid = table.Column<Guid>(type: "uuid", nullable: false),
                    content = table.Column<string>(type: "text", nullable: false),
                    readatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    tenantid = table.Column<Guid>(type: "uuid", nullable: false),
                    createdatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    createdbyuserid = table.Column<Guid>(type: "uuid", nullable: true),
                    updatedatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    updatedbyuserid = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_internalmessages", x => x.internalmessageid);
                });

            migrationBuilder.CreateIndex(
                name: "IX_internalconversations_tenantid_useraid_userbid",
                table: "internalconversations",
                columns: new[] { "tenantid", "useraid", "userbid" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_internalmessages_tenantid_internalconversationid",
                table: "internalmessages",
                columns: new[] { "tenantid", "internalconversationid" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "internalconversations");

            migrationBuilder.DropTable(
                name: "internalmessages");
        }
    }
}

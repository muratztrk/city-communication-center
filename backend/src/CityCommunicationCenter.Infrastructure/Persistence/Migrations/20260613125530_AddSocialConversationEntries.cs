using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CityCommunicationCenter.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSocialConversationEntries : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "socialconversationentries",
                columns: table => new
                {
                    entryid = table.Column<Guid>(type: "uuid", nullable: false),
                    socialmessageid = table.Column<Guid>(type: "uuid", nullable: false),
                    direction = table.Column<string>(type: "text", nullable: false),
                    content = table.Column<string>(type: "text", nullable: false),
                    mediaid = table.Column<string>(type: "text", nullable: true),
                    mediamimetype = table.Column<string>(type: "text", nullable: true),
                    sentat = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    externalentryid = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_socialconversationentries", x => x.entryid);
                    table.ForeignKey(
                        name: "FK_socialconversationentries_socialmessages_socialmessageid",
                        column: x => x.socialmessageid,
                        principalTable: "socialmessages",
                        principalColumn: "socialmessageid",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_socialconversationentries_externalentryid",
                table: "socialconversationentries",
                column: "externalentryid",
                filter: "externalentryid IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_socialconversationentries_socialmessageid",
                table: "socialconversationentries",
                column: "socialmessageid");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "socialconversationentries");
        }
    }
}

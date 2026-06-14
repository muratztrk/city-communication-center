using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CityCommunicationCenter.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCitizenConversations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "citizenconversationid",
                table: "socialmessages",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "citizenconversations",
                columns: table => new
                {
                    citizenconversationid = table.Column<Guid>(type: "uuid", nullable: false),
                    citizenphone = table.Column<string>(type: "text", nullable: false),
                    citizenname = table.Column<string>(type: "text", nullable: true),
                    lastmessageat = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    unreadcount = table.Column<int>(type: "integer", nullable: false),
                    isblocked = table.Column<bool>(type: "boolean", nullable: false),
                    tenantid = table.Column<Guid>(type: "uuid", nullable: false),
                    createdatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    createdbyuserid = table.Column<Guid>(type: "uuid", nullable: true),
                    updatedatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    updatedbyuserid = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_citizenconversations", x => x.citizenconversationid);
                    table.ForeignKey(
                        name: "FK_citizenconversations_tenants_tenantid",
                        column: x => x.tenantid,
                        principalTable: "tenants",
                        principalColumn: "tenantid",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.UpdateData(
                table: "socialmessages",
                keyColumn: "socialmessageid",
                keyValue: new Guid("8e90888d-dc75-4264-a78b-f0a7abc9a9ab"),
                column: "citizenconversationid",
                value: null);

            migrationBuilder.CreateIndex(
                name: "IX_socialmessages_citizenconversationid",
                table: "socialmessages",
                column: "citizenconversationid");

            migrationBuilder.CreateIndex(
                name: "ix_citizenconversations_tenant_phone_unique",
                table: "citizenconversations",
                columns: new[] { "tenantid", "citizenphone" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_citizenconversations_tenantid_lastmessageat",
                table: "citizenconversations",
                columns: new[] { "tenantid", "lastmessageat" });

            migrationBuilder.AddForeignKey(
                name: "FK_socialmessages_citizenconversations_citizenconversationid",
                table: "socialmessages",
                column: "citizenconversationid",
                principalTable: "citizenconversations",
                principalColumn: "citizenconversationid",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_socialmessages_citizenconversations_citizenconversationid",
                table: "socialmessages");

            migrationBuilder.DropTable(
                name: "citizenconversations");

            migrationBuilder.DropIndex(
                name: "IX_socialmessages_citizenconversationid",
                table: "socialmessages");

            migrationBuilder.DropColumn(
                name: "citizenconversationid",
                table: "socialmessages");
        }
    }
}

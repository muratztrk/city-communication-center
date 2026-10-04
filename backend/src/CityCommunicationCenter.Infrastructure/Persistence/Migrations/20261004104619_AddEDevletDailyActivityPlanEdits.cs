using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CityCommunicationCenter.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddEDevletDailyActivityPlanEdits : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "edevletdailyactivityplanedits",
                columns: table => new
                {
                    editid = table.Column<Guid>(type: "uuid", nullable: false),
                    planid = table.Column<Guid>(type: "uuid", nullable: false),
                    editedbyuserid = table.Column<Guid>(type: "uuid", nullable: true),
                    editedbydisplayname = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    editedatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    changedfields = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    tenantid = table.Column<Guid>(type: "uuid", nullable: false),
                    createdatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    createdbyuserid = table.Column<Guid>(type: "uuid", nullable: true),
                    updatedatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    updatedbyuserid = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_edevletdailyactivityplanedits", x => x.editid);
                });

            migrationBuilder.CreateIndex(
                name: "IX_edevletdailyactivityplanedits_planid_editedatutc",
                table: "edevletdailyactivityplanedits",
                columns: new[] { "planid", "editedatutc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "edevletdailyactivityplanedits");
        }
    }
}

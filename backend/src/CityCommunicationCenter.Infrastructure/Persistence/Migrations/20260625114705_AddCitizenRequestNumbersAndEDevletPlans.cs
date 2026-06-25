using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CityCommunicationCenter.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCitizenRequestNumbersAndEDevletPlans : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "citizenrequestnumber",
                table: "socialmessages",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "citizenrequestnumberyear",
                table: "socialmessages",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "edevletactivitytypes",
                columns: table => new
                {
                    activitytypeid = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    sortorder = table.Column<int>(type: "integer", nullable: false),
                    tenantid = table.Column<Guid>(type: "uuid", nullable: false),
                    createdatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    createdbyuserid = table.Column<Guid>(type: "uuid", nullable: true),
                    updatedatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    updatedbyuserid = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_edevletactivitytypes", x => x.activitytypeid);
                });

            migrationBuilder.CreateTable(
                name: "edevletdailyactivityplans",
                columns: table => new
                {
                    planid = table.Column<Guid>(type: "uuid", nullable: false),
                    activitytypeid = table.Column<Guid>(type: "uuid", nullable: false),
                    description = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    neighborhood = table.Column<string>(type: "text", nullable: true),
                    street = table.Column<string>(type: "text", nullable: true),
                    openaddress = table.Column<string>(type: "text", nullable: true),
                    tenantid = table.Column<Guid>(type: "uuid", nullable: false),
                    createdatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    createdbyuserid = table.Column<Guid>(type: "uuid", nullable: true),
                    updatedatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    updatedbyuserid = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_edevletdailyactivityplans", x => x.planid);
                    table.ForeignKey(
                        name: "FK_edevletdailyactivityplans_edevletactivitytypes_activitytype~",
                        column: x => x.activitytypeid,
                        principalTable: "edevletactivitytypes",
                        principalColumn: "activitytypeid",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.UpdateData(
                table: "socialmessages",
                keyColumn: "socialmessageid",
                keyValue: new Guid("8e90888d-dc75-4264-a78b-f0a7abc9a9ab"),
                columns: new[] { "citizenrequestnumber", "citizenrequestnumberyear" },
                values: new object[] { null, null });

            migrationBuilder.CreateIndex(
                name: "IX_edevletdailyactivityplans_activitytypeid",
                table: "edevletdailyactivityplans",
                column: "activitytypeid");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "edevletdailyactivityplans");

            migrationBuilder.DropTable(
                name: "edevletactivitytypes");

            migrationBuilder.DropColumn(
                name: "citizenrequestnumber",
                table: "socialmessages");

            migrationBuilder.DropColumn(
                name: "citizenrequestnumberyear",
                table: "socialmessages");
        }
    }
}

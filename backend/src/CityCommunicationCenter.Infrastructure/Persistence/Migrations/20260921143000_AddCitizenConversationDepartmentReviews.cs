using CityCommunicationCenter.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CityCommunicationCenter.Infrastructure.Persistence.Migrations;

[DbContext(typeof(CityCommunicationCenterDbContext))]
[Migration("20260921143000_AddCitizenConversationDepartmentReviews")]
public partial class AddCitizenConversationDepartmentReviews : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "citizenconversationdepartmentreviews",
            columns: table => new
            {
                reviewid = table.Column<Guid>(type: "uuid", nullable: false),
                citizenconversationid = table.Column<Guid>(type: "uuid", nullable: false),
                departmentid = table.Column<Guid>(type: "uuid", nullable: false),
                jobid = table.Column<Guid>(type: "uuid", nullable: false),
                socialmessageid = table.Column<Guid>(type: "uuid", nullable: false),
                requestedbyuserid = table.Column<Guid>(type: "uuid", nullable: false),
                requestedatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                acknowledgedatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                tenantid = table.Column<Guid>(type: "uuid", nullable: false),
                createdatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                createdbyuserid = table.Column<Guid>(type: "uuid", nullable: true),
                updatedatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                updatedbyuserid = table.Column<Guid>(type: "uuid", nullable: true),
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_citizenconversationdepartmentreviews", x => x.reviewid);
                table.ForeignKey(
                    name: "FK_citizenconversationdepartmentreviews_citizenconversations_c~",
                    column: x => x.citizenconversationid,
                    principalTable: "citizenconversations",
                    principalColumn: "citizenconversationid",
                    onDelete: ReferentialAction.Cascade);
                table.ForeignKey(
                    name: "FK_citizenconversationdepartmentreviews_departments_department~",
                    column: x => x.departmentid,
                    principalTable: "departments",
                    principalColumn: "departmentid",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex(
            name: "ix_citizenconversationdepartmentreviews_tenantid_departmentid_~",
            table: "citizenconversationdepartmentreviews",
            columns: new[] { "tenantid", "departmentid", "acknowledgedatutc" });

        migrationBuilder.CreateIndex(
            name: "ix_citizenconversationdepartmentreviews_tenantid_citizenconve~",
            table: "citizenconversationdepartmentreviews",
            columns: new[] { "tenantid", "citizenconversationid", "departmentid" });
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "citizenconversationdepartmentreviews");
    }
}

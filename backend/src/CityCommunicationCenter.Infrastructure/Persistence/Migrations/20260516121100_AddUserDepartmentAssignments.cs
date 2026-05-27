using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CityCommunicationCenter.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddUserDepartmentAssignments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "userdepartmentassignments",
                columns: table => new
                {
                    assignmentid = table.Column<Guid>(type: "uuid", nullable: false),
                    userid = table.Column<Guid>(type: "uuid", nullable: false),
                    departmentid = table.Column<Guid>(type: "uuid", nullable: false),
                    isprimary = table.Column<bool>(type: "boolean", nullable: false),
                    tenantid = table.Column<Guid>(type: "uuid", nullable: false),
                    createdatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    createdbyuserid = table.Column<Guid>(type: "uuid", nullable: true),
                    updatedatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    updatedbyuserid = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_userdepartmentassignments", x => x.assignmentid);
                    table.ForeignKey(
                        name: "FK_userdepartmentassignments_departments_departmentid",
                        column: x => x.departmentid,
                        principalTable: "departments",
                        principalColumn: "departmentid",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_userdepartmentassignments_users_userid",
                        column: x => x.userid,
                        principalTable: "users",
                        principalColumn: "userid",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_userdepartmentassignments_departmentid",
                table: "userdepartmentassignments",
                column: "departmentid");

            migrationBuilder.CreateIndex(
                name: "IX_userdepartmentassignments_userid",
                table: "userdepartmentassignments",
                column: "userid");

            migrationBuilder.CreateIndex(
                name: "ix_userdeptassign_tenantid_userid_deptid_unique",
                table: "userdepartmentassignments",
                columns: new[] { "tenantid", "userid", "departmentid" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "userdepartmentassignments");
        }
    }
}

using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CityCommunicationCenter.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddProjectsAndPushNotifications : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "actionurl",
                table: "notifications",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "isread",
                table: "notifications",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "title",
                table: "notifications",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "projects",
                columns: table => new
                {
                    projectid = table.Column<Guid>(type: "uuid", nullable: false),
                    title = table.Column<string>(type: "text", nullable: false),
                    description = table.Column<string>(type: "text", nullable: false),
                    projecttype = table.Column<string>(type: "text", nullable: false),
                    status = table.Column<string>(type: "text", nullable: false),
                    ownerdepartmentid = table.Column<Guid>(type: "uuid", nullable: false),
                    requiresapproval = table.Column<bool>(type: "boolean", nullable: false),
                    isapproved = table.Column<bool>(type: "boolean", nullable: false),
                    approvedbyuserid = table.Column<Guid>(type: "uuid", nullable: true),
                    approvedatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    tenantid = table.Column<Guid>(type: "uuid", nullable: false),
                    createdatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    createdbyuserid = table.Column<Guid>(type: "uuid", nullable: true),
                    updatedatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    updatedbyuserid = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_projects", x => x.projectid);
                    table.ForeignKey(
                        name: "FK_projects_tenants_tenantid",
                        column: x => x.tenantid,
                        principalTable: "tenants",
                        principalColumn: "tenantid",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "pushsubscriptions",
                columns: table => new
                {
                    pushsubscriptionid = table.Column<Guid>(type: "uuid", nullable: false),
                    userid = table.Column<Guid>(type: "uuid", nullable: false),
                    endpoint = table.Column<string>(type: "text", nullable: false),
                    p256dhkey = table.Column<string>(type: "text", nullable: false),
                    authkey = table.Column<string>(type: "text", nullable: false),
                    useragent = table.Column<string>(type: "text", nullable: true),
                    isactive = table.Column<bool>(type: "boolean", nullable: false),
                    tenantid = table.Column<Guid>(type: "uuid", nullable: false),
                    createdatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    createdbyuserid = table.Column<Guid>(type: "uuid", nullable: true),
                    updatedatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    updatedbyuserid = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pushsubscriptions", x => x.pushsubscriptionid);
                });

            migrationBuilder.CreateTable(
                name: "projectdepartments",
                columns: table => new
                {
                    projectdepartmentid = table.Column<Guid>(type: "uuid", nullable: false),
                    projectid = table.Column<Guid>(type: "uuid", nullable: false),
                    departmentid = table.Column<Guid>(type: "uuid", nullable: false),
                    approvalstatus = table.Column<string>(type: "text", nullable: false),
                    approvedbyuserid = table.Column<Guid>(type: "uuid", nullable: true),
                    approvaldateutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    tenantid = table.Column<Guid>(type: "uuid", nullable: false),
                    createdatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    createdbyuserid = table.Column<Guid>(type: "uuid", nullable: true),
                    updatedatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    updatedbyuserid = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_projectdepartments", x => x.projectdepartmentid);
                    table.ForeignKey(
                        name: "FK_projectdepartments_projects_projectid",
                        column: x => x.projectid,
                        principalTable: "projects",
                        principalColumn: "projectid",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "projectmembers",
                columns: table => new
                {
                    projectmemberid = table.Column<Guid>(type: "uuid", nullable: false),
                    projectid = table.Column<Guid>(type: "uuid", nullable: false),
                    userid = table.Column<Guid>(type: "uuid", nullable: false),
                    departmentid = table.Column<Guid>(type: "uuid", nullable: false),
                    tenantid = table.Column<Guid>(type: "uuid", nullable: false),
                    createdatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    createdbyuserid = table.Column<Guid>(type: "uuid", nullable: true),
                    updatedatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    updatedbyuserid = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_projectmembers", x => x.projectmemberid);
                    table.ForeignKey(
                        name: "FK_projectmembers_projects_projectid",
                        column: x => x.projectid,
                        principalTable: "projects",
                        principalColumn: "projectid",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "projectstages",
                columns: table => new
                {
                    stageid = table.Column<Guid>(type: "uuid", nullable: false),
                    projectid = table.Column<Guid>(type: "uuid", nullable: false),
                    title = table.Column<string>(type: "text", nullable: false),
                    description = table.Column<string>(type: "text", nullable: false),
                    displayorder = table.Column<int>(type: "integer", nullable: false),
                    status = table.Column<string>(type: "text", nullable: false),
                    responsibledepartmentid = table.Column<Guid>(type: "uuid", nullable: true),
                    tenantid = table.Column<Guid>(type: "uuid", nullable: false),
                    createdatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    createdbyuserid = table.Column<Guid>(type: "uuid", nullable: true),
                    updatedatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    updatedbyuserid = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_projectstages", x => x.stageid);
                    table.ForeignKey(
                        name: "FK_projectstages_projects_projectid",
                        column: x => x.projectid,
                        principalTable: "projects",
                        principalColumn: "projectid",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_projectdepartments_projectid_departmentid",
                table: "projectdepartments",
                columns: new[] { "projectid", "departmentid" });

            migrationBuilder.CreateIndex(
                name: "IX_projectdepartments_tenantid_departmentid_approvalstatus",
                table: "projectdepartments",
                columns: new[] { "tenantid", "departmentid", "approvalstatus" });

            migrationBuilder.CreateIndex(
                name: "IX_projectmembers_projectid_userid",
                table: "projectmembers",
                columns: new[] { "projectid", "userid" });

            migrationBuilder.CreateIndex(
                name: "IX_projectmembers_tenantid_userid",
                table: "projectmembers",
                columns: new[] { "tenantid", "userid" });

            migrationBuilder.CreateIndex(
                name: "IX_projects_tenantid_ownerdepartmentid",
                table: "projects",
                columns: new[] { "tenantid", "ownerdepartmentid" });

            migrationBuilder.CreateIndex(
                name: "IX_projects_tenantid_projecttype",
                table: "projects",
                columns: new[] { "tenantid", "projecttype" });

            migrationBuilder.CreateIndex(
                name: "IX_projects_tenantid_status",
                table: "projects",
                columns: new[] { "tenantid", "status" });

            migrationBuilder.CreateIndex(
                name: "IX_projectstages_projectid_displayorder",
                table: "projectstages",
                columns: new[] { "projectid", "displayorder" });

            migrationBuilder.CreateIndex(
                name: "IX_projectstages_tenantid_responsibledepartmentid",
                table: "projectstages",
                columns: new[] { "tenantid", "responsibledepartmentid" });

            migrationBuilder.CreateIndex(
                name: "ix_pushsubscriptions_endpoint_unique",
                table: "pushsubscriptions",
                column: "endpoint",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_pushsubscriptions_tenantid_userid",
                table: "pushsubscriptions",
                columns: new[] { "tenantid", "userid" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "projectdepartments");

            migrationBuilder.DropTable(
                name: "projectmembers");

            migrationBuilder.DropTable(
                name: "projectstages");

            migrationBuilder.DropTable(
                name: "pushsubscriptions");

            migrationBuilder.DropTable(
                name: "projects");

            migrationBuilder.DropColumn(
                name: "actionurl",
                table: "notifications");

            migrationBuilder.DropColumn(
                name: "isread",
                table: "notifications");

            migrationBuilder.DropColumn(
                name: "title",
                table: "notifications");
        }
    }
}

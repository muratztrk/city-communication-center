using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CityCommunicationCenter.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialPostgreSql : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "auditlogs",
                columns: table => new
                {
                    auditlogid = table.Column<Guid>(type: "uuid", nullable: false),
                    entitytype = table.Column<string>(type: "text", nullable: false),
                    entityid = table.Column<string>(type: "text", nullable: false),
                    action = table.Column<string>(type: "text", nullable: false),
                    actoruserid = table.Column<Guid>(type: "uuid", nullable: true),
                    eventtimeutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    details = table.Column<string>(type: "text", nullable: true),
                    tenantid = table.Column<Guid>(type: "uuid", nullable: false),
                    createdatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    createdbyuserid = table.Column<Guid>(type: "uuid", nullable: true),
                    updatedatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    updatedbyuserid = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_auditlogs", x => x.auditlogid);
                });

            migrationBuilder.CreateTable(
                name: "notifications",
                columns: table => new
                {
                    notificationid = table.Column<Guid>(type: "uuid", nullable: false),
                    taskid = table.Column<Guid>(type: "uuid", nullable: true),
                    userid = table.Column<Guid>(type: "uuid", nullable: false),
                    channel = table.Column<string>(type: "text", nullable: false),
                    deliverystatus = table.Column<string>(type: "text", nullable: false),
                    message = table.Column<string>(type: "text", nullable: false),
                    sentatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    tenantid = table.Column<Guid>(type: "uuid", nullable: false),
                    createdatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    createdbyuserid = table.Column<Guid>(type: "uuid", nullable: true),
                    updatedatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    updatedbyuserid = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_notifications", x => x.notificationid);
                });

            migrationBuilder.CreateTable(
                name: "routingrules",
                columns: table => new
                {
                    ruleid = table.Column<Guid>(type: "uuid", nullable: false),
                    tenantid = table.Column<Guid>(type: "uuid", nullable: false),
                    rulename = table.Column<string>(type: "text", nullable: false),
                    keywords = table.Column<string>(type: "text", nullable: false),
                    targetdepartmentid = table.Column<Guid>(type: "uuid", nullable: false),
                    priority = table.Column<int>(type: "integer", nullable: false),
                    isactive = table.Column<bool>(type: "boolean", nullable: false),
                    createdatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_routingrules", x => x.ruleid);
                });

            migrationBuilder.CreateTable(
                name: "tenants",
                columns: table => new
                {
                    tenantid = table.Column<Guid>(type: "uuid", nullable: false),
                    municipalityname = table.Column<string>(type: "text", nullable: false),
                    displayname = table.Column<string>(type: "text", nullable: false),
                    deploymentmode = table.Column<string>(type: "text", nullable: false),
                    isactive = table.Column<bool>(type: "boolean", nullable: false),
                    theme = table.Column<string>(type: "text", nullable: true),
                    domain = table.Column<string>(type: "text", nullable: true),
                    createdatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tenants", x => x.tenantid);
                });

            migrationBuilder.CreateTable(
                name: "tenantsettings",
                columns: table => new
                {
                    tenantsettingid = table.Column<Guid>(type: "uuid", nullable: false),
                    displayname = table.Column<string>(type: "text", nullable: false),
                    theme = table.Column<string>(type: "text", nullable: true),
                    domain = table.Column<string>(type: "text", nullable: true),
                    defaultslahours = table.Column<int>(type: "integer", nullable: false),
                    autoroutingenabled = table.Column<bool>(type: "boolean", nullable: false),
                    socialsettingsjson = table.Column<string>(type: "text", nullable: true),
                    tenantid = table.Column<Guid>(type: "uuid", nullable: false),
                    createdatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    createdbyuserid = table.Column<Guid>(type: "uuid", nullable: true),
                    updatedatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    updatedbyuserid = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tenantsettings", x => x.tenantsettingid);
                });

            migrationBuilder.CreateTable(
                name: "departments",
                columns: table => new
                {
                    departmentid = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "text", nullable: false),
                    departmenttype = table.Column<string>(type: "text", nullable: false),
                    parentdepartmentid = table.Column<Guid>(type: "uuid", nullable: true),
                    manageruserid = table.Column<Guid>(type: "uuid", nullable: true),
                    tenantid = table.Column<Guid>(type: "uuid", nullable: false),
                    createdatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    createdbyuserid = table.Column<Guid>(type: "uuid", nullable: true),
                    updatedatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    updatedbyuserid = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_departments", x => x.departmentid);
                    table.ForeignKey(
                        name: "FK_departments_departments_parentdepartmentid",
                        column: x => x.parentdepartmentid,
                        principalTable: "departments",
                        principalColumn: "departmentid",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_departments_tenants_tenantid",
                        column: x => x.tenantid,
                        principalTable: "tenants",
                        principalColumn: "tenantid",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "tasks",
                columns: table => new
                {
                    taskid = table.Column<Guid>(type: "uuid", nullable: false),
                    title = table.Column<string>(type: "text", nullable: false),
                    description = table.Column<string>(type: "text", nullable: false),
                    tasktype = table.Column<string>(type: "text", nullable: false),
                    sourcetype = table.Column<string>(type: "text", nullable: false),
                    sourcerefid = table.Column<Guid>(type: "uuid", nullable: true),
                    targetdepartmentid = table.Column<Guid>(type: "uuid", nullable: true),
                    assigneddepartmentid = table.Column<Guid>(type: "uuid", nullable: true),
                    assigneduserid = table.Column<Guid>(type: "uuid", nullable: true),
                    currentstatus = table.Column<string>(type: "text", nullable: false),
                    priority = table.Column<string>(type: "text", nullable: false),
                    duedateutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    completedatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    closedatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    tenantid = table.Column<Guid>(type: "uuid", nullable: false),
                    createdatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    createdbyuserid = table.Column<Guid>(type: "uuid", nullable: true),
                    updatedatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    updatedbyuserid = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tasks", x => x.taskid);
                    table.ForeignKey(
                        name: "FK_tasks_tenants_tenantid",
                        column: x => x.tenantid,
                        principalTable: "tenants",
                        principalColumn: "tenantid",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "users",
                columns: table => new
                {
                    userid = table.Column<Guid>(type: "uuid", nullable: false),
                    departmentid = table.Column<Guid>(type: "uuid", nullable: false),
                    displayname = table.Column<string>(type: "text", nullable: false),
                    email = table.Column<string>(type: "text", nullable: true),
                    externalidentityid = table.Column<string>(type: "text", nullable: true),
                    manageruserid = table.Column<Guid>(type: "uuid", nullable: true),
                    rolecode = table.Column<string>(type: "text", nullable: false),
                    isactive = table.Column<bool>(type: "boolean", nullable: false),
                    tenantid = table.Column<Guid>(type: "uuid", nullable: false),
                    createdatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    createdbyuserid = table.Column<Guid>(type: "uuid", nullable: true),
                    updatedatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    updatedbyuserid = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_users", x => x.userid);
                    table.ForeignKey(
                        name: "FK_users_departments_departmentid",
                        column: x => x.departmentid,
                        principalTable: "departments",
                        principalColumn: "departmentid",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_users_tenants_tenantid",
                        column: x => x.tenantid,
                        principalTable: "tenants",
                        principalColumn: "tenantid",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "approvals",
                columns: table => new
                {
                    approvalid = table.Column<Guid>(type: "uuid", nullable: false),
                    taskid = table.Column<Guid>(type: "uuid", nullable: false),
                    approveruserid = table.Column<Guid>(type: "uuid", nullable: false),
                    steporder = table.Column<int>(type: "integer", nullable: false),
                    decision = table.Column<string>(type: "text", nullable: false),
                    comment = table.Column<string>(type: "text", nullable: true),
                    decisiondateutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    tenantid = table.Column<Guid>(type: "uuid", nullable: false),
                    createdatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    createdbyuserid = table.Column<Guid>(type: "uuid", nullable: true),
                    updatedatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    updatedbyuserid = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_approvals", x => x.approvalid);
                    table.ForeignKey(
                        name: "FK_approvals_tasks_taskid",
                        column: x => x.taskid,
                        principalTable: "tasks",
                        principalColumn: "taskid",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "assignmenthistory",
                columns: table => new
                {
                    assignmentid = table.Column<Guid>(type: "uuid", nullable: false),
                    taskid = table.Column<Guid>(type: "uuid", nullable: false),
                    fromdepartmentid = table.Column<Guid>(type: "uuid", nullable: true),
                    todepartmentid = table.Column<Guid>(type: "uuid", nullable: true),
                    fromuserid = table.Column<Guid>(type: "uuid", nullable: true),
                    touserid = table.Column<Guid>(type: "uuid", nullable: true),
                    actiontype = table.Column<string>(type: "text", nullable: false),
                    actiondateutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    tenantid = table.Column<Guid>(type: "uuid", nullable: false),
                    createdatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    createdbyuserid = table.Column<Guid>(type: "uuid", nullable: true),
                    updatedatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    updatedbyuserid = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_assignmenthistory", x => x.assignmentid);
                    table.ForeignKey(
                        name: "FK_assignmenthistory_tasks_taskid",
                        column: x => x.taskid,
                        principalTable: "tasks",
                        principalColumn: "taskid",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "socialmessages",
                columns: table => new
                {
                    socialmessageid = table.Column<Guid>(type: "uuid", nullable: false),
                    channel = table.Column<string>(type: "text", nullable: false),
                    externalmessageid = table.Column<string>(type: "text", nullable: false),
                    citizenhandle = table.Column<string>(type: "text", nullable: false),
                    content = table.Column<string>(type: "text", nullable: false),
                    category = table.Column<string>(type: "text", nullable: true),
                    tags = table.Column<string>(type: "text", nullable: false),
                    status = table.Column<string>(type: "text", nullable: false),
                    assigneddepartmentid = table.Column<Guid>(type: "uuid", nullable: true),
                    taskid = table.Column<Guid>(type: "uuid", nullable: true),
                    receivedatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    responsecontent = table.Column<string>(type: "text", nullable: true),
                    respondedatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    tenantid = table.Column<Guid>(type: "uuid", nullable: false),
                    createdatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    createdbyuserid = table.Column<Guid>(type: "uuid", nullable: true),
                    updatedatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    updatedbyuserid = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_socialmessages", x => x.socialmessageid);
                    table.ForeignKey(
                        name: "FK_socialmessages_departments_assigneddepartmentid",
                        column: x => x.assigneddepartmentid,
                        principalTable: "departments",
                        principalColumn: "departmentid",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_socialmessages_tasks_taskid",
                        column: x => x.taskid,
                        principalTable: "tasks",
                        principalColumn: "taskid",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_socialmessages_tenants_tenantid",
                        column: x => x.tenantid,
                        principalTable: "tenants",
                        principalColumn: "tenantid",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_approvals_taskid",
                table: "approvals",
                column: "taskid");

            migrationBuilder.CreateIndex(
                name: "IX_assignmenthistory_taskid",
                table: "assignmenthistory",
                column: "taskid");

            migrationBuilder.CreateIndex(
                name: "IX_departments_parentdepartmentid",
                table: "departments",
                column: "parentdepartmentid");

            migrationBuilder.CreateIndex(
                name: "IX_departments_tenantid",
                table: "departments",
                column: "tenantid");

            migrationBuilder.CreateIndex(
                name: "IX_socialmessages_assigneddepartmentid",
                table: "socialmessages",
                column: "assigneddepartmentid");

            migrationBuilder.CreateIndex(
                name: "IX_socialmessages_taskid",
                table: "socialmessages",
                column: "taskid");

            migrationBuilder.CreateIndex(
                name: "IX_socialmessages_tenantid",
                table: "socialmessages",
                column: "tenantid");

            migrationBuilder.CreateIndex(
                name: "IX_tasks_tenantid",
                table: "tasks",
                column: "tenantid");

            migrationBuilder.CreateIndex(
                name: "IX_tenantsettings_tenantid",
                table: "tenantsettings",
                column: "tenantid",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_users_departmentid",
                table: "users",
                column: "departmentid");

            migrationBuilder.CreateIndex(
                name: "IX_users_tenantid",
                table: "users",
                column: "tenantid");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "approvals");

            migrationBuilder.DropTable(
                name: "assignmenthistory");

            migrationBuilder.DropTable(
                name: "auditlogs");

            migrationBuilder.DropTable(
                name: "notifications");

            migrationBuilder.DropTable(
                name: "routingrules");

            migrationBuilder.DropTable(
                name: "socialmessages");

            migrationBuilder.DropTable(
                name: "tenantsettings");

            migrationBuilder.DropTable(
                name: "users");

            migrationBuilder.DropTable(
                name: "tasks");

            migrationBuilder.DropTable(
                name: "departments");

            migrationBuilder.DropTable(
                name: "tenants");
        }
    }
}

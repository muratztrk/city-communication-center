using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace CityCommunicationCenter.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialPostgreSql_V2 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "approvals",
                columns: table => new
                {
                    approvalid = table.Column<Guid>(type: "uuid", nullable: false),
                    subjecttype = table.Column<string>(type: "text", nullable: false),
                    subjectid = table.Column<Guid>(type: "uuid", nullable: false),
                    steporder = table.Column<int>(type: "integer", nullable: false),
                    approveruserid = table.Column<Guid>(type: "uuid", nullable: false),
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
                });

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
                    title = table.Column<string>(type: "text", nullable: false),
                    isread = table.Column<bool>(type: "boolean", nullable: false),
                    actionurl = table.Column<string>(type: "text", nullable: true),
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
                    ldapsettingsjson = table.Column<string>(type: "text", nullable: true),
                    authpolicyjson = table.Column<string>(type: "text", nullable: true),
                    appearancejson = table.Column<string>(type: "text", nullable: true),
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
                name: "jobs",
                columns: table => new
                {
                    jobid = table.Column<Guid>(type: "uuid", nullable: false),
                    title = table.Column<string>(type: "text", nullable: false),
                    description = table.Column<string>(type: "text", nullable: false),
                    ownerdepartmentid = table.Column<Guid>(type: "uuid", nullable: false),
                    status = table.Column<string>(type: "text", nullable: false),
                    priority = table.Column<string>(type: "text", nullable: false),
                    startdateutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    duedateutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    completedatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    sourcetype = table.Column<string>(type: "text", nullable: false),
                    sourcerefid = table.Column<Guid>(type: "uuid", nullable: true),
                    cancelreason = table.Column<string>(type: "text", nullable: true),
                    completionpercentage = table.Column<int>(type: "integer", nullable: true),
                    iscoordinated = table.Column<bool>(type: "boolean", nullable: false),
                    tenantid = table.Column<Guid>(type: "uuid", nullable: false),
                    createdatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    createdbyuserid = table.Column<Guid>(type: "uuid", nullable: true),
                    updatedatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    updatedbyuserid = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_jobs", x => x.jobid);
                    table.ForeignKey(
                        name: "FK_jobs_departments_ownerdepartmentid",
                        column: x => x.ownerdepartmentid,
                        principalTable: "departments",
                        principalColumn: "departmentid",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_jobs_tenants_tenantid",
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
                    username = table.Column<string>(type: "text", nullable: true),
                    displayname = table.Column<string>(type: "text", nullable: false),
                    email = table.Column<string>(type: "text", nullable: true),
                    passwordhash = table.Column<string>(type: "text", nullable: true),
                    externalidentityid = table.Column<string>(type: "text", nullable: true),
                    manageruserid = table.Column<Guid>(type: "uuid", nullable: true),
                    rolecode = table.Column<string>(type: "text", nullable: false),
                    usersource = table.Column<string>(type: "text", nullable: false),
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
                name: "jobdepartments",
                columns: table => new
                {
                    jobdepartmentid = table.Column<Guid>(type: "uuid", nullable: false),
                    jobid = table.Column<Guid>(type: "uuid", nullable: false),
                    departmentid = table.Column<Guid>(type: "uuid", nullable: false),
                    role = table.Column<string>(type: "text", nullable: false),
                    approvalstatus = table.Column<string>(type: "text", nullable: false),
                    requestedbyuserid = table.Column<Guid>(type: "uuid", nullable: true),
                    requestedatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    approvedbyuserid = table.Column<Guid>(type: "uuid", nullable: true),
                    decidedatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    rejectreason = table.Column<string>(type: "text", nullable: true),
                    notes = table.Column<string>(type: "text", nullable: true),
                    tenantid = table.Column<Guid>(type: "uuid", nullable: false),
                    createdatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    createdbyuserid = table.Column<Guid>(type: "uuid", nullable: true),
                    updatedatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    updatedbyuserid = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_jobdepartments", x => x.jobdepartmentid);
                    table.ForeignKey(
                        name: "FK_jobdepartments_departments_departmentid",
                        column: x => x.departmentid,
                        principalTable: "departments",
                        principalColumn: "departmentid",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_jobdepartments_jobs_jobid",
                        column: x => x.jobid,
                        principalTable: "jobs",
                        principalColumn: "jobid",
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
                    jobid = table.Column<Guid>(type: "uuid", nullable: true),
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
                        name: "FK_socialmessages_jobs_jobid",
                        column: x => x.jobid,
                        principalTable: "jobs",
                        principalColumn: "jobid",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_socialmessages_tenants_tenantid",
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
                    jobid = table.Column<Guid>(type: "uuid", nullable: false),
                    title = table.Column<string>(type: "text", nullable: false),
                    description = table.Column<string>(type: "text", nullable: false),
                    assigneddepartmentid = table.Column<Guid>(type: "uuid", nullable: true),
                    assigneduserid = table.Column<Guid>(type: "uuid", nullable: true),
                    assigningmanagerid = table.Column<Guid>(type: "uuid", nullable: true),
                    currentstatus = table.Column<string>(type: "text", nullable: false),
                    priority = table.Column<string>(type: "text", nullable: false),
                    startdateutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    duedateutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    completedatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    estimatedhours = table.Column<decimal>(type: "numeric(9,2)", nullable: true),
                    actualhours = table.Column<decimal>(type: "numeric(9,2)", nullable: true),
                    completionpercentage = table.Column<int>(type: "integer", nullable: true),
                    notes = table.Column<string>(type: "text", nullable: true),
                    revisionreason = table.Column<string>(type: "text", nullable: true),
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
                        name: "FK_tasks_jobs_jobid",
                        column: x => x.jobid,
                        principalTable: "jobs",
                        principalColumn: "jobid",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_tasks_tenants_tenantid",
                        column: x => x.tenantid,
                        principalTable: "tenants",
                        principalColumn: "tenantid",
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

            migrationBuilder.InsertData(
                table: "routingrules",
                columns: new[] { "ruleid", "createdatutc", "isactive", "keywords", "priority", "rulename", "targetdepartmentid", "tenantid" },
                values: new object[] { new Guid("d306cbf0-88ad-48b7-9b16-14bb87e77f5f"), new DateTimeOffset(new DateTime(2026, 3, 19, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), true, "altyapı,çukur,yol,asfalt", 90, "Altyapı Talepleri", new Guid("0e29fb34-64da-429e-b7c0-e6016a0c10a7"), new Guid("b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e") });

            migrationBuilder.InsertData(
                table: "tenants",
                columns: new[] { "tenantid", "createdatutc", "deploymentmode", "displayname", "domain", "isactive", "municipalityname", "theme" },
                values: new object[] { new Guid("b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e"), new DateTimeOffset(new DateTime(2026, 3, 19, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), "DedicatedHosted", "Tire Belediyesi", null, true, "Tire Belediyesi", null });

            migrationBuilder.InsertData(
                table: "tenantsettings",
                columns: new[] { "tenantsettingid", "appearancejson", "authpolicyjson", "autoroutingenabled", "createdatutc", "createdbyuserid", "defaultslahours", "displayname", "domain", "ldapsettingsjson", "socialsettingsjson", "tenantid", "theme", "updatedatutc", "updatedbyuserid" },
                values: new object[] { new Guid("3f3efab4-c18c-4dd2-a227-c28af61d4fd5"), "{\"themePreset\":\"tire-civic\",\"primaryColor\":\"#0F4C81\",\"secondaryColor\":\"#2B6EA6\",\"accentColor\":\"#C6932D\",\"neutralColor\":\"#6A7786\",\"surfaceColor\":\"#FFFFFF\",\"backgroundColor\":\"#EEF3F8\",\"headerGradientFrom\":\"#123B63\",\"headerGradientTo\":\"#356F99\",\"sidebarBackgroundColor\":\"#102F4A\",\"sidebarForegroundColor\":\"#F6F8FB\"}", "{\"automaticSignInEnabled\":true,\"automaticSignInMode\":\"TrustedHeader\",\"trustedNetworkCidrs\":[\"127.0.0.1/32\",\"::1/128\",\"10.0.0.0/8\",\"172.16.0.0/12\",\"192.168.0.0/16\"],\"trustedProxyCidrs\":[\"127.0.0.1/32\",\"::1/128\",\"10.0.0.0/8\",\"172.16.0.0/12\",\"192.168.0.0/16\"],\"identityHeaderName\":\"X-Authenticated-User\",\"requireSecondFactorOutsideTrustedNetwork\":true,\"secondFactorProvider\":\"Mock\",\"codeLength\":6,\"codeTtlSeconds\":300,\"allowMockCodePreview\":true}", true, new DateTimeOffset(new DateTime(2026, 3, 19, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), new Guid("4b1efb47-0311-4ef7-9a0c-f4c41dcb8b48"), 48, "Tire Belediyesi", null, "{\"enabled\":true,\"domain\":\"tire.bel.tr\",\"userAttribute\":\"mail\"}", null, new Guid("b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e"), null, null, null });

            migrationBuilder.InsertData(
                table: "departments",
                columns: new[] { "departmentid", "createdatutc", "createdbyuserid", "departmenttype", "manageruserid", "name", "parentdepartmentid", "tenantid", "updatedatutc", "updatedbyuserid" },
                values: new object[,]
                {
                    { new Guid("0e29fb34-64da-429e-b7c0-e6016a0c10a7"), new DateTimeOffset(new DateTime(2026, 3, 19, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), new Guid("4b1efb47-0311-4ef7-9a0c-f4c41dcb8b48"), "Müdürlük", new Guid("d6fc7a5b-5cb2-4c59-8a82-7843041421a5"), "Fen İşleri Müdürlüğü", null, new Guid("b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e"), null, null },
                    { new Guid("6d146a0d-611c-48a5-b59e-8c14a22f6a2e"), new DateTimeOffset(new DateTime(2026, 3, 19, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), new Guid("4b1efb47-0311-4ef7-9a0c-f4c41dcb8b48"), "Administration", new Guid("4b1efb47-0311-4ef7-9a0c-f4c41dcb8b48"), "Sistem Yönetimi", null, new Guid("b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e"), null, null },
                    { new Guid("8f7264ff-c1df-48eb-bf39-a6ff42d7e9bc"), new DateTimeOffset(new DateTime(2026, 3, 19, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), new Guid("4b1efb47-0311-4ef7-9a0c-f4c41dcb8b48"), "Müdürlük", null, "Basın Yayın Müdürlüğü", null, new Guid("b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e"), null, null }
                });

            migrationBuilder.InsertData(
                table: "jobs",
                columns: new[] { "jobid", "cancelreason", "completedatutc", "completionpercentage", "createdatutc", "createdbyuserid", "description", "duedateutc", "iscoordinated", "ownerdepartmentid", "priority", "sourcerefid", "sourcetype", "startdateutc", "status", "tenantid", "title", "updatedatutc", "updatedbyuserid" },
                values: new object[] { new Guid("9a5b3f2e-6c1a-4b0d-8e7f-2d3c4b5a6987"), null, null, null, new DateTimeOffset(new DateTime(2026, 3, 19, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), new Guid("4b1efb47-0311-4ef7-9a0c-f4c41dcb8b48"), "İlk kurulum sonrası arayüz kontrolü için eklenen örnek iş.", new DateTimeOffset(new DateTime(2026, 3, 21, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), false, new Guid("0e29fb34-64da-429e-b7c0-e6016a0c10a7"), "Normal", null, "Manual", null, "Active", new Guid("b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e"), "Örnek altyapı inceleme işi", null, null });

            migrationBuilder.InsertData(
                table: "socialmessages",
                columns: new[] { "socialmessageid", "assigneddepartmentid", "category", "channel", "citizenhandle", "content", "createdatutc", "createdbyuserid", "externalmessageid", "jobid", "receivedatutc", "respondedatutc", "responsecontent", "status", "tags", "tenantid", "updatedatutc", "updatedbyuserid" },
                values: new object[] { new Guid("8e90888d-dc75-4264-a78b-f0a7abc9a9ab"), new Guid("0e29fb34-64da-429e-b7c0-e6016a0c10a7"), "Altyapı", "Instagram", "tire.vatandas", "Yolda çukur var, ekip yönlendirebilir misiniz?", new DateTimeOffset(new DateTime(2026, 3, 19, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), new Guid("4b1efb47-0311-4ef7-9a0c-f4c41dcb8b48"), "demo-instagram-message-1", null, new DateTimeOffset(new DateTime(2026, 3, 18, 20, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), null, null, "Routed", "", new Guid("b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e"), null, null });

            migrationBuilder.InsertData(
                table: "users",
                columns: new[] { "userid", "createdatutc", "createdbyuserid", "departmentid", "displayname", "email", "externalidentityid", "isactive", "manageruserid", "passwordhash", "rolecode", "tenantid", "updatedatutc", "updatedbyuserid", "usersource", "username" },
                values: new object[,]
                {
                    { new Guid("1358d4aa-b1ae-486c-a1db-a757ea18f2c3"), new DateTimeOffset(new DateTime(2026, 3, 19, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), new Guid("4b1efb47-0311-4ef7-9a0c-f4c41dcb8b48"), new Guid("0e29fb34-64da-429e-b7c0-e6016a0c10a7"), "Emre Çelik", "emre.celik@tire.bel.tr", null, true, new Guid("d6fc7a5b-5cb2-4c59-8a82-7843041421a5"), null, "Staff", new Guid("b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e"), null, null, "Manual", "emre.celik" },
                    { new Guid("1e96916a-889a-4701-a0e6-71dc6571ac18"), new DateTimeOffset(new DateTime(2026, 3, 19, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), new Guid("4b1efb47-0311-4ef7-9a0c-f4c41dcb8b48"), new Guid("8f7264ff-c1df-48eb-bf39-a6ff42d7e9bc"), "Ali Yıldız", "ali.yildiz@tire.bel.tr", null, true, null, null, "Operator", new Guid("b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e"), null, null, "Manual", "ali.yildiz" },
                    { new Guid("4b1efb47-0311-4ef7-9a0c-f4c41dcb8b48"), new DateTimeOffset(new DateTime(2026, 3, 19, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), new Guid("4b1efb47-0311-4ef7-9a0c-f4c41dcb8b48"), new Guid("6d146a0d-611c-48a5-b59e-8c14a22f6a2e"), "Sistem Yöneticisi", "admin@tire.bel.tr", null, true, null, null, "SystemAdmin", new Guid("b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e"), null, null, "Manual", "admin" },
                    { new Guid("d6fc7a5b-5cb2-4c59-8a82-7843041421a5"), new DateTimeOffset(new DateTime(2026, 3, 19, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), new Guid("4b1efb47-0311-4ef7-9a0c-f4c41dcb8b48"), new Guid("0e29fb34-64da-429e-b7c0-e6016a0c10a7"), "Zeynep Kara", "zeynep.kara@tire.bel.tr", null, true, null, null, "Manager", new Guid("b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e"), null, null, "Manual", "zeynep.kara" }
                });

            migrationBuilder.InsertData(
                table: "jobdepartments",
                columns: new[] { "jobdepartmentid", "approvalstatus", "approvedbyuserid", "createdatutc", "createdbyuserid", "decidedatutc", "departmentid", "jobid", "notes", "rejectreason", "requestedatutc", "requestedbyuserid", "role", "tenantid", "updatedatutc", "updatedbyuserid" },
                values: new object[] { new Guid("7c2d4e1f-5b8a-4d3c-9e6f-1a2b3c4d5e62"), "Approved", new Guid("d6fc7a5b-5cb2-4c59-8a82-7843041421a5"), new DateTimeOffset(new DateTime(2026, 3, 19, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), new Guid("4b1efb47-0311-4ef7-9a0c-f4c41dcb8b48"), new DateTimeOffset(new DateTime(2026, 3, 19, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), new Guid("0e29fb34-64da-429e-b7c0-e6016a0c10a7"), new Guid("9a5b3f2e-6c1a-4b0d-8e7f-2d3c4b5a6987"), null, null, new DateTimeOffset(new DateTime(2026, 3, 19, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), new Guid("4b1efb47-0311-4ef7-9a0c-f4c41dcb8b48"), "Owner", new Guid("b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e"), null, null });

            migrationBuilder.InsertData(
                table: "tasks",
                columns: new[] { "taskid", "actualhours", "assigneddepartmentid", "assigneduserid", "assigningmanagerid", "completedatutc", "completionpercentage", "createdatutc", "createdbyuserid", "currentstatus", "description", "duedateutc", "estimatedhours", "jobid", "notes", "priority", "revisionreason", "startdateutc", "tenantid", "title", "updatedatutc", "updatedbyuserid" },
                values: new object[] { new Guid("6de6e0b3-a74e-4f24-bdbc-4d6e0cb6d38c"), null, new Guid("0e29fb34-64da-429e-b7c0-e6016a0c10a7"), new Guid("1358d4aa-b1ae-486c-a1db-a757ea18f2c3"), new Guid("d6fc7a5b-5cb2-4c59-8a82-7843041421a5"), null, null, new DateTimeOffset(new DateTime(2026, 3, 19, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), new Guid("4b1efb47-0311-4ef7-9a0c-f4c41dcb8b48"), "Assigned", "İlk kurulum sonrası arayüz kontrolü için eklenen örnek görev.", new DateTimeOffset(new DateTime(2026, 3, 21, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), null, new Guid("9a5b3f2e-6c1a-4b0d-8e7f-2d3c4b5a6987"), null, "Normal", null, null, new Guid("b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e"), "Örnek altyapı inceleme görevi", null, null });

            migrationBuilder.CreateIndex(
                name: "IX_approvals_tenantid_approveruserid_decision",
                table: "approvals",
                columns: new[] { "tenantid", "approveruserid", "decision" });

            migrationBuilder.CreateIndex(
                name: "IX_approvals_tenantid_subjecttype_subjectid_steporder",
                table: "approvals",
                columns: new[] { "tenantid", "subjecttype", "subjectid", "steporder" });

            migrationBuilder.CreateIndex(
                name: "IX_assignmenthistory_taskid_actiondateutc",
                table: "assignmenthistory",
                columns: new[] { "taskid", "actiondateutc" });

            migrationBuilder.CreateIndex(
                name: "IX_assignmenthistory_tenantid_todepartmentid",
                table: "assignmenthistory",
                columns: new[] { "tenantid", "todepartmentid" });

            migrationBuilder.CreateIndex(
                name: "IX_auditlogs_tenantid_entitytype_entityid",
                table: "auditlogs",
                columns: new[] { "tenantid", "entitytype", "entityid" });

            migrationBuilder.CreateIndex(
                name: "IX_auditlogs_tenantid_eventtimeutc",
                table: "auditlogs",
                columns: new[] { "tenantid", "eventtimeutc" });

            migrationBuilder.CreateIndex(
                name: "IX_departments_parentdepartmentid",
                table: "departments",
                column: "parentdepartmentid");

            migrationBuilder.CreateIndex(
                name: "IX_departments_tenantid_manageruserid",
                table: "departments",
                columns: new[] { "tenantid", "manageruserid" });

            migrationBuilder.CreateIndex(
                name: "IX_departments_tenantid_name",
                table: "departments",
                columns: new[] { "tenantid", "name" });

            migrationBuilder.CreateIndex(
                name: "IX_jobdepartments_departmentid",
                table: "jobdepartments",
                column: "departmentid");

            migrationBuilder.CreateIndex(
                name: "IX_jobdepartments_jobid",
                table: "jobdepartments",
                column: "jobid");

            migrationBuilder.CreateIndex(
                name: "IX_jobdepartments_tenantid_departmentid_approvalstatus",
                table: "jobdepartments",
                columns: new[] { "tenantid", "departmentid", "approvalstatus" });

            migrationBuilder.CreateIndex(
                name: "IX_jobdepartments_tenantid_jobid",
                table: "jobdepartments",
                columns: new[] { "tenantid", "jobid" });

            migrationBuilder.CreateIndex(
                name: "IX_jobs_ownerdepartmentid",
                table: "jobs",
                column: "ownerdepartmentid");

            migrationBuilder.CreateIndex(
                name: "IX_jobs_tenantid_duedateutc",
                table: "jobs",
                columns: new[] { "tenantid", "duedateutc" });

            migrationBuilder.CreateIndex(
                name: "IX_jobs_tenantid_ownerdepartmentid",
                table: "jobs",
                columns: new[] { "tenantid", "ownerdepartmentid" });

            migrationBuilder.CreateIndex(
                name: "IX_jobs_tenantid_status",
                table: "jobs",
                columns: new[] { "tenantid", "status" });

            migrationBuilder.CreateIndex(
                name: "IX_notifications_tenantid_taskid",
                table: "notifications",
                columns: new[] { "tenantid", "taskid" });

            migrationBuilder.CreateIndex(
                name: "IX_notifications_tenantid_userid_deliverystatus",
                table: "notifications",
                columns: new[] { "tenantid", "userid", "deliverystatus" });

            migrationBuilder.CreateIndex(
                name: "ix_pushsubscriptions_endpoint_unique",
                table: "pushsubscriptions",
                column: "endpoint",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_pushsubscriptions_tenantid_userid",
                table: "pushsubscriptions",
                columns: new[] { "tenantid", "userid" });

            migrationBuilder.CreateIndex(
                name: "IX_routingrules_tenantid_isactive_priority",
                table: "routingrules",
                columns: new[] { "tenantid", "isactive", "priority" });

            migrationBuilder.CreateIndex(
                name: "IX_routingrules_tenantid_rulename",
                table: "routingrules",
                columns: new[] { "tenantid", "rulename" });

            migrationBuilder.CreateIndex(
                name: "IX_socialmessages_assigneddepartmentid",
                table: "socialmessages",
                column: "assigneddepartmentid");

            migrationBuilder.CreateIndex(
                name: "IX_socialmessages_jobid",
                table: "socialmessages",
                column: "jobid");

            migrationBuilder.CreateIndex(
                name: "ix_socialmessages_tenant_channel_external_unique",
                table: "socialmessages",
                columns: new[] { "tenantid", "channel", "externalmessageid" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_socialmessages_tenantid_status_receivedatutc",
                table: "socialmessages",
                columns: new[] { "tenantid", "status", "receivedatutc" });

            migrationBuilder.CreateIndex(
                name: "IX_tasks_jobid",
                table: "tasks",
                column: "jobid");

            migrationBuilder.CreateIndex(
                name: "IX_tasks_tenantid_assigneddepartmentid",
                table: "tasks",
                columns: new[] { "tenantid", "assigneddepartmentid" });

            migrationBuilder.CreateIndex(
                name: "IX_tasks_tenantid_assigneduserid",
                table: "tasks",
                columns: new[] { "tenantid", "assigneduserid" });

            migrationBuilder.CreateIndex(
                name: "IX_tasks_tenantid_currentstatus",
                table: "tasks",
                columns: new[] { "tenantid", "currentstatus" });

            migrationBuilder.CreateIndex(
                name: "IX_tasks_tenantid_duedateutc",
                table: "tasks",
                columns: new[] { "tenantid", "duedateutc" });

            migrationBuilder.CreateIndex(
                name: "IX_tasks_tenantid_jobid",
                table: "tasks",
                columns: new[] { "tenantid", "jobid" });

            migrationBuilder.CreateIndex(
                name: "IX_tenants_displayname",
                table: "tenants",
                column: "displayname");

            migrationBuilder.CreateIndex(
                name: "ix_tenants_domain_unique",
                table: "tenants",
                column: "domain",
                unique: true,
                filter: "domain IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_tenants_municipalityname",
                table: "tenants",
                column: "municipalityname");

            migrationBuilder.CreateIndex(
                name: "ix_tenantsettings_tenantid_unique",
                table: "tenantsettings",
                column: "tenantid",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_users_departmentid",
                table: "users",
                column: "departmentid");

            migrationBuilder.CreateIndex(
                name: "IX_users_tenantid_email",
                table: "users",
                columns: new[] { "tenantid", "email" });

            migrationBuilder.CreateIndex(
                name: "IX_users_tenantid_rolecode",
                table: "users",
                columns: new[] { "tenantid", "rolecode" });

            migrationBuilder.CreateIndex(
                name: "ix_users_tenantid_username_unique",
                table: "users",
                columns: new[] { "tenantid", "username" },
                unique: true,
                filter: "username IS NOT NULL");
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
                name: "jobdepartments");

            migrationBuilder.DropTable(
                name: "notifications");

            migrationBuilder.DropTable(
                name: "pushsubscriptions");

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
                name: "jobs");

            migrationBuilder.DropTable(
                name: "departments");

            migrationBuilder.DropTable(
                name: "tenants");
        }
    }
}

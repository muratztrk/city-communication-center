using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CityCommunicationCenter.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTenantAppearanceAndIndexConventions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_tasks_tenantid",
                table: "tasks");

            migrationBuilder.DropIndex(
                name: "IX_socialmessages_tenantid",
                table: "socialmessages");

            migrationBuilder.DropIndex(
                name: "IX_departments_tenantid",
                table: "departments");

            migrationBuilder.DropIndex(
                name: "IX_assignmenthistory_taskid",
                table: "assignmenthistory");

            migrationBuilder.DropIndex(
                name: "IX_approvals_taskid",
                table: "approvals");

            migrationBuilder.RenameIndex(
                name: "IX_users_tenantid_username",
                table: "users",
                newName: "ix_users_tenantid_username_unique");

            migrationBuilder.RenameIndex(
                name: "IX_tenantsettings_tenantid",
                table: "tenantsettings",
                newName: "ix_tenantsettings_tenantid_unique");

            migrationBuilder.AddColumn<string>(
                name: "appearancejson",
                table: "tenantsettings",
                type: "text",
                nullable: true);

            migrationBuilder.Sql("""
                UPDATE tenants AS tenants
                SET domain = tenantsettings.domain
                FROM tenantsettings
                WHERE tenants.tenantid = tenantsettings.tenantid
                  AND tenants.domain IS NULL
                  AND tenantsettings.domain IS NOT NULL;
                """);

            migrationBuilder.Sql("""
                UPDATE tenantsettings
                SET domain = NULL
                WHERE domain IS NOT NULL;
                """);

            migrationBuilder.UpdateData(
                table: "tenantsettings",
                keyColumn: "tenantsettingid",
                keyValue: new Guid("3f3efab4-c18c-4dd2-a227-c28af61d4fd5"),
                column: "appearancejson",
                value: "{\"themePreset\":\"tire-civic\",\"primaryColor\":\"#0F4C81\",\"secondaryColor\":\"#2B6EA6\",\"accentColor\":\"#C6932D\",\"neutralColor\":\"#6A7786\",\"surfaceColor\":\"#FFFFFF\",\"backgroundColor\":\"#EEF3F8\",\"headerGradientFrom\":\"#123B63\",\"headerGradientTo\":\"#356F99\",\"sidebarBackgroundColor\":\"#102F4A\",\"sidebarForegroundColor\":\"#F6F8FB\"}");

            migrationBuilder.CreateIndex(
                name: "IX_users_tenantid_email",
                table: "users",
                columns: new[] { "tenantid", "email" });

            migrationBuilder.CreateIndex(
                name: "IX_users_tenantid_rolecode",
                table: "users",
                columns: new[] { "tenantid", "rolecode" });

            migrationBuilder.CreateIndex(
                name: "IX_tenants_displayname",
                table: "tenants",
                column: "displayname");

            migrationBuilder.CreateIndex(
                name: "IX_tenants_municipalityname",
                table: "tenants",
                column: "municipalityname");

            migrationBuilder.CreateIndex(
                name: "ix_tenants_domain_unique",
                table: "tenants",
                column: "domain",
                unique: true,
                filter: "domain IS NOT NULL");

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
                name: "IX_socialmessages_tenantid_status_receivedatutc",
                table: "socialmessages",
                columns: new[] { "tenantid", "status", "receivedatutc" });

            migrationBuilder.CreateIndex(
                name: "ix_socialmessages_tenant_channel_external_unique",
                table: "socialmessages",
                columns: new[] { "tenantid", "channel", "externalmessageid" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_routingrules_tenantid_isactive_priority",
                table: "routingrules",
                columns: new[] { "tenantid", "isactive", "priority" });

            migrationBuilder.CreateIndex(
                name: "IX_routingrules_tenantid_rulename",
                table: "routingrules",
                columns: new[] { "tenantid", "rulename" });

            migrationBuilder.CreateIndex(
                name: "IX_notifications_tenantid_taskid",
                table: "notifications",
                columns: new[] { "tenantid", "taskid" });

            migrationBuilder.CreateIndex(
                name: "IX_notifications_tenantid_userid_deliverystatus",
                table: "notifications",
                columns: new[] { "tenantid", "userid", "deliverystatus" });

            migrationBuilder.CreateIndex(
                name: "IX_departments_tenantid_manageruserid",
                table: "departments",
                columns: new[] { "tenantid", "manageruserid" });

            migrationBuilder.CreateIndex(
                name: "IX_departments_tenantid_name",
                table: "departments",
                columns: new[] { "tenantid", "name" });

            migrationBuilder.CreateIndex(
                name: "IX_auditlogs_tenantid_entitytype_entityid",
                table: "auditlogs",
                columns: new[] { "tenantid", "entitytype", "entityid" });

            migrationBuilder.CreateIndex(
                name: "IX_auditlogs_tenantid_eventtimeutc",
                table: "auditlogs",
                columns: new[] { "tenantid", "eventtimeutc" });

            migrationBuilder.CreateIndex(
                name: "IX_assignmenthistory_taskid_actiondateutc",
                table: "assignmenthistory",
                columns: new[] { "taskid", "actiondateutc" });

            migrationBuilder.CreateIndex(
                name: "IX_assignmenthistory_tenantid_todepartmentid",
                table: "assignmenthistory",
                columns: new[] { "tenantid", "todepartmentid" });

            migrationBuilder.CreateIndex(
                name: "IX_approvals_taskid_steporder",
                table: "approvals",
                columns: new[] { "taskid", "steporder" });

            migrationBuilder.CreateIndex(
                name: "IX_approvals_tenantid_approveruserid",
                table: "approvals",
                columns: new[] { "tenantid", "approveruserid" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_users_tenantid_email",
                table: "users");

            migrationBuilder.DropIndex(
                name: "IX_users_tenantid_rolecode",
                table: "users");

            migrationBuilder.DropIndex(
                name: "IX_tenants_displayname",
                table: "tenants");

            migrationBuilder.DropIndex(
                name: "IX_tenants_municipalityname",
                table: "tenants");

            migrationBuilder.DropIndex(
                name: "ix_tenants_domain_unique",
                table: "tenants");

            migrationBuilder.DropIndex(
                name: "IX_tasks_tenantid_assigneddepartmentid",
                table: "tasks");

            migrationBuilder.DropIndex(
                name: "IX_tasks_tenantid_assigneduserid",
                table: "tasks");

            migrationBuilder.DropIndex(
                name: "IX_tasks_tenantid_currentstatus",
                table: "tasks");

            migrationBuilder.DropIndex(
                name: "IX_tasks_tenantid_duedateutc",
                table: "tasks");

            migrationBuilder.DropIndex(
                name: "IX_socialmessages_tenantid_status_receivedatutc",
                table: "socialmessages");

            migrationBuilder.DropIndex(
                name: "ix_socialmessages_tenant_channel_external_unique",
                table: "socialmessages");

            migrationBuilder.DropIndex(
                name: "IX_routingrules_tenantid_isactive_priority",
                table: "routingrules");

            migrationBuilder.DropIndex(
                name: "IX_routingrules_tenantid_rulename",
                table: "routingrules");

            migrationBuilder.DropIndex(
                name: "IX_notifications_tenantid_taskid",
                table: "notifications");

            migrationBuilder.DropIndex(
                name: "IX_notifications_tenantid_userid_deliverystatus",
                table: "notifications");

            migrationBuilder.DropIndex(
                name: "IX_departments_tenantid_manageruserid",
                table: "departments");

            migrationBuilder.DropIndex(
                name: "IX_departments_tenantid_name",
                table: "departments");

            migrationBuilder.DropIndex(
                name: "IX_auditlogs_tenantid_entitytype_entityid",
                table: "auditlogs");

            migrationBuilder.DropIndex(
                name: "IX_auditlogs_tenantid_eventtimeutc",
                table: "auditlogs");

            migrationBuilder.DropIndex(
                name: "IX_assignmenthistory_taskid_actiondateutc",
                table: "assignmenthistory");

            migrationBuilder.DropIndex(
                name: "IX_assignmenthistory_tenantid_todepartmentid",
                table: "assignmenthistory");

            migrationBuilder.DropIndex(
                name: "IX_approvals_taskid_steporder",
                table: "approvals");

            migrationBuilder.DropIndex(
                name: "IX_approvals_tenantid_approveruserid",
                table: "approvals");

            migrationBuilder.DropColumn(
                name: "appearancejson",
                table: "tenantsettings");

            migrationBuilder.RenameIndex(
                name: "ix_users_tenantid_username_unique",
                table: "users",
                newName: "IX_users_tenantid_username");

            migrationBuilder.RenameIndex(
                name: "ix_tenantsettings_tenantid_unique",
                table: "tenantsettings",
                newName: "IX_tenantsettings_tenantid");

            migrationBuilder.CreateIndex(
                name: "IX_tasks_tenantid",
                table: "tasks",
                column: "tenantid");

            migrationBuilder.CreateIndex(
                name: "IX_socialmessages_tenantid",
                table: "socialmessages",
                column: "tenantid");

            migrationBuilder.CreateIndex(
                name: "IX_departments_tenantid",
                table: "departments",
                column: "tenantid");

            migrationBuilder.CreateIndex(
                name: "IX_assignmenthistory_taskid",
                table: "assignmenthistory",
                column: "taskid");

            migrationBuilder.CreateIndex(
                name: "IX_approvals_taskid",
                table: "approvals",
                column: "taskid");
        }
    }
}

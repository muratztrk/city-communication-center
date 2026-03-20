using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CityCommunicationCenter.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPasswordHashAndInstallSeed : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "passwordhash",
                table: "users",
                type: "text",
                nullable: true);

            migrationBuilder.Sql(
                $"""
                INSERT INTO tenants (tenantid, municipalityname, displayname, deploymentmode, isactive, createdatutc)
                VALUES ('{InitialData.TenantId}', 'Tire Belediyesi', 'Tire Belediyesi', 'DedicatedHosted', TRUE, TIMESTAMPTZ '2026-03-19T00:00:00Z')
                ON CONFLICT (tenantid) DO UPDATE
                SET municipalityname = EXCLUDED.municipalityname,
                    displayname = EXCLUDED.displayname,
                    deploymentmode = EXCLUDED.deploymentmode,
                    isactive = EXCLUDED.isactive;

                INSERT INTO departments (departmentid, name, departmenttype, parentdepartmentid, manageruserid, tenantid, createdatutc, createdbyuserid, updatedatutc, updatedbyuserid)
                VALUES
                    ('{InitialData.AdminDepartmentId}', 'Sistem Yönetimi', 'Administration', NULL, '{InitialData.AdminUserId}', '{InitialData.TenantId}', TIMESTAMPTZ '2026-03-19T00:00:00Z', '{InitialData.AdminUserId}', NULL, NULL),
                    ('{InitialData.PublicWorksDepartmentId}', 'Fen İşleri Müdürlüğü', 'Müdürlük', NULL, '{InitialData.PublicWorksManagerUserId}', '{InitialData.TenantId}', TIMESTAMPTZ '2026-03-19T00:00:00Z', '{InitialData.AdminUserId}', NULL, NULL),
                    ('{InitialData.CommunicationsDepartmentId}', 'Basın Yayın Müdürlüğü', 'Müdürlük', NULL, NULL, '{InitialData.TenantId}', TIMESTAMPTZ '2026-03-19T00:00:00Z', '{InitialData.AdminUserId}', NULL, NULL)
                ON CONFLICT (departmentid) DO UPDATE
                SET name = EXCLUDED.name,
                    departmenttype = EXCLUDED.departmenttype,
                    manageruserid = EXCLUDED.manageruserid,
                    tenantid = EXCLUDED.tenantid,
                    updatedatutc = TIMESTAMPTZ '2026-03-19T00:00:00Z',
                    updatedbyuserid = '{InitialData.AdminUserId}';

                INSERT INTO users (userid, departmentid, displayname, email, passwordhash, externalidentityid, manageruserid, rolecode, isactive, tenantid, createdatutc, createdbyuserid, updatedatutc, updatedbyuserid)
                VALUES
                    ('{InitialData.AdminUserId}', '{InitialData.AdminDepartmentId}', 'Sistem Yöneticisi', 'admin@tire.bel.tr', NULL, NULL, NULL, 'SystemAdmin', TRUE, '{InitialData.TenantId}', TIMESTAMPTZ '2026-03-19T00:00:00Z', '{InitialData.AdminUserId}', NULL, NULL),
                    ('{InitialData.PublicWorksManagerUserId}', '{InitialData.PublicWorksDepartmentId}', 'Zeynep Kara', 'zeynep.kara@tire.bel.tr', NULL, NULL, NULL, 'Manager', TRUE, '{InitialData.TenantId}', TIMESTAMPTZ '2026-03-19T00:00:00Z', '{InitialData.AdminUserId}', NULL, NULL),
                    ('{InitialData.PublicWorksStaffUserId}', '{InitialData.PublicWorksDepartmentId}', 'Emre Çelik', 'emre.celik@tire.bel.tr', NULL, NULL, '{InitialData.PublicWorksManagerUserId}', 'Staff', TRUE, '{InitialData.TenantId}', TIMESTAMPTZ '2026-03-19T00:00:00Z', '{InitialData.AdminUserId}', NULL, NULL),
                    ('{InitialData.CommunicationsStaffUserId}', '{InitialData.CommunicationsDepartmentId}', 'Ali Yıldız', 'ali.yildiz@tire.bel.tr', NULL, NULL, NULL, 'Operator', TRUE, '{InitialData.TenantId}', TIMESTAMPTZ '2026-03-19T00:00:00Z', '{InitialData.AdminUserId}', NULL, NULL)
                ON CONFLICT (userid) DO UPDATE
                SET departmentid = EXCLUDED.departmentid,
                    displayname = EXCLUDED.displayname,
                    email = EXCLUDED.email,
                    manageruserid = EXCLUDED.manageruserid,
                    rolecode = EXCLUDED.rolecode,
                    isactive = EXCLUDED.isactive,
                    tenantid = EXCLUDED.tenantid,
                    passwordhash = COALESCE(users.passwordhash, EXCLUDED.passwordhash),
                    updatedatutc = TIMESTAMPTZ '2026-03-19T00:00:00Z',
                    updatedbyuserid = '{InitialData.AdminUserId}';

                INSERT INTO tenantsettings (tenantsettingid, displayname, theme, domain, defaultslahours, autoroutingenabled, socialsettingsjson, tenantid, createdatutc, createdbyuserid, updatedatutc, updatedbyuserid)
                VALUES ('{InitialData.TenantSettingId}', 'Tire Belediyesi', NULL, NULL, 48, TRUE, NULL, '{InitialData.TenantId}', TIMESTAMPTZ '2026-03-19T00:00:00Z', '{InitialData.AdminUserId}', NULL, NULL)
                ON CONFLICT (tenantsettingid) DO UPDATE
                SET displayname = EXCLUDED.displayname,
                    defaultslahours = EXCLUDED.defaultslahours,
                    autoroutingenabled = EXCLUDED.autoroutingenabled,
                    tenantid = EXCLUDED.tenantid,
                    updatedatutc = TIMESTAMPTZ '2026-03-19T00:00:00Z',
                    updatedbyuserid = '{InitialData.AdminUserId}';

                INSERT INTO tasks (taskid, title, description, tasktype, sourcetype, sourcerefid, targetdepartmentid, assigneddepartmentid, assigneduserid, currentstatus, priority, duedateutc, completedatutc, closedatutc, tenantid, createdatutc, createdbyuserid, updatedatutc, updatedbyuserid)
                VALUES ('{InitialData.SampleTaskId}', 'Ornek altyapi inceleme gorevi', 'Ilk kurulum sonrasi arayuz kontrolu icin eklenen ornek gorev.', 'CitizenRequest', 'Manual', NULL, '{InitialData.PublicWorksDepartmentId}', '{InitialData.PublicWorksDepartmentId}', '{InitialData.PublicWorksStaffUserId}', 'Assigned', 'Normal', TIMESTAMPTZ '2026-03-21T00:00:00Z', NULL, NULL, '{InitialData.TenantId}', TIMESTAMPTZ '2026-03-19T00:00:00Z', '{InitialData.AdminUserId}', NULL, NULL)
                ON CONFLICT (taskid) DO UPDATE
                SET title = EXCLUDED.title,
                    description = EXCLUDED.description,
                    tasktype = EXCLUDED.tasktype,
                    sourcetype = EXCLUDED.sourcetype,
                    targetdepartmentid = EXCLUDED.targetdepartmentid,
                    assigneddepartmentid = EXCLUDED.assigneddepartmentid,
                    assigneduserid = EXCLUDED.assigneduserid,
                    currentstatus = EXCLUDED.currentstatus,
                    priority = EXCLUDED.priority,
                    duedateutc = EXCLUDED.duedateutc,
                    tenantid = EXCLUDED.tenantid,
                    updatedatutc = TIMESTAMPTZ '2026-03-19T00:00:00Z',
                    updatedbyuserid = '{InitialData.AdminUserId}';

                INSERT INTO socialmessages (socialmessageid, channel, externalmessageid, citizenhandle, content, category, tags, status, assigneddepartmentid, taskid, receivedatutc, responsecontent, respondedatutc, tenantid, createdatutc, createdbyuserid, updatedatutc, updatedbyuserid)
                VALUES ('{InitialData.SampleSocialMessageId}', 'Instagram', 'demo-instagram-message-1', 'tire.vatandas', 'Yolda cukur var, ekip yonlendirebilir misiniz?', 'Altyapi', '', 'Routed', '{InitialData.PublicWorksDepartmentId}', NULL, TIMESTAMPTZ '2026-03-18T20:00:00Z', NULL, NULL, '{InitialData.TenantId}', TIMESTAMPTZ '2026-03-19T00:00:00Z', '{InitialData.AdminUserId}', NULL, NULL)
                ON CONFLICT (socialmessageid) DO UPDATE
                SET channel = EXCLUDED.channel,
                    externalmessageid = EXCLUDED.externalmessageid,
                    citizenhandle = EXCLUDED.citizenhandle,
                    content = EXCLUDED.content,
                    category = EXCLUDED.category,
                    status = EXCLUDED.status,
                    assigneddepartmentid = EXCLUDED.assigneddepartmentid,
                    tenantid = EXCLUDED.tenantid,
                    updatedatutc = TIMESTAMPTZ '2026-03-19T00:00:00Z',
                    updatedbyuserid = '{InitialData.AdminUserId}';

                INSERT INTO routingrules (ruleid, tenantid, rulename, keywords, targetdepartmentid, priority, isactive, createdatutc)
                VALUES ('{InitialData.SampleRoutingRuleId}', '{InitialData.TenantId}', 'Altyapi Talepleri', 'altyapi,cukur,yol,asfalt', '{InitialData.PublicWorksDepartmentId}', 90, TRUE, TIMESTAMPTZ '2026-03-19T00:00:00Z')
                ON CONFLICT (ruleid) DO UPDATE
                SET tenantid = EXCLUDED.tenantid,
                    rulename = EXCLUDED.rulename,
                    keywords = EXCLUDED.keywords,
                    targetdepartmentid = EXCLUDED.targetdepartmentid,
                    priority = EXCLUDED.priority,
                    isactive = EXCLUDED.isactive;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                $"""
                DELETE FROM routingrules WHERE ruleid = '{InitialData.SampleRoutingRuleId}';
                DELETE FROM socialmessages WHERE socialmessageid = '{InitialData.SampleSocialMessageId}';
                DELETE FROM tasks WHERE taskid = '{InitialData.SampleTaskId}';
                DELETE FROM tenantsettings WHERE tenantsettingid = '{InitialData.TenantSettingId}';
                DELETE FROM users WHERE userid IN ('{InitialData.AdminUserId}', '{InitialData.PublicWorksManagerUserId}', '{InitialData.PublicWorksStaffUserId}', '{InitialData.CommunicationsStaffUserId}');
                DELETE FROM departments WHERE departmentid IN ('{InitialData.AdminDepartmentId}', '{InitialData.PublicWorksDepartmentId}', '{InitialData.CommunicationsDepartmentId}');
                DELETE FROM tenants WHERE tenantid = '{InitialData.TenantId}';
                """);

            migrationBuilder.DropColumn(
                name: "passwordhash",
                table: "users");
        }
    }
}

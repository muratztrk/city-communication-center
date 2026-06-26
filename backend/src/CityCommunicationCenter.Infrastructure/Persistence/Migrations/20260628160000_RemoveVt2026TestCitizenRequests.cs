using CityCommunicationCenter.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CityCommunicationCenter.Infrastructure.Persistence.Migrations;

[DbContext(typeof(CityCommunicationCenterDbContext))]
[Migration("20260628160000_RemoveVt2026TestCitizenRequests")]
public partial class RemoveVt2026TestCitizenRequests : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            UPDATE socialmessages sm
            SET assigneddepartmentid = jd.departmentid
            FROM jobdepartments jd
            WHERE sm.jobid = jd.jobid
              AND jd.role = 'Target'
              AND sm.assigneddepartmentid IS DISTINCT FROM jd.departmentid;

            WITH numbered_messages AS (
                SELECT socialmessageid, jobid
                FROM socialmessages
                WHERE tenantid = 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e'
                  AND citizenrequestnumberyear = 2026
                  AND citizenrequestnumber IN (1, 2)
            ),
            numbered_jobs AS (
                SELECT DISTINCT jobid
                FROM numbered_messages
                WHERE jobid IS NOT NULL
            )
            DELETE FROM tasks
            WHERE jobid IN (SELECT jobid FROM numbered_jobs);

            WITH numbered_messages AS (
                SELECT socialmessageid, jobid
                FROM socialmessages
                WHERE tenantid = 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e'
                  AND citizenrequestnumberyear = 2026
                  AND citizenrequestnumber IN (1, 2)
            ),
            numbered_jobs AS (
                SELECT DISTINCT jobid
                FROM numbered_messages
                WHERE jobid IS NOT NULL
            )
            DELETE FROM jobdepartments
            WHERE jobid IN (SELECT jobid FROM numbered_jobs);

            WITH numbered_messages AS (
                SELECT socialmessageid, jobid
                FROM socialmessages
                WHERE tenantid = 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e'
                  AND citizenrequestnumberyear = 2026
                  AND citizenrequestnumber IN (1, 2)
            ),
            numbered_jobs AS (
                SELECT DISTINCT jobid
                FROM numbered_messages
                WHERE jobid IS NOT NULL
            )
            DELETE FROM approvals
            WHERE subjecttype = 'Job'
              AND subjectid IN (SELECT jobid FROM numbered_jobs);

            WITH numbered_messages AS (
                SELECT socialmessageid, jobid
                FROM socialmessages
                WHERE tenantid = 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e'
                  AND citizenrequestnumberyear = 2026
                  AND citizenrequestnumber IN (1, 2)
            ),
            numbered_jobs AS (
                SELECT DISTINCT jobid
                FROM numbered_messages
                WHERE jobid IS NOT NULL
            )
            DELETE FROM jobs
            WHERE jobid IN (SELECT jobid FROM numbered_jobs);

            DELETE FROM socialmessages
            WHERE tenantid = 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e'
              AND citizenrequestnumberyear = 2026
              AND citizenrequestnumber IN (1, 2);
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
    }
}

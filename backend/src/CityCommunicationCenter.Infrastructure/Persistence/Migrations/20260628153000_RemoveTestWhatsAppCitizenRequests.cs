using CityCommunicationCenter.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CityCommunicationCenter.Infrastructure.Persistence.Migrations;

[DbContext(typeof(CityCommunicationCenterDbContext))]
[Migration("20260628153000_RemoveTestWhatsAppCitizenRequests")]
public partial class RemoveTestWhatsAppCitizenRequests : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            WITH test_messages AS (
                SELECT sm.socialmessageid, sm.jobid
                FROM socialmessages sm
                LEFT JOIN citizenconversations cc
                    ON cc.citizenconversationid = sm.citizenconversationid
                WHERE sm.tenantid = 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e'
                  AND (
                    sm.citizenhandle IN ('905547616022', '905546720461', '5547616022', '5546720461')
                    OR cc.citizenphone IN ('905547616022', '905546720461', '5547616022', '5546720461')
                  )
            ),
            test_jobs AS (
                SELECT DISTINCT jobid
                FROM test_messages
                WHERE jobid IS NOT NULL
            )
            DELETE FROM tasks
            WHERE jobid IN (SELECT jobid FROM test_jobs);

            WITH test_messages AS (
                SELECT sm.socialmessageid, sm.jobid
                FROM socialmessages sm
                LEFT JOIN citizenconversations cc
                    ON cc.citizenconversationid = sm.citizenconversationid
                WHERE sm.tenantid = 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e'
                  AND (
                    sm.citizenhandle IN ('905547616022', '905546720461', '5547616022', '5546720461')
                    OR cc.citizenphone IN ('905547616022', '905546720461', '5547616022', '5546720461')
                  )
            ),
            test_jobs AS (
                SELECT DISTINCT jobid
                FROM test_messages
                WHERE jobid IS NOT NULL
            )
            DELETE FROM jobdepartments
            WHERE jobid IN (SELECT jobid FROM test_jobs);

            WITH test_messages AS (
                SELECT sm.socialmessageid, sm.jobid
                FROM socialmessages sm
                LEFT JOIN citizenconversations cc
                    ON cc.citizenconversationid = sm.citizenconversationid
                WHERE sm.tenantid = 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e'
                  AND (
                    sm.citizenhandle IN ('905547616022', '905546720461', '5547616022', '5546720461')
                    OR cc.citizenphone IN ('905547616022', '905546720461', '5547616022', '5546720461')
                  )
            ),
            test_jobs AS (
                SELECT DISTINCT jobid
                FROM test_messages
                WHERE jobid IS NOT NULL
            )
            DELETE FROM approvals
            WHERE subjecttype = 'Job'
              AND subjectid IN (SELECT jobid FROM test_jobs);

            WITH test_messages AS (
                SELECT sm.socialmessageid, sm.jobid
                FROM socialmessages sm
                LEFT JOIN citizenconversations cc
                    ON cc.citizenconversationid = sm.citizenconversationid
                WHERE sm.tenantid = 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e'
                  AND (
                    sm.citizenhandle IN ('905547616022', '905546720461', '5547616022', '5546720461')
                    OR cc.citizenphone IN ('905547616022', '905546720461', '5547616022', '5546720461')
                  )
            ),
            test_jobs AS (
                SELECT DISTINCT jobid
                FROM test_messages
                WHERE jobid IS NOT NULL
            )
            DELETE FROM jobs
            WHERE jobid IN (SELECT jobid FROM test_jobs);

            DELETE FROM socialmessages
            WHERE tenantid = 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e'
              AND (
                citizenhandle IN ('905547616022', '905546720461', '5547616022', '5546720461')
                OR citizenconversationid IN (
                    SELECT citizenconversationid
                    FROM citizenconversations
                    WHERE tenantid = 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e'
                      AND citizenphone IN ('905547616022', '905546720461', '5547616022', '5546720461')
                )
              );

            DELETE FROM citizenconversations
            WHERE tenantid = 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e'
              AND citizenphone IN ('905547616022', '905546720461', '5547616022', '5546720461');
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
    }
}

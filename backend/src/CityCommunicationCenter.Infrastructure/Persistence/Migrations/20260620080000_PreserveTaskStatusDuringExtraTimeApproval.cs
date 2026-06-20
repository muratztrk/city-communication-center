using CityCommunicationCenter.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CityCommunicationCenter.Infrastructure.Persistence.Migrations;

[DbContext(typeof(CityCommunicationCenterDbContext))]
[Migration("20260620080000_PreserveTaskStatusDuringExtraTimeApproval")]
public partial class PreserveTaskStatusDuringExtraTimeApproval : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        // Older extra-time requests overwrote the operational status with RevisionRequested.
        // Restore the actionable status while the pending approval remains the source of the request state.
        migrationBuilder.Sql("""
            UPDATE tasks
            SET currentstatus = CASE
                WHEN COALESCE(completionpercentage, 0) > 0 THEN 'InProgress'
                ELSE 'Assigned'
            END
            WHERE currentstatus = 'RevisionRequested'
              AND EXISTS (
                  SELECT 1
                  FROM approvals
                  WHERE approvals.subjecttype = 'TaskRevision'
                    AND approvals.subjectid = tasks.taskid
                    AND approvals.decision = 'Pending'
              );
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
    }
}

using CityCommunicationCenter.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CityCommunicationCenter.Infrastructure.Persistence.Migrations;

[DbContext(typeof(CityCommunicationCenterDbContext))]
[Migration("20260915140000_BackfillSmsOutboundRecipientPhone")]
public partial class BackfillSmsOutboundRecipientPhone : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            UPDATE smsoutboundlogs sol
            SET recipientphone = u.phone
            FROM users u
            WHERE sol.recipientphone IS NULL
              AND sol.recipientuserid IS NOT NULL
              AND sol.recipientuserid = u.userid
              AND u.phone IS NOT NULL
              AND TRIM(u.phone) <> '';
            """);

        migrationBuilder.Sql("""
            UPDATE smsoutboundlogs sol
            SET recipientphone = j.citizenphone
            FROM jobs j
            WHERE sol.recipientphone IS NULL
              AND sol.jobid IS NOT NULL
              AND sol.jobid = j.jobid
              AND j.citizenphone IS NOT NULL
              AND TRIM(j.citizenphone) <> '';
            """);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
    }
}

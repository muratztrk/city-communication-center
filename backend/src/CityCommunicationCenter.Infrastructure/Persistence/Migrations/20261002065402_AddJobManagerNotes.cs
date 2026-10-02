using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CityCommunicationCenter.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddJobManagerNotes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "jobmanagernotes",
                columns: table => new
                {
                    noteid = table.Column<Guid>(type: "uuid", nullable: false),
                    jobid = table.Column<Guid>(type: "uuid", nullable: false),
                    authoruserid = table.Column<Guid>(type: "uuid", nullable: false),
                    authordisplayname = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    text = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    tenantid = table.Column<Guid>(type: "uuid", nullable: false),
                    createdatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    createdbyuserid = table.Column<Guid>(type: "uuid", nullable: true),
                    updatedatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    updatedbyuserid = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_jobmanagernotes", x => x.noteid);
                });

            migrationBuilder.CreateIndex(
                name: "IX_jobmanagernotes_jobid_authoruserid",
                table: "jobmanagernotes",
                columns: new[] { "jobid", "authoruserid" },
                unique: true);

            // Mevcut tek yönetici notlarını yeni tabloya taşı. Yazar, notu en son ekleyen kişinin
            // denetim kaydından okunur; kayıt yoksa talebi oluşturan/güncelleyen kullanıcı kullanılır.
            migrationBuilder.Sql(@"
INSERT INTO jobmanagernotes (noteid, jobid, authoruserid, authordisplayname, text, tenantid, createdatutc, createdbyuserid, updatedatutc, updatedbyuserid)
SELECT gen_random_uuid(),
       j.jobid,
       COALESCE(a.actoruserid, j.updatedbyuserid, j.createdbyuserid, '00000000-0000-0000-0000-000000000000'::uuid),
       a.actordisplayname,
       LEFT(btrim(j.managernote), 100),
       j.tenantid,
       COALESCE(a.eventtimeutc, j.updatedatutc, j.createdatutc),
       a.actoruserid,
       NULL,
       NULL
FROM jobs j
LEFT JOIN LATERAL (
    SELECT al.actoruserid, al.actordisplayname, al.eventtimeutc
    FROM auditlogs al
    WHERE al.entitytype = 'Job' AND al.entityid = j.jobid::text AND al.action = 'JobManagerNoteAdded'
    ORDER BY al.eventtimeutc DESC
    LIMIT 1
) a ON TRUE
WHERE j.managernote IS NOT NULL AND btrim(j.managernote) <> '';
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "jobmanagernotes");
        }
    }
}

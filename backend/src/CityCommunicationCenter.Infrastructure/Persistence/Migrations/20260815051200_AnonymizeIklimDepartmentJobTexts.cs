using CityCommunicationCenter.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CityCommunicationCenter.Infrastructure.Persistence.Migrations;

[DbContext(typeof(CityCommunicationCenterDbContext))]
[Migration("20260815051200_AnonymizeIklimDepartmentJobTexts")]
public partial class AnonymizeIklimDepartmentJobTexts : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        // Tek seferlik test anonimleştirme (#2625) — migration bir kez uygulanır.
        migrationBuilder.Sql("""
            UPDATE jobs j
            SET title = 'test',
                description = 'test',
                updatedatutc = NOW()
            FROM departments d
            WHERE j.ownerdepartmentid = d.departmentid
              AND (
                d.name = 'İklim Değişikliği ve Sıfır Atık Müdürlüğü'
                OR d.name ILIKE '%İklim Değişikliği ve Sıfır Atık Müdürlüğü%'
              );
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
    }
}

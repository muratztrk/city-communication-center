using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CityCommunicationCenter.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class SyncBelediyeSoapSnapshot : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "belediyekodu",
                table: "tenantsettings",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "edevletbasvurular",
                columns: table => new
                {
                    basvuruid = table.Column<Guid>(type: "uuid", nullable: false),
                    takipno = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    basvurunumber = table.Column<int>(type: "integer", nullable: false),
                    basvurunumberyear = table.Column<int>(type: "integer", nullable: false),
                    citizentckimlikno = table.Column<string>(type: "character varying(11)", maxLength: 11, nullable: false),
                    citizenfirstname = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    citizenlastname = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    basvurutipi = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    description = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    email = table.Column<string>(type: "text", nullable: true),
                    phonenumbersjson = table.Column<string>(type: "text", nullable: true),
                    ilcekodu = table.Column<string>(type: "text", nullable: true),
                    ilceadi = table.Column<string>(type: "text", nullable: true),
                    mahallekodu = table.Column<string>(type: "text", nullable: true),
                    mahalleadi = table.Column<string>(type: "text", nullable: true),
                    sokakcaddekodu = table.Column<string>(type: "text", nullable: true),
                    sokakcaddeadi = table.Column<string>(type: "text", nullable: true),
                    diskapino = table.Column<string>(type: "text", nullable: true),
                    ickapino = table.Column<string>(type: "text", nullable: true),
                    openaddress = table.Column<string>(type: "text", nullable: true),
                    nviadresno = table.Column<string>(type: "text", nullable: true),
                    latitude = table.Column<double>(type: "double precision", nullable: true),
                    longitude = table.Column<double>(type: "double precision", nullable: true),
                    cevapsekli = table.Column<string>(type: "text", nullable: true),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    jobid = table.Column<Guid>(type: "uuid", nullable: true),
                    tenantid = table.Column<Guid>(type: "uuid", nullable: false),
                    createdatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    createdbyuserid = table.Column<Guid>(type: "uuid", nullable: true),
                    updatedatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    updatedbyuserid = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_edevletbasvurular", x => x.basvuruid);
                    table.ForeignKey(
                        name: "FK_edevletbasvurular_jobs_jobid",
                        column: x => x.jobid,
                        principalTable: "jobs",
                        principalColumn: "jobid",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "edevletbasvuruattachments",
                columns: table => new
                {
                    attachmentid = table.Column<Guid>(type: "uuid", nullable: false),
                    basvuruid = table.Column<Guid>(type: "uuid", nullable: false),
                    dosyacesidi = table.Column<string>(type: "text", nullable: false),
                    dosyauzanti = table.Column<string>(type: "text", nullable: false),
                    belgetarihi = table.Column<string>(type: "text", nullable: true),
                    belgesayisi = table.Column<string>(type: "text", nullable: true),
                    storedfilename = table.Column<string>(type: "text", nullable: false),
                    originalfilename = table.Column<string>(type: "text", nullable: false),
                    contenttype = table.Column<string>(type: "text", nullable: false),
                    sizebytes = table.Column<long>(type: "bigint", nullable: false),
                    tenantid = table.Column<Guid>(type: "uuid", nullable: false),
                    createdatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    createdbyuserid = table.Column<Guid>(type: "uuid", nullable: true),
                    updatedatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    updatedbyuserid = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_edevletbasvuruattachments", x => x.attachmentid);
                    table.ForeignKey(
                        name: "FK_edevletbasvuruattachments_edevletbasvurular_basvuruid",
                        column: x => x.basvuruid,
                        principalTable: "edevletbasvurular",
                        principalColumn: "basvuruid",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.UpdateData(
                table: "tenantsettings",
                keyColumn: "tenantsettingid",
                keyValue: new Guid("3f3efab4-c18c-4dd2-a227-c28af61d4fd5"),
                column: "belediyekodu",
                value: null);

            migrationBuilder.CreateIndex(
                name: "ix_tenantsettings_belediyekodu_unique",
                table: "tenantsettings",
                column: "belediyekodu",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_edevletbasvuruattachments_basvuruid",
                table: "edevletbasvuruattachments",
                column: "basvuruid");

            migrationBuilder.CreateIndex(
                name: "IX_edevletbasvurular_jobid",
                table: "edevletbasvurular",
                column: "jobid");

            migrationBuilder.CreateIndex(
                name: "ix_edevletbasvurular_tenantid_takipno_unique",
                table: "edevletbasvurular",
                columns: new[] { "tenantid", "takipno" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_edevletbasvurular_tenantid_citizentckimlikno_status",
                table: "edevletbasvurular",
                columns: new[] { "tenantid", "citizentckimlikno", "status" });

            migrationBuilder.CreateIndex(
                name: "IX_edevletbasvurular_tenantid_status_createdatutc",
                table: "edevletbasvurular",
                columns: new[] { "tenantid", "status", "createdatutc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "edevletbasvuruattachments");

            migrationBuilder.DropTable(
                name: "edevletbasvurular");

            migrationBuilder.DropIndex(
                name: "ix_tenantsettings_belediyekodu_unique",
                table: "tenantsettings");

            migrationBuilder.DropColumn(
                name: "belediyekodu",
                table: "tenantsettings");
        }
    }
}

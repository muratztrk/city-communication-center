using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CityCommunicationCenter.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddBilgilendirmeIstekleri : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "bilgilendirmeistekleri",
                columns: table => new
                {
                    bilgilendirmeistegiid = table.Column<Guid>(type: "uuid", nullable: false),
                    citizentckimlikno = table.Column<string>(type: "character varying(11)", maxLength: 11, nullable: false),
                    adi = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    soyadi = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    eposta = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    cepulkekodu = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    ceptelefonno = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    mahallelistesijson = table.Column<string>(type: "text", nullable: true),
                    smskategorikodlarijson = table.Column<string>(type: "text", nullable: true),
                    epostakategorikodlarijson = table.Column<string>(type: "text", nullable: true),
                    belediyeiletisimbilgisiniguncelle = table.Column<bool>(type: "boolean", nullable: false),
                    isactive = table.Column<bool>(type: "boolean", nullable: false),
                    cancelledatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    tenantid = table.Column<Guid>(type: "uuid", nullable: false),
                    createdatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    createdbyuserid = table.Column<Guid>(type: "uuid", nullable: true),
                    updatedatutc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    updatedbyuserid = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bilgilendirmeistekleri", x => x.bilgilendirmeistegiid);
                });

            migrationBuilder.CreateIndex(
                name: "ix_bilgilendirmeistekleri_tenantid_tckimlikno_unique",
                table: "bilgilendirmeistekleri",
                columns: new[] { "tenantid", "citizentckimlikno" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "bilgilendirmeistekleri");
        }
    }
}

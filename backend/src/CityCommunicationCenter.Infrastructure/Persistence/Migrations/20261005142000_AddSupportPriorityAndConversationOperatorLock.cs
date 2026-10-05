using System;
using CityCommunicationCenter.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CityCommunicationCenter.Infrastructure.Persistence.Migrations;

[DbContext(typeof(CityCommunicationCenterDbContext))]
[Migration("20261005142000_AddSupportPriorityAndConversationOperatorLock")]
public partial class AddSupportPriorityAndConversationOperatorLock : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "operatorlockedatutc",
                table: "citizenconversations",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "operatorlockedbydisplayname",
                table: "citizenconversations",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "operatorlockedbyuserid",
                table: "citizenconversations",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "priority",
                table: "supportrequests",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "Normal");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "operatorlockedatutc",
                table: "citizenconversations");

            migrationBuilder.DropColumn(
                name: "operatorlockedbydisplayname",
                table: "citizenconversations");

            migrationBuilder.DropColumn(
                name: "operatorlockedbyuserid",
                table: "citizenconversations");

            migrationBuilder.DropColumn(
                name: "priority",
                table: "supportrequests");
        }
    }

using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CityCommunicationCenter.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddWorkTaskOwnerUserId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "owneruserid",
                table: "tasks",
                type: "uuid",
                nullable: true);

            migrationBuilder.UpdateData(
                table: "tasks",
                keyColumn: "taskid",
                keyValue: new Guid("6de6e0b3-a74e-4f24-bdbc-4d6e0cb6d38c"),
                column: "owneruserid",
                value: null);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "owneruserid",
                table: "tasks");
        }
    }
}

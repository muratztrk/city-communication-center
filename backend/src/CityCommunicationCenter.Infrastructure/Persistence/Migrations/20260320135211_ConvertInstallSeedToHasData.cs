using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace CityCommunicationCenter.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ConvertInstallSeedToHasData : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "routingrules",
                keyColumn: "ruleid",
                keyValue: new Guid("d306cbf0-88ad-48b7-9b16-14bb87e77f5f"));

            migrationBuilder.DeleteData(
                table: "socialmessages",
                keyColumn: "socialmessageid",
                keyValue: new Guid("8e90888d-dc75-4264-a78b-f0a7abc9a9ab"));

            migrationBuilder.DeleteData(
                table: "tasks",
                keyColumn: "taskid",
                keyValue: new Guid("6de6e0b3-a74e-4f24-bdbc-4d6e0cb6d38c"));

            migrationBuilder.DeleteData(
                table: "tenantsettings",
                keyColumn: "tenantsettingid",
                keyValue: new Guid("3f3efab4-c18c-4dd2-a227-c28af61d4fd5"));

            migrationBuilder.DeleteData(
                table: "users",
                keyColumn: "userid",
                keyValue: new Guid("1358d4aa-b1ae-486c-a1db-a757ea18f2c3"));

            migrationBuilder.DeleteData(
                table: "users",
                keyColumn: "userid",
                keyValue: new Guid("1e96916a-889a-4701-a0e6-71dc6571ac18"));

            migrationBuilder.DeleteData(
                table: "users",
                keyColumn: "userid",
                keyValue: new Guid("4b1efb47-0311-4ef7-9a0c-f4c41dcb8b48"));

            migrationBuilder.DeleteData(
                table: "users",
                keyColumn: "userid",
                keyValue: new Guid("d6fc7a5b-5cb2-4c59-8a82-7843041421a5"));

            migrationBuilder.DeleteData(
                table: "departments",
                keyColumn: "departmentid",
                keyValue: new Guid("0e29fb34-64da-429e-b7c0-e6016a0c10a7"));

            migrationBuilder.DeleteData(
                table: "departments",
                keyColumn: "departmentid",
                keyValue: new Guid("6d146a0d-611c-48a5-b59e-8c14a22f6a2e"));

            migrationBuilder.DeleteData(
                table: "departments",
                keyColumn: "departmentid",
                keyValue: new Guid("8f7264ff-c1df-48eb-bf39-a6ff42d7e9bc"));

            migrationBuilder.DeleteData(
                table: "tenants",
                keyColumn: "tenantid",
                keyValue: new Guid("b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e"));

            migrationBuilder.InsertData(
                table: "routingrules",
                columns: new[] { "ruleid", "createdatutc", "isactive", "keywords", "priority", "rulename", "targetdepartmentid", "tenantid" },
                values: new object[] { new Guid("d306cbf0-88ad-48b7-9b16-14bb87e77f5f"), new DateTimeOffset(new DateTime(2026, 3, 19, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), true, "altyapı,çukur,yol,asfalt", 90, "Altyapı Talepleri", new Guid("0e29fb34-64da-429e-b7c0-e6016a0c10a7"), new Guid("b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e") });

            migrationBuilder.InsertData(
                table: "tenants",
                columns: new[] { "tenantid", "createdatutc", "deploymentmode", "displayname", "domain", "isactive", "municipalityname", "theme" },
                values: new object[] { new Guid("b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e"), new DateTimeOffset(new DateTime(2026, 3, 19, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), "DedicatedHosted", "Tire Belediyesi", null, true, "Tire Belediyesi", null });

            migrationBuilder.InsertData(
                table: "tenantsettings",
                columns: new[] { "tenantsettingid", "autoroutingenabled", "createdatutc", "createdbyuserid", "defaultslahours", "displayname", "domain", "socialsettingsjson", "tenantid", "theme", "updatedatutc", "updatedbyuserid" },
                values: new object[] { new Guid("3f3efab4-c18c-4dd2-a227-c28af61d4fd5"), true, new DateTimeOffset(new DateTime(2026, 3, 19, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), new Guid("4b1efb47-0311-4ef7-9a0c-f4c41dcb8b48"), 48, "Tire Belediyesi", null, null, new Guid("b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e"), null, null, null });

            migrationBuilder.InsertData(
                table: "departments",
                columns: new[] { "departmentid", "createdatutc", "createdbyuserid", "departmenttype", "manageruserid", "name", "parentdepartmentid", "tenantid", "updatedatutc", "updatedbyuserid" },
                values: new object[,]
                {
                    { new Guid("0e29fb34-64da-429e-b7c0-e6016a0c10a7"), new DateTimeOffset(new DateTime(2026, 3, 19, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), new Guid("4b1efb47-0311-4ef7-9a0c-f4c41dcb8b48"), "Müdürlük", new Guid("d6fc7a5b-5cb2-4c59-8a82-7843041421a5"), "Fen İşleri Müdürlüğü", null, new Guid("b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e"), null, null },
                    { new Guid("6d146a0d-611c-48a5-b59e-8c14a22f6a2e"), new DateTimeOffset(new DateTime(2026, 3, 19, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), new Guid("4b1efb47-0311-4ef7-9a0c-f4c41dcb8b48"), "Administration", new Guid("4b1efb47-0311-4ef7-9a0c-f4c41dcb8b48"), "Sistem Yönetimi", null, new Guid("b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e"), null, null },
                    { new Guid("8f7264ff-c1df-48eb-bf39-a6ff42d7e9bc"), new DateTimeOffset(new DateTime(2026, 3, 19, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), new Guid("4b1efb47-0311-4ef7-9a0c-f4c41dcb8b48"), "Müdürlük", null, "Basın Yayın Müdürlüğü", null, new Guid("b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e"), null, null }
                });

            migrationBuilder.InsertData(
                table: "tasks",
                columns: new[] { "taskid", "assigneddepartmentid", "assigneduserid", "closedatutc", "completedatutc", "createdatutc", "createdbyuserid", "currentstatus", "description", "duedateutc", "priority", "sourcerefid", "sourcetype", "targetdepartmentid", "tasktype", "tenantid", "title", "updatedatutc", "updatedbyuserid" },
                values: new object[] { new Guid("6de6e0b3-a74e-4f24-bdbc-4d6e0cb6d38c"), new Guid("0e29fb34-64da-429e-b7c0-e6016a0c10a7"), new Guid("1358d4aa-b1ae-486c-a1db-a757ea18f2c3"), null, null, new DateTimeOffset(new DateTime(2026, 3, 19, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), new Guid("4b1efb47-0311-4ef7-9a0c-f4c41dcb8b48"), "Assigned", "İlk kurulum sonrası arayüz kontrolü için eklenen örnek görev.", new DateTimeOffset(new DateTime(2026, 3, 21, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), "Normal", null, "Manual", new Guid("0e29fb34-64da-429e-b7c0-e6016a0c10a7"), "CitizenRequest", new Guid("b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e"), "Örnek altyapı inceleme görevi", null, null });

            migrationBuilder.InsertData(
                table: "socialmessages",
                columns: new[] { "socialmessageid", "assigneddepartmentid", "category", "channel", "citizenhandle", "content", "createdatutc", "createdbyuserid", "externalmessageid", "receivedatutc", "respondedatutc", "responsecontent", "status", "tags", "taskid", "tenantid", "updatedatutc", "updatedbyuserid" },
                values: new object[] { new Guid("8e90888d-dc75-4264-a78b-f0a7abc9a9ab"), new Guid("0e29fb34-64da-429e-b7c0-e6016a0c10a7"), "Altyapı", "Instagram", "tire.vatandas", "Yolda çukur var, ekip yönlendirebilir misiniz?", new DateTimeOffset(new DateTime(2026, 3, 19, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), new Guid("4b1efb47-0311-4ef7-9a0c-f4c41dcb8b48"), "demo-instagram-message-1", new DateTimeOffset(new DateTime(2026, 3, 18, 20, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), null, null, "Routed", "", null, new Guid("b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e"), null, null });

            migrationBuilder.InsertData(
                table: "users",
                columns: new[] { "userid", "createdatutc", "createdbyuserid", "departmentid", "displayname", "email", "externalidentityid", "isactive", "manageruserid", "passwordhash", "rolecode", "tenantid", "updatedatutc", "updatedbyuserid" },
                values: new object[,]
                {
                    { new Guid("1358d4aa-b1ae-486c-a1db-a757ea18f2c3"), new DateTimeOffset(new DateTime(2026, 3, 19, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), new Guid("4b1efb47-0311-4ef7-9a0c-f4c41dcb8b48"), new Guid("0e29fb34-64da-429e-b7c0-e6016a0c10a7"), "Emre Çelik", "emre.celik@tire.bel.tr", null, true, new Guid("d6fc7a5b-5cb2-4c59-8a82-7843041421a5"), null, "Staff", new Guid("b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e"), null, null },
                    { new Guid("1e96916a-889a-4701-a0e6-71dc6571ac18"), new DateTimeOffset(new DateTime(2026, 3, 19, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), new Guid("4b1efb47-0311-4ef7-9a0c-f4c41dcb8b48"), new Guid("8f7264ff-c1df-48eb-bf39-a6ff42d7e9bc"), "Ali Yıldız", "ali.yildiz@tire.bel.tr", null, true, null, null, "Operator", new Guid("b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e"), null, null },
                    { new Guid("4b1efb47-0311-4ef7-9a0c-f4c41dcb8b48"), new DateTimeOffset(new DateTime(2026, 3, 19, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), new Guid("4b1efb47-0311-4ef7-9a0c-f4c41dcb8b48"), new Guid("6d146a0d-611c-48a5-b59e-8c14a22f6a2e"), "Sistem Yöneticisi", "admin@tire.bel.tr", null, true, null, null, "SystemAdmin", new Guid("b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e"), null, null },
                    { new Guid("d6fc7a5b-5cb2-4c59-8a82-7843041421a5"), new DateTimeOffset(new DateTime(2026, 3, 19, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), new Guid("4b1efb47-0311-4ef7-9a0c-f4c41dcb8b48"), new Guid("0e29fb34-64da-429e-b7c0-e6016a0c10a7"), "Zeynep Kara", "zeynep.kara@tire.bel.tr", null, true, null, null, "Manager", new Guid("b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e"), null, null }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "routingrules",
                keyColumn: "ruleid",
                keyValue: new Guid("d306cbf0-88ad-48b7-9b16-14bb87e77f5f"));

            migrationBuilder.DeleteData(
                table: "socialmessages",
                keyColumn: "socialmessageid",
                keyValue: new Guid("8e90888d-dc75-4264-a78b-f0a7abc9a9ab"));

            migrationBuilder.DeleteData(
                table: "tasks",
                keyColumn: "taskid",
                keyValue: new Guid("6de6e0b3-a74e-4f24-bdbc-4d6e0cb6d38c"));

            migrationBuilder.DeleteData(
                table: "tenantsettings",
                keyColumn: "tenantsettingid",
                keyValue: new Guid("3f3efab4-c18c-4dd2-a227-c28af61d4fd5"));

            migrationBuilder.DeleteData(
                table: "users",
                keyColumn: "userid",
                keyValue: new Guid("1358d4aa-b1ae-486c-a1db-a757ea18f2c3"));

            migrationBuilder.DeleteData(
                table: "users",
                keyColumn: "userid",
                keyValue: new Guid("1e96916a-889a-4701-a0e6-71dc6571ac18"));

            migrationBuilder.DeleteData(
                table: "users",
                keyColumn: "userid",
                keyValue: new Guid("4b1efb47-0311-4ef7-9a0c-f4c41dcb8b48"));

            migrationBuilder.DeleteData(
                table: "users",
                keyColumn: "userid",
                keyValue: new Guid("d6fc7a5b-5cb2-4c59-8a82-7843041421a5"));

            migrationBuilder.DeleteData(
                table: "departments",
                keyColumn: "departmentid",
                keyValue: new Guid("0e29fb34-64da-429e-b7c0-e6016a0c10a7"));

            migrationBuilder.DeleteData(
                table: "departments",
                keyColumn: "departmentid",
                keyValue: new Guid("6d146a0d-611c-48a5-b59e-8c14a22f6a2e"));

            migrationBuilder.DeleteData(
                table: "departments",
                keyColumn: "departmentid",
                keyValue: new Guid("8f7264ff-c1df-48eb-bf39-a6ff42d7e9bc"));

            migrationBuilder.DeleteData(
                table: "tenants",
                keyColumn: "tenantid",
                keyValue: new Guid("b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e"));
        }
    }
}

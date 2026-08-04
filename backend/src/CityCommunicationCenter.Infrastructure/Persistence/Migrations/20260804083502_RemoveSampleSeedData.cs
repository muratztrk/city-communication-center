using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace CityCommunicationCenter.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RemoveSampleSeedData : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "jobdepartments",
                keyColumn: "jobdepartmentid",
                keyValue: new Guid("7c2d4e1f-5b8a-4d3c-9e6f-1a2b3c4d5e62"));

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
                keyValue: new Guid("d6fc7a5b-5cb2-4c59-8a82-7843041421a5"));

            migrationBuilder.DeleteData(
                table: "departments",
                keyColumn: "departmentid",
                keyValue: new Guid("8f7264ff-c1df-48eb-bf39-a6ff42d7e9bc"));

            migrationBuilder.DeleteData(
                table: "jobs",
                keyColumn: "jobid",
                keyValue: new Guid("9a5b3f2e-6c1a-4b0d-8e7f-2d3c4b5a6987"));

            migrationBuilder.DeleteData(
                table: "departments",
                keyColumn: "departmentid",
                keyValue: new Guid("0e29fb34-64da-429e-b7c0-e6016a0c10a7"));
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.InsertData(
                table: "departments",
                columns: new[] { "departmentid", "createdatutc", "createdbyuserid", "departmenttype", "deputymanageruserid", "manageruserid", "name", "parentdepartmentid", "responsibleuseridsjson", "sourcetype", "tenantid", "updatedatutc", "updatedbyuserid" },
                values: new object[,]
                {
                    { new Guid("0e29fb34-64da-429e-b7c0-e6016a0c10a7"), new DateTimeOffset(new DateTime(2026, 3, 19, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), new Guid("4b1efb47-0311-4ef7-9a0c-f4c41dcb8b48"), "Müdürlük", null, new Guid("d6fc7a5b-5cb2-4c59-8a82-7843041421a5"), "Fen İşleri Müdürlüğü", null, "[]", "Manual", new Guid("b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e"), null, null },
                    { new Guid("8f7264ff-c1df-48eb-bf39-a6ff42d7e9bc"), new DateTimeOffset(new DateTime(2026, 3, 19, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), new Guid("4b1efb47-0311-4ef7-9a0c-f4c41dcb8b48"), "Müdürlük", null, null, "Basın Yayın Müdürlüğü", null, "[]", "Manual", new Guid("b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e"), null, null }
                });

            migrationBuilder.InsertData(
                table: "routingrules",
                columns: new[] { "ruleid", "createdatutc", "isactive", "keywords", "priority", "rulename", "targetdepartmentid", "tenantid" },
                values: new object[] { new Guid("d306cbf0-88ad-48b7-9b16-14bb87e77f5f"), new DateTimeOffset(new DateTime(2026, 3, 19, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), true, "altyapı,çukur,yol,asfalt", 90, "Altyapı Talepleri", new Guid("0e29fb34-64da-429e-b7c0-e6016a0c10a7"), new Guid("b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e") });

            migrationBuilder.InsertData(
                table: "jobs",
                columns: new[] { "jobid", "cancelreason", "citizenname", "citizenphone", "citizenterminalmessagereleasedatutc", "completedatutc", "completionpercentage", "createdatutc", "createdbyuserid", "description", "duedateutc", "iscoordinated", "isproject", "isprojectcreatorrequested", "isprojectownerconfirmed", "jobnumber", "jobnumberyear", "latitude", "longitude", "managernote", "neighborhood", "openaddress", "ownerdepartmentid", "priority", "requesttype", "sourcerefid", "sourcetype", "startdateutc", "status", "street", "tenantid", "title", "updatedatutc", "updatedbyuserid" },
                values: new object[] { new Guid("9a5b3f2e-6c1a-4b0d-8e7f-2d3c4b5a6987"), null, null, null, null, null, null, new DateTimeOffset(new DateTime(2026, 3, 19, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), new Guid("4b1efb47-0311-4ef7-9a0c-f4c41dcb8b48"), "İlk kurulum sonrası arayüz kontrolü için eklenen örnek iş.", new DateTimeOffset(new DateTime(2026, 3, 21, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), false, false, false, false, null, null, null, null, null, null, null, new Guid("0e29fb34-64da-429e-b7c0-e6016a0c10a7"), "Normal", "InternalUnit", null, "Manual", null, "Active", null, new Guid("b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e"), "Örnek altyapı inceleme işi", null, null });

            migrationBuilder.InsertData(
                table: "socialmessages",
                columns: new[] { "socialmessageid", "assigneddepartmentid", "category", "channel", "citizenconversationid", "citizenhandle", "citizenrequestnumber", "citizenrequestnumberyear", "content", "createdatutc", "createdbyuserid", "externalmessageid", "jobid", "latitude", "longitude", "receivedatutc", "respondedatutc", "responsecontent", "status", "tags", "tenantid", "updatedatutc", "updatedbyuserid" },
                values: new object[] { new Guid("8e90888d-dc75-4264-a78b-f0a7abc9a9ab"), new Guid("0e29fb34-64da-429e-b7c0-e6016a0c10a7"), "Altyapı", "Instagram", null, "tire.vatandas", null, null, "Yolda çukur var, ekip yönlendirebilir misiniz?", new DateTimeOffset(new DateTime(2026, 3, 19, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), new Guid("4b1efb47-0311-4ef7-9a0c-f4c41dcb8b48"), "demo-instagram-message-1", null, null, null, new DateTimeOffset(new DateTime(2026, 3, 18, 20, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), null, null, "Routed", "", new Guid("b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e"), null, null });

            migrationBuilder.InsertData(
                table: "users",
                columns: new[] { "userid", "activesessionid", "additionalrolecodesjson", "createdatutc", "createdbyuserid", "departmentid", "displayname", "email", "externalidentityid", "isactive", "manageruserid", "passwordhash", "phone", "rolecode", "tenantid", "title", "updatedatutc", "updatedbyuserid", "usersource", "username" },
                values: new object[,]
                {
                    { new Guid("1358d4aa-b1ae-486c-a1db-a757ea18f2c3"), null, null, new DateTimeOffset(new DateTime(2026, 3, 19, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), new Guid("4b1efb47-0311-4ef7-9a0c-f4c41dcb8b48"), new Guid("0e29fb34-64da-429e-b7c0-e6016a0c10a7"), "Emre Çelik", "emre.celik@tire.bel.tr", null, true, new Guid("d6fc7a5b-5cb2-4c59-8a82-7843041421a5"), null, null, "Staff", new Guid("b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e"), null, null, null, "Manual", "emre.celik" },
                    { new Guid("1e96916a-889a-4701-a0e6-71dc6571ac18"), null, null, new DateTimeOffset(new DateTime(2026, 3, 19, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), new Guid("4b1efb47-0311-4ef7-9a0c-f4c41dcb8b48"), new Guid("8f7264ff-c1df-48eb-bf39-a6ff42d7e9bc"), "Ali Yıldız", "ali.yildiz@tire.bel.tr", null, true, null, null, null, "Operator", new Guid("b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e"), null, null, null, "Manual", "ali.yildiz" },
                    { new Guid("d6fc7a5b-5cb2-4c59-8a82-7843041421a5"), null, null, new DateTimeOffset(new DateTime(2026, 3, 19, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), new Guid("4b1efb47-0311-4ef7-9a0c-f4c41dcb8b48"), new Guid("0e29fb34-64da-429e-b7c0-e6016a0c10a7"), "Zeynep Kara", "zeynep.kara@tire.bel.tr", null, true, null, null, null, "Manager", new Guid("b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e"), null, null, null, "Manual", "zeynep.kara" }
                });

            migrationBuilder.InsertData(
                table: "jobdepartments",
                columns: new[] { "jobdepartmentid", "approvalstatus", "approvedbyuserid", "createdatutc", "createdbyuserid", "decidedatutc", "departmentid", "jobid", "notes", "rejectreason", "requestedatutc", "requestedbyuserid", "role", "tenantid", "updatedatutc", "updatedbyuserid" },
                values: new object[] { new Guid("7c2d4e1f-5b8a-4d3c-9e6f-1a2b3c4d5e62"), "Approved", new Guid("d6fc7a5b-5cb2-4c59-8a82-7843041421a5"), new DateTimeOffset(new DateTime(2026, 3, 19, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), new Guid("4b1efb47-0311-4ef7-9a0c-f4c41dcb8b48"), new DateTimeOffset(new DateTime(2026, 3, 19, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), new Guid("0e29fb34-64da-429e-b7c0-e6016a0c10a7"), new Guid("9a5b3f2e-6c1a-4b0d-8e7f-2d3c4b5a6987"), null, null, new DateTimeOffset(new DateTime(2026, 3, 19, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), new Guid("4b1efb47-0311-4ef7-9a0c-f4c41dcb8b48"), "Owner", new Guid("b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e"), null, null });

            migrationBuilder.InsertData(
                table: "tasks",
                columns: new[] { "taskid", "actualhours", "assignedatutc", "assigneddepartmentid", "assigneduserid", "assigningmanagerid", "completedatutc", "completionpercentage", "createdatutc", "createdbyuserid", "currentstatus", "description", "duedateutc", "estimatedhours", "jobid", "notes", "owneruserid", "priority", "revisionreason", "startdateutc", "tasknumber", "tasknumberyear", "tenantid", "title", "updatedatutc", "updatedbyuserid" },
                values: new object[] { new Guid("6de6e0b3-a74e-4f24-bdbc-4d6e0cb6d38c"), null, null, new Guid("0e29fb34-64da-429e-b7c0-e6016a0c10a7"), new Guid("1358d4aa-b1ae-486c-a1db-a757ea18f2c3"), new Guid("d6fc7a5b-5cb2-4c59-8a82-7843041421a5"), null, null, new DateTimeOffset(new DateTime(2026, 3, 19, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), new Guid("4b1efb47-0311-4ef7-9a0c-f4c41dcb8b48"), "Assigned", "İlk kurulum sonrası arayüz kontrolü için eklenen örnek görev.", new DateTimeOffset(new DateTime(2026, 3, 21, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), null, new Guid("9a5b3f2e-6c1a-4b0d-8e7f-2d3c4b5a6987"), null, null, "Normal", null, null, null, null, new Guid("b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e"), "Örnek altyapı inceleme görevi", null, null });
        }
    }
}

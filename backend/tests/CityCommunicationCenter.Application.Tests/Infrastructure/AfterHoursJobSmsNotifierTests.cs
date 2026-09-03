using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Domain.Entities;
using CityCommunicationCenter.Domain.Enums;
using CityCommunicationCenter.Infrastructure.Persistence;
using CityCommunicationCenter.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace CityCommunicationCenter.Application.Tests.Infrastructure;

public sealed class AfterHoursJobSmsNotifierTests
{
    private static readonly Guid TenantId = Guid.Parse("b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e");
    private static readonly Guid DepartmentId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid ManagerId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static readonly Guid DeputyId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private static readonly Guid ResponsibleId = Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc");
    private static readonly Guid StaffId = Guid.Parse("dddddddd-dddd-dddd-dddd-dddddddddddd");
    private static readonly Guid CrmId = Guid.Parse("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee");
    private static readonly Guid JobId = Guid.Parse("ffffffff-ffff-ffff-ffff-ffffffffffff");

    [Fact]
    public async Task NotifyJobCreatedAsync_sends_manager_template_only()
    {
        await using var db = CreateDbContext();
        await SeedAsync(db);
        var gateway = new RecordingSmsGateway();
        var notifier = CreateNotifier(db, gateway, afterHours: true);

        var job = CreateJob();
        await notifier.NotifyJobCreatedAsync(job, [DepartmentId], CancellationToken.None);

        Assert.Single(gateway.Sends);
        Assert.Equal("Yönetici mesajı", gateway.Sends[0].Text);
        Assert.Equal("905551111111", gateway.Sends[0].Phone);
    }

    [Fact]
    public async Task NotifyJobCreatedAsync_does_not_blast_staff_on_job_create()
    {
        await using var db = CreateDbContext();
        await SeedAsync(db);
        var gateway = new RecordingSmsGateway();
        var notifier = CreateNotifier(db, gateway, afterHours: true);

        var job = CreateJob();
        await notifier.NotifyJobCreatedAsync(job, [DepartmentId], CancellationToken.None);

        Assert.DoesNotContain(gateway.Sends, send => send.Text == "Personel mesajı");
    }

    [Fact]
    public async Task NotifyTaskAssignedAsync_sends_staff_template_to_assignee()
    {
        await using var db = CreateDbContext();
        await SeedAsync(db);
        var gateway = new RecordingSmsGateway();
        var notifier = CreateNotifier(db, gateway, afterHours: true);

        var job = CreateJob();
        await notifier.NotifyTaskAssignedAsync(job, StaffId, DepartmentId, CancellationToken.None);

        Assert.Single(gateway.Sends);
        Assert.Equal("Personel mesajı", gateway.Sends[0].Text);
        Assert.Equal("905554444444", gateway.Sends[0].Phone);
    }

    [Fact]
    public async Task NotifyTaskAssignedAsync_skips_when_assignee_already_manager_recipient()
    {
        await using var db = CreateDbContext();
        await SeedAsync(db);
        var gateway = new RecordingSmsGateway();
        var notifier = CreateNotifier(db, gateway, afterHours: true);

        var job = CreateJob();
        await notifier.NotifyTaskAssignedAsync(job, ManagerId, DepartmentId, CancellationToken.None);

        Assert.Empty(gateway.Sends);
    }

    [Fact]
    public async Task NotifyJobCreatedAsync_excludes_deputy_manager()
    {
        await using var db = CreateDbContext();
        await SeedAsync(db);
        var gateway = new RecordingSmsGateway();
        var notifier = CreateNotifier(db, gateway, afterHours: true);

        var job = CreateJob();
        await notifier.NotifyJobCreatedAsync(job, [DepartmentId], CancellationToken.None);

        Assert.DoesNotContain(gateway.Sends, send => send.Phone == "905552222222");
    }

    private static AfterHoursJobSmsNotifier CreateNotifier(
        CityCommunicationCenterDbContext db,
        RecordingSmsGateway gateway,
        bool afterHours)
    {
        var workingHours = new FixedWorkingHoursService(afterHours);
        return new AfterHoursJobSmsNotifier(
            db,
            workingHours,
            gateway,
            NullLogger<AfterHoursJobSmsNotifier>.Instance);
    }

    private static Job CreateJob() => new()
    {
        JobId = JobId,
        TenantId = TenantId,
        OwnerDepartmentId = DepartmentId,
        Title = "Test",
        Description = "Test",
        Status = JobStatus.Active,
        RequestType = JobRequestType.Citizen,
        SourceType = JobSourceType.CitizenRequest,
        Priority = "Normal",
    };

    private static async Task SeedAsync(CityCommunicationCenterDbContext db)
    {
        db.Tenants.Add(new Tenant
        {
            TenantId = TenantId,
            MunicipalityName = "Test",
            DisplayName = "Test",
            IsActive = true,
        });

        db.Departments.Add(new Department
        {
            TenantId = TenantId,
            DepartmentId = DepartmentId,
            Name = "Bilgi İşlem",
            DepartmentType = "Müdürlük",
            ManagerUserId = ManagerId,
            DeputyManagerUserId = DeputyId,
            ResponsibleUserIdsJson = $"[\"{ResponsibleId}\"]",
        });

        db.Users.AddRange(
            User(ManagerId, RoleCode.Manager, "905551111111"),
            User(DeputyId, RoleCode.Manager, "905552222222"),
            User(ResponsibleId, RoleCode.Staff, phone: null),
            User(StaffId, RoleCode.Staff, "905554444444", DepartmentId),
            User(CrmId, RoleCode.CitizenRequestManager, phone: null));

        db.TenantSettings.Add(new TenantSetting
        {
            TenantId = TenantId,
            CitizenAutoReplyTemplatesJson =
                """
                {
                  "ProcessingReceived": "",
                  "InProgress": "",
                  "Completed": "",
                  "Cancelled": "",
                  "AfterHoursManagerSms": "Yönetici mesajı",
                  "AfterHoursStaffSms": "Personel mesajı",
                  "AfterHoursManagerSmsEnabled": true,
                  "AfterHoursStaffSmsEnabled": true
                }
                """,
        });

        await db.SaveChangesAsync();
    }

    private static ApplicationUser User(Guid id, RoleCode role, string? phone, Guid? departmentId = null) => new()
    {
        UserId = id,
        TenantId = TenantId,
        DisplayName = id.ToString(),
        Email = $"{id:N}@test.local",
        Username = $"{id:N}",
        RoleCode = role,
        DepartmentId = departmentId ?? DepartmentId,
        MobilePhone = phone,
        IsActive = true,
    };

    private static CityCommunicationCenterDbContext CreateDbContext() => new(
        new DbContextOptionsBuilder<CityCommunicationCenterDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private sealed class RecordingSmsGateway : ISmsGateway
    {
        public List<(string Phone, string Text)> Sends { get; } = [];

        public Task<SmsSendResult> SendAsync(
            Guid tenantId,
            string phoneNumber,
            string text,
            SmsSendContext? context = null,
            CancellationToken cancellationToken = default)
        {
            Sends.Add((phoneNumber, text));
            return Task.FromResult(SmsSendResult.Ok("OK"));
        }

        public Task<SmsSendResult> SendTestAsync(
            Guid tenantId,
            string phoneNumber,
            string text,
            SmsSendContext? context = null,
            CancellationToken cancellationToken = default) =>
            SendAsync(tenantId, phoneNumber, text, context, cancellationToken);
    }

    private sealed class FixedWorkingHoursService(bool isAfterHours) : ITenantWorkingHoursService
    {
        private static readonly WorkingHoursDescriptor AlwaysAfterHours = new(
            new WorkingHoursSchedule(
                false,
                Enumerable.Range(0, 7)
                    .Select(day => new WorkingHoursDaySchedule(day, null, null))
                    .ToList()),
            []);

        private static readonly WorkingHoursDescriptor AlwaysBusinessHours = new(
            new WorkingHoursSchedule(true, []),
            []);

        public Task<WorkingHoursDescriptor> GetSettingsAsync(Guid tenantId, CancellationToken cancellationToken = default) =>
            Task.FromResult(isAfterHours ? AlwaysAfterHours : AlwaysBusinessHours);

        public Task SaveSettingsAsync(Guid tenantId, WorkingHoursUpdate settings, Guid? actorUserId, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;
    }
}

using System.Text.Json;
using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Application.Features.Admin;
using CityCommunicationCenter.Domain.Entities;
using CityCommunicationCenter.Domain.Enums;
using CityCommunicationCenter.Infrastructure.Persistence;
using CityCommunicationCenter.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace CityCommunicationCenter.Application.Tests.Infrastructure;

public sealed class JobMailNotifierTests
{
    private static readonly Guid TenantId = Guid.Parse("b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e");
    private static readonly Guid OwnerDepartmentId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid TargetDepartmentId = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid ManagerId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static readonly Guid JobId = Guid.Parse("ffffffff-ffff-ffff-ffff-ffffffffffff");

    [Fact]
    public async Task NotifyIncomingAsync_records_skip_when_manager_has_no_email()
    {
        await using var db = CreateDbContext();
        await SeedAsync(db, managerEmail: null);
        var sender = new RecordingMailSender();
        var notifier = new JobMailNotifier(db, sender, NullLogger<JobMailNotifier>.Instance);

        await notifier.NotifyIncomingAsync(
            CreateJob(),
            [OwnerDepartmentId, TargetDepartmentId],
            actorUserId: null,
            CancellationToken.None);

        Assert.Single(sender.Sends);
        Assert.Equal(string.Empty, sender.Sends[0].Email);
        Assert.Equal(ManagerId, sender.Sends[0].RecipientUserId);
    }

    [Fact]
    public async Task NotifyIncomingAsync_sends_when_manager_has_email()
    {
        await using var db = CreateDbContext();
        await SeedAsync(db, managerEmail: "mudur@test.local");
        var sender = new RecordingMailSender();
        var notifier = new JobMailNotifier(db, sender, NullLogger<JobMailNotifier>.Instance);

        await notifier.NotifyIncomingAsync(
            CreateJob(),
            [OwnerDepartmentId, TargetDepartmentId],
            actorUserId: null,
            CancellationToken.None);

        Assert.Single(sender.Sends);
        Assert.Equal("mudur@test.local", sender.Sends[0].Email);
        Assert.Equal(ManagerId, sender.Sends[0].RecipientUserId);
    }

    [Fact]
    public async Task ProcessOverdueMailsAsync_skips_jobs_already_overdue_when_cursor_missing()
    {
        await using var db = CreateDbContext();
        await SeedAsync(
            db,
            managerEmail: "mudur@test.local",
            overdueMailEnabled: true,
            dueDateUtc: DateTimeOffset.UtcNow.AddDays(-10));
        var sender = new RecordingMailSender();
        var notifier = new JobMailNotifier(db, sender, NullLogger<JobMailNotifier>.Instance);

        await notifier.ProcessOverdueMailsAsync(CancellationToken.None);

        Assert.Empty(sender.Sends);
        var stored = MailNotificationSettingsPayload.ParseOrEmpty(
            db.TenantSettings.Single().MailNotificationSettingsJson);
        Assert.NotNull(stored.OverdueMailCursorUtc);
    }

    [Fact]
    public async Task ProcessOverdueMailsAsync_sends_when_job_became_overdue_after_cursor()
    {
        var cursor = DateTimeOffset.UtcNow.AddHours(-2);
        await using var db = CreateDbContext();
        await SeedAsync(
            db,
            managerEmail: "mudur@test.local",
            overdueMailEnabled: true,
            dueDateUtc: DateTimeOffset.UtcNow.AddMinutes(-10),
            overdueMailCursorUtc: cursor);
        var sender = new RecordingMailSender();
        var notifier = new JobMailNotifier(db, sender, NullLogger<JobMailNotifier>.Instance);

        await notifier.ProcessOverdueMailsAsync(CancellationToken.None);

        Assert.Single(sender.Sends);
        Assert.Equal("mudur@test.local", sender.Sends[0].Email);
    }

    private static Job CreateJob(DateTimeOffset? dueDateUtc = null) => new()
    {
        JobId = JobId,
        TenantId = TenantId,
        OwnerDepartmentId = OwnerDepartmentId,
        Title = "Park bakımı",
        Description = "Test",
        Status = JobStatus.Active,
        RequestType = JobRequestType.ExternalUnit,
        SourceType = JobSourceType.SocialMessage,
        Priority = "Normal",
        JobNumber = 155,
        JobNumberYear = 2026,
        DueDateUtc = dueDateUtc,
    };

    private static async Task SeedAsync(
        CityCommunicationCenterDbContext db,
        string? managerEmail,
        bool overdueMailEnabled = false,
        DateTimeOffset? dueDateUtc = null,
        DateTimeOffset? overdueMailCursorUtc = null)
    {
        db.Tenants.Add(new Tenant
        {
            TenantId = TenantId,
            MunicipalityName = "Test",
            DisplayName = "Test",
            IsActive = true,
        });

        db.Departments.AddRange(
            new Department
            {
                TenantId = TenantId,
                DepartmentId = OwnerDepartmentId,
                Name = "Basın",
                DepartmentType = "Birim",
            },
            new Department
            {
                TenantId = TenantId,
                DepartmentId = TargetDepartmentId,
                Name = "Bilgi İşlem",
                DepartmentType = "Müdürlük",
                ManagerUserId = ManagerId,
            });

        db.Users.Add(new ApplicationUser
        {
            UserId = ManagerId,
            TenantId = TenantId,
            DepartmentId = TargetDepartmentId,
            DisplayName = "Test Müdür",
            Username = "testmudur",
            Email = managerEmail,
            RoleCode = RoleCode.Manager,
            IsActive = true,
        });

        db.Jobs.Add(CreateJob(dueDateUtc));
        db.JobDepartments.Add(new JobDepartment
        {
            JobDepartmentId = Guid.Parse("33333333-3333-3333-3333-333333333333"),
            TenantId = TenantId,
            JobId = JobId,
            DepartmentId = TargetDepartmentId,
            Role = JobDepartmentRole.Target,
            ApprovalStatus = JobApprovalStatus.Pending,
        });

        db.TenantSettings.Add(new TenantSetting
        {
            TenantSettingId = Guid.Parse("44444444-4444-4444-4444-444444444444"),
            TenantId = TenantId,
            MailNotificationSettingsJson = JsonSerializer.Serialize(new MailNotificationSettingsPayload
            {
                IsEnabled = true,
                SmtpHost = "192.168.0.98",
                IncomingMailEnabled = true,
                OverdueMailEnabled = overdueMailEnabled,
                OverdueMailCursorUtc = overdueMailCursorUtc,
                DefaultReplyTo = "tim@tire.bel.tr",
            }),
        });

        await db.SaveChangesAsync();
    }

    private static CityCommunicationCenterDbContext CreateDbContext() => new(
        new DbContextOptionsBuilder<CityCommunicationCenterDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private sealed class RecordingMailSender : IMailNotificationSender
    {
        public List<(string Email, Guid? RecipientUserId)> Sends { get; } = [];

        public Task<MailNotificationSendResult> SendAsync(
            Guid tenantId,
            string recipientEmail,
            string subject,
            string body,
            MailSendContext? context = null,
            CancellationToken cancellationToken = default)
        {
            Sends.Add((recipientEmail, context?.RecipientUserId));
            var ok = !string.IsNullOrWhiteSpace(recipientEmail);
            return Task.FromResult(new MailNotificationSendResult(ok, ok ? "E-posta gönderildi." : "Alıcının e-posta adresi yok."));
        }

        public Task<MailNotificationSendResult> SendTestAsync(
            Guid tenantId,
            MailNotificationTestRequest request,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(new MailNotificationSendResult(true, "ok"));
    }
}

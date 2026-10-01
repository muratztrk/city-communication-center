using CityCommunicationCenter.Application;
using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Application.Features.Notifications;
using CityCommunicationCenter.Domain.Entities;
using CityCommunicationCenter.Domain.Enums;
using CityCommunicationCenter.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CityCommunicationCenter.Application.Tests.Features.Notifications;

public sealed class NotificationFeedTests
{
    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task ManagerNote_TaskAssigneeOrOwner_SeesUnreadNotification(bool ownerOnly)
    {
        await using var db = CreateDb();
        var tenantId = Guid.NewGuid();
        var recipientId = Guid.NewGuid();
        var job = new Job { TenantId = tenantId, JobId = Guid.NewGuid(), Title = "Talep", CreatedByUserId = Guid.NewGuid() };
        db.Jobs.Add(job);
        db.Tasks.Add(new WorkTask
        {
            TenantId = tenantId, TaskId = Guid.NewGuid(), JobId = job.JobId,
            AssignedUserId = ownerOnly ? null : recipientId,
            OwnerUserId = ownerOnly ? recipientId : null,
        });
        var note = AddAudit(db, tenantId, job.JobId, Guid.NewGuid(), "JobManagerNoteAdded");
        if (!ownerOnly)
            AddAudit(db, tenantId, job.JobId, Guid.NewGuid(), "JobCreated");
        // Kendi işlemi ve farklı tenant'taki kayıt bildirim olmamalı.
        AddAudit(db, tenantId, job.JobId, recipientId, "JobManagerNoteAdded");
        AddAudit(db, Guid.NewGuid(), job.JobId, Guid.NewGuid(), "JobManagerNoteAdded");
        await db.SaveChangesAsync();
        var context = Context(tenantId, recipientId, "Staff");

        var feed = await new GetNotificationsQueryHandler(db, context).Handle(new(), default);
        var unread = await new GetUnreadNotificationCountQueryHandler(db, context).Handle(new(recipientId), default);

        Assert.Equal(note.AuditLogId, Assert.Single(feed).NotificationId);
        Assert.Equal(1, unread);
    }

    [Fact]
    public async Task ManagerNote_SelfAssignedManager_DoesNotReceiveOwnNote()
    {
        await using var db = CreateDb();
        var tenantId = Guid.NewGuid();
        var managerId = Guid.NewGuid();
        var job = new Job { TenantId = tenantId, JobId = Guid.NewGuid(), CreatedByUserId = managerId };
        db.Jobs.Add(job);
        db.Tasks.Add(new WorkTask { TenantId = tenantId, TaskId = Guid.NewGuid(), JobId = job.JobId, AssignedUserId = managerId });
        AddAudit(db, tenantId, job.JobId, managerId, "JobManagerNoteAdded");
        await db.SaveChangesAsync();
        var context = Context(tenantId, managerId, "Manager");

        Assert.Empty(await new GetNotificationsQueryHandler(db, context).Handle(new(), default));
        Assert.Equal(0, await new GetUnreadNotificationCountQueryHandler(db, context).Handle(new(managerId), default));
    }

    [Theory]
    [InlineData("Staff", "Birim Dışı Oluşturulan Talep Onaylandı")]
    [InlineData("Reporter", "Birim Dışı Oluşturulan Talep Onaylandı")]
    [InlineData("Manager", "Birim Dışı Gelen Talep")]
    public async Task ExternalApproval_TitleDependsOnRecipientRole(string role, string expected)
    {
        await using var db = CreateDb();
        var tenantId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var job = new Job
        {
            TenantId = tenantId, JobId = Guid.NewGuid(), CreatedByUserId = userId,
            RequestType = JobRequestType.ExternalUnit, Title = "Dış Talep",
        };
        db.Jobs.Add(job);
        AddAudit(db, tenantId, job.JobId, Guid.NewGuid(), "JobOwnerApproved");
        await db.SaveChangesAsync();

        var feed = await new GetNotificationsQueryHandler(db, Context(tenantId, userId, role)).Handle(new(), default);

        Assert.Equal(expected, Assert.Single(feed).Title);
    }

    private static AuditLog AddAudit(CityCommunicationCenterDbContext db, Guid tenantId, Guid jobId, Guid actorId, string action)
    {
        var audit = new AuditLog
        {
            TenantId = tenantId, AuditLogId = Guid.NewGuid(), EntityType = nameof(Job),
            EntityId = jobId.ToString(), ActorUserId = actorId, Action = action,
            EventTimeUtc = DateTimeOffset.UtcNow, Notes = "Not",
        };
        db.AuditLogs.Add(audit);
        return audit;
    }

    private static CityCommunicationCenterDbContext CreateDb() => new(
        new DbContextOptionsBuilder<CityCommunicationCenterDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    private static TestTenantContextAccessor Context(Guid tenantId, Guid userId, string role) =>
        new(new TenantContext(tenantId, userId, "Test", role, true, "claims", null, true));

    private sealed class TestTenantContextAccessor(TenantContext context) : ITenantContextAccessor
    {
        public TenantContext GetCurrent() => context;
    }
}

using CityCommunicationCenter.Application.Features.Jobs;
using CityCommunicationCenter.Domain.Entities;
using CityCommunicationCenter.Domain.Enums;
using CityCommunicationCenter.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CityCommunicationCenter.Application.Tests.Features.Jobs;

public sealed class CitizenJobTargetApprovalTests
{
    private static readonly Guid TenantId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid OwnerDepartmentId = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid TargetDepartmentId = Guid.Parse("33333333-3333-3333-3333-333333333333");
    private static readonly Guid CreatorId = Guid.Parse("44444444-4444-4444-4444-444444444444");
    private static readonly Guid OwnerManagerId = Guid.Parse("55555555-5555-5555-5555-555555555555");
    private static readonly Guid TargetManagerId = Guid.Parse("66666666-6666-6666-6666-666666666666");

    [Fact]
    public async Task FirstTargetTask_ReplacesOwnerManagerAutomaticApproval_WithTargetManager()
    {
        await using var dbContext = CreateDbContext();
        var job = BuildExternalJob();
        var target = BuildApprovedTarget(job.JobId, OwnerManagerId);
        dbContext.AddRange(job, target);
        await dbContext.SaveChangesAsync();
        var approvedAt = DateTimeOffset.UtcNow;

        var changed = await CitizenJobTargetApproval.TryRecordTargetApprovalAsync(
            dbContext,
            job,
            TargetDepartmentId,
            TargetManagerId,
            approvedAt,
            CancellationToken.None);

        Assert.True(changed);
        Assert.Equal(TargetManagerId, target.ApprovedByUserId);
        Assert.Equal(approvedAt, target.DecidedAtUtc);
    }

    [Fact]
    public async Task LaterTargetTask_DoesNotReplaceExistingTargetManagerApproval()
    {
        await using var dbContext = CreateDbContext();
        var job = BuildExternalJob();
        var target = BuildApprovedTarget(job.JobId, TargetManagerId);
        dbContext.AddRange(job, target, new WorkTask
        {
            TaskId = Guid.NewGuid(),
            TenantId = TenantId,
            JobId = job.JobId,
            Title = "İlk hedef görevi",
            Description = "Test",
            AssignedDepartmentId = TargetDepartmentId,
        });
        await dbContext.SaveChangesAsync();

        var changed = await CitizenJobTargetApproval.TryRecordTargetApprovalAsync(
            dbContext,
            job,
            TargetDepartmentId,
            OwnerManagerId,
            DateTimeOffset.UtcNow,
            CancellationToken.None);

        Assert.False(changed);
        Assert.Equal(TargetManagerId, target.ApprovedByUserId);
    }

    private static Job BuildExternalJob() => new()
    {
        JobId = Guid.NewGuid(),
        TenantId = TenantId,
        Title = "Birim dışı talep",
        Description = "Test",
        OwnerDepartmentId = OwnerDepartmentId,
        RequestType = JobRequestType.ExternalUnit,
        Status = JobStatus.Active,
        CreatedByUserId = CreatorId,
    };

    private static JobDepartment BuildApprovedTarget(Guid jobId, Guid approverId) => new()
    {
        JobDepartmentId = Guid.NewGuid(),
        TenantId = TenantId,
        JobId = jobId,
        DepartmentId = TargetDepartmentId,
        Role = JobDepartmentRole.Target,
        ApprovalStatus = JobApprovalStatus.Approved,
        ApprovedByUserId = approverId,
        DecidedAtUtc = DateTimeOffset.UtcNow.AddMinutes(-1),
    };

    private static CityCommunicationCenterDbContext CreateDbContext() => new(
        new DbContextOptionsBuilder<CityCommunicationCenterDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);
}

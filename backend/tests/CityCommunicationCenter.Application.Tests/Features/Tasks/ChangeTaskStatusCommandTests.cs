using CityCommunicationCenter.Application;
using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Application.Features.Tasks;
using CityCommunicationCenter.Domain.Entities;
using CityCommunicationCenter.Domain.Enums;
using CityCommunicationCenter.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using WorkflowTaskStatus = CityCommunicationCenter.Domain.Enums.TaskStatus;

namespace CityCommunicationCenter.Application.Tests.Features.Tasks;

public sealed class ChangeTaskStatusCommandTests
{
    private static readonly Guid TenantId = Guid.Parse("b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e");
    private static readonly Guid OwnerDepartmentId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid AssignedDepartmentId = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid AssigneeId = Guid.Parse("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee");

    [Fact]
    public async Task Handle_CompletedToCancelled_UpdatesParentJobToCancelled()
    {
        await using var dbContext = CreateDbContext();
        await SeedAsync(dbContext);

        var jobId = Guid.NewGuid();
        var taskId = Guid.NewGuid();
        var job = new Job
        {
            TenantId = TenantId,
            JobId = jobId,
            Title = "T-2026-309 scenario",
            Description = "Test",
            OwnerDepartmentId = OwnerDepartmentId,
            Status = JobStatus.Completed,
            CompletedAtUtc = DateTimeOffset.UtcNow,
            CompletionPercentage = 100,
        };
        var task = new WorkTask
        {
            TenantId = TenantId,
            TaskId = taskId,
            JobId = jobId,
            Title = "Task",
            Description = "Task",
            AssignedDepartmentId = AssignedDepartmentId,
            AssignedUserId = AssigneeId,
            CurrentStatus = WorkflowTaskStatus.Completed,
            CompletionPercentage = 100,
            CompletedAtUtc = DateTimeOffset.UtcNow,
        };

        dbContext.Jobs.Add(job);
        dbContext.Tasks.Add(task);
        await dbContext.SaveChangesAsync();

        var handler = new ChangeTaskStatusCommandHandler(
            dbContext,
            new TestTenantContextAccessor(new TenantContext(TenantId, AssigneeId, "Assignee", "Staff", true, "claims", null, true)));

        var result = await handler.Handle(
            new ChangeTaskStatusCommand(taskId, AssigneeId, nameof(WorkflowTaskStatus.Cancelled), "iptal nedeni"),
            CancellationToken.None);

        Assert.True(result);
        Assert.Equal(WorkflowTaskStatus.Cancelled, task.CurrentStatus);
        Assert.Equal(JobStatus.Cancelled, job.Status);
        Assert.Null(job.CompletedAtUtc);
        Assert.Equal(0, job.CompletionPercentage);
    }

    private static CityCommunicationCenterDbContext CreateDbContext() => new(
        new DbContextOptionsBuilder<CityCommunicationCenterDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private static async Task SeedAsync(CityCommunicationCenterDbContext dbContext)
    {
        dbContext.Tenants.Add(new Tenant
        {
            TenantId = TenantId,
            MunicipalityName = "Test Belediyesi",
            DisplayName = "Test Belediyesi",
        });

        dbContext.Departments.AddRange(
            new Department
            {
                TenantId = TenantId,
                DepartmentId = OwnerDepartmentId,
                Name = "Owner Department",
                DepartmentType = "Unit",
            },
            new Department
            {
                TenantId = TenantId,
                DepartmentId = AssignedDepartmentId,
                Name = "Assigned Department",
                DepartmentType = "Unit",
            });

        dbContext.Users.Add(new ApplicationUser
        {
            TenantId = TenantId,
            UserId = AssigneeId,
            DepartmentId = AssignedDepartmentId,
            DisplayName = "Assignee",
            RoleCode = RoleCode.Staff,
            IsActive = true,
            UserSource = UserSource.Manual,
        });

        await dbContext.SaveChangesAsync();
    }

    private sealed class TestTenantContextAccessor(TenantContext context) : ITenantContextAccessor
    {
        public TenantContext GetCurrent() => context;
    }
}

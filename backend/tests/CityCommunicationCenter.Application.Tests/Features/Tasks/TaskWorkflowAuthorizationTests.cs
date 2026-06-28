using CityCommunicationCenter.Application.Common.Exceptions;
using CityCommunicationCenter.Application.Features.Tasks;
using CityCommunicationCenter.Domain.Entities;
using CityCommunicationCenter.Domain.Enums;
using CityCommunicationCenter.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using WorkflowTaskStatus = CityCommunicationCenter.Domain.Enums.TaskStatus;

namespace CityCommunicationCenter.Application.Tests.Features.Tasks;

public sealed class TaskWorkflowAuthorizationTests
{
    private static readonly Guid TenantId = Guid.Parse("b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e");
    private static readonly Guid OwnerDepartmentId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid AssignedDepartmentId = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid OtherDepartmentId = Guid.Parse("33333333-3333-3333-3333-333333333333");
    private static readonly Guid SystemAdminId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static readonly Guid OwnerManagerId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private static readonly Guid AssignedManagerId = Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc");
    private static readonly Guid StaffId = Guid.Parse("dddddddd-dddd-dddd-dddd-dddddddddddd");
    private static readonly Guid AssigneeId = Guid.Parse("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee");

    [Fact]
    public async Task EnsureCanAssignAsync_AllowsSystemAdmin()
    {
        await using var dbContext = CreateDbContext();
        await SeedAsync(dbContext);
        var task = CreateTask();
        var job = CreateJob();

        await TaskWorkflowAuthorization.EnsureCanAssignAsync(
            dbContext,
            task,
            job,
            SystemAdminId,
            TenantId,
            CancellationToken.None);
    }

    [Fact]
    public async Task EnsureCanAssignAsync_AllowsAssignedDepartmentManager()
    {
        await using var dbContext = CreateDbContext();
        await SeedAsync(dbContext);
        var task = CreateTask();
        var job = CreateJob();

        await TaskWorkflowAuthorization.EnsureCanAssignAsync(
            dbContext,
            task,
            job,
            AssignedManagerId,
            TenantId,
            CancellationToken.None);
    }

    [Fact]
    public async Task EnsureCanAssignAsync_AllowsOwnerDepartmentManager()
    {
        await using var dbContext = CreateDbContext();
        await SeedAsync(dbContext);
        var task = CreateTask();
        var job = CreateJob();

        await TaskWorkflowAuthorization.EnsureCanAssignAsync(
            dbContext,
            task,
            job,
            OwnerManagerId,
            TenantId,
            CancellationToken.None);
    }

    [Fact]
    public async Task EnsureCanAssignAsync_RejectsStaffOutsideManagementScope()
    {
        await using var dbContext = CreateDbContext();
        await SeedAsync(dbContext);
        var task = CreateTask();
        var job = CreateJob();

        await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
            TaskWorkflowAuthorization.EnsureCanAssignAsync(
                dbContext,
                task,
                job,
                StaffId,
                TenantId,
                CancellationToken.None));
    }

    [Fact]
    public async Task EnsureCanActAsAssigneeAsync_AllowsAssignedUser()
    {
        await using var dbContext = CreateDbContext();
        await SeedAsync(dbContext);
        var task = CreateTask(assignedUserId: AssigneeId);

        await TaskWorkflowAuthorization.EnsureCanActAsAssigneeAsync(
            dbContext,
            task,
            AssigneeId,
            TenantId,
            CancellationToken.None);
    }

    [Fact]
    public async Task EnsureCanActAsAssigneeAsync_RejectsDifferentStaffUser()
    {
        await using var dbContext = CreateDbContext();
        await SeedAsync(dbContext);
        var task = CreateTask(assignedUserId: AssigneeId);

        await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
            TaskWorkflowAuthorization.EnsureCanActAsAssigneeAsync(
                dbContext,
                task,
                StaffId,
                TenantId,
                CancellationToken.None));
    }

    [Theory]
    [InlineData(true, null, nameof(WorkflowTaskStatus.Waiting), true)]
    [InlineData(false, null, nameof(WorkflowTaskStatus.Waiting), false)]
    [InlineData(true, "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee", nameof(WorkflowTaskStatus.Waiting), false)]
    [InlineData(true, null, nameof(WorkflowTaskStatus.InProgress), false)]
    public void IsClaimableFromDepartmentPool_ReturnsExpectedDecision(
        bool hasAssignedDepartment,
        string? assignedUserId,
        string statusName,
        bool expected)
    {
        var task = new WorkTask
        {
            AssignedDepartmentId = hasAssignedDepartment ? AssignedDepartmentId : null,
            AssignedUserId = assignedUserId is null ? null : Guid.Parse(assignedUserId),
            CurrentStatus = Enum.Parse<WorkflowTaskStatus>(statusName),
        };

        Assert.Equal(expected, TaskWorkflowAuthorization.IsClaimableFromDepartmentPool(task));
    }

    [Fact]
    public async Task RecomputeJobCompletionAsync_DemotesCompletedJobWhenAllTasksCancelled()
    {
        await using var dbContext = CreateDbContext();
        await SeedAsync(dbContext);

        var job = CreateJob();
        job.Status = JobStatus.Completed;
        job.CompletedAtUtc = DateTimeOffset.UtcNow;
        job.CompletionPercentage = 100;

        var task = CreateTask(assignedUserId: AssigneeId);
        task.JobId = job.JobId;
        task.CurrentStatus = WorkflowTaskStatus.Cancelled;

        dbContext.Jobs.Add(job);
        dbContext.Tasks.Add(task);
        await dbContext.SaveChangesAsync();

        var result = await TaskWorkflowAuthorization.RecomputeJobCompletionAsync(
            dbContext,
            job.JobId,
            CancellationToken.None);

        Assert.Equal(JobStatus.Cancelled, result);
        Assert.Equal(JobStatus.Cancelled, job.Status);
        Assert.Null(job.CompletedAtUtc);
        Assert.Equal(0, job.CompletionPercentage);
    }

    private static CityCommunicationCenterDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<CityCommunicationCenterDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new CityCommunicationCenterDbContext(options);
    }

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
                ManagerUserId = OwnerManagerId,
            },
            new Department
            {
                TenantId = TenantId,
                DepartmentId = AssignedDepartmentId,
                Name = "Assigned Department",
                DepartmentType = "Unit",
                ManagerUserId = AssignedManagerId,
            },
            new Department
            {
                TenantId = TenantId,
                DepartmentId = OtherDepartmentId,
                Name = "Other Department",
                DepartmentType = "Unit",
            });

        dbContext.Users.AddRange(
            CreateUser(SystemAdminId, OtherDepartmentId, RoleCode.SystemAdmin),
            CreateUser(OwnerManagerId, OwnerDepartmentId, RoleCode.Manager),
            CreateUser(AssignedManagerId, AssignedDepartmentId, RoleCode.Manager),
            CreateUser(StaffId, OtherDepartmentId, RoleCode.Staff),
            CreateUser(AssigneeId, AssignedDepartmentId, RoleCode.Staff));

        await dbContext.SaveChangesAsync();
    }

    private static ApplicationUser CreateUser(Guid userId, Guid departmentId, RoleCode role) =>
        new()
        {
            TenantId = TenantId,
            UserId = userId,
            DepartmentId = departmentId,
            DisplayName = role + " User",
            RoleCode = role,
            IsActive = true,
            UserSource = UserSource.Manual,
        };

    private static Job CreateJob() =>
        new()
        {
            TenantId = TenantId,
            JobId = Guid.NewGuid(),
            Title = "Test Job",
            Description = "Test job description",
            OwnerDepartmentId = OwnerDepartmentId,
            Status = JobStatus.Active,
        };

    private static WorkTask CreateTask(Guid? assignedUserId = null) =>
        new()
        {
            TenantId = TenantId,
            TaskId = Guid.NewGuid(),
            JobId = Guid.NewGuid(),
            Title = "Test Task",
            Description = "Test task description",
            AssignedDepartmentId = AssignedDepartmentId,
            AssignedUserId = assignedUserId,
            CurrentStatus = WorkflowTaskStatus.Waiting,
        };
}

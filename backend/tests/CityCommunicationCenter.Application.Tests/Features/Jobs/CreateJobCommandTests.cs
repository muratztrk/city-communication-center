using CityCommunicationCenter.Application;
using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Application.Features.Jobs;
using CityCommunicationCenter.Domain.Entities;
using CityCommunicationCenter.Domain.Enums;
using CityCommunicationCenter.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CityCommunicationCenter.Application.Tests.Features.Jobs;

public sealed class CreateJobCommandTests
{
    private static readonly Guid TenantId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid DepartmentId = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid StaffId = Guid.Parse("33333333-3333-3333-3333-333333333333");

    [Fact]
    public async Task Handle_StaffRequestWithoutDueDate_AssignsDefaultSlaDueDateWhilePendingApproval()
    {
        await using var dbContext = CreateDbContext();
        await SeedAsync(dbContext);
        var expectedDueDate = DateTimeOffset.UtcNow.AddHours(48);
        var slaCalculator = new FixedSlaCalculator(expectedDueDate);
        var handler = new CreateJobCommandHandler(
            dbContext,
            new TestTenantContextAccessor(new TenantContext(TenantId, StaffId, "Personel", "Staff", true, "test", null)),
            slaCalculator,
            new NullAfterHoursJobSmsNotifier(),
            new NullJobMailNotifier());

        var result = await handler.Handle(new CreateJobCommand(
            StaffId,
            "SLA tarihli talep",
            "Test açıklaması",
            DepartmentId,
            [StaffId],
            "Normal",
            nameof(JobRequestType.InternalUnit),
            false,
            null,
            null,
            null,
            null,
            null,
            nameof(JobSourceType.Manual),
            null), CancellationToken.None);

        var job = await dbContext.Jobs.SingleAsync();
        Assert.Equal(JobStatus.PendingOwnerApproval, job.Status);
        Assert.Equal(expectedDueDate, job.DueDateUtc);
        Assert.Equal(expectedDueDate, result.DueDateUtc);
        Assert.Equal(48, slaCalculator.SlaHours);
        Assert.Equal(DepartmentId, slaCalculator.DepartmentId);
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
        dbContext.Departments.Add(new Department
        {
            TenantId = TenantId,
            DepartmentId = DepartmentId,
            Name = "Test Birimi",
            DepartmentType = "Unit",
        });
        dbContext.Users.Add(new ApplicationUser
        {
            TenantId = TenantId,
            UserId = StaffId,
            DepartmentId = DepartmentId,
            DisplayName = "Personel",
            RoleCode = RoleCode.Staff,
            IsActive = true,
            UserSource = UserSource.Manual,
        });
        dbContext.TenantSettings.Add(new TenantSetting
        {
            TenantSettingId = Guid.NewGuid(),
            TenantId = TenantId,
            DisplayName = "Test",
            DefaultSlaHours = 48,
        });
        await dbContext.SaveChangesAsync();
    }

    private sealed class TestTenantContextAccessor(TenantContext context) : ITenantContextAccessor
    {
        public TenantContext GetCurrent() => context;
    }

    private sealed class FixedSlaCalculator(DateTimeOffset result) : ISlaCalculatorService
    {
        public int? SlaHours { get; private set; }
        public Guid? DepartmentId { get; private set; }

        public Task<DateTimeOffset> CalculateDueDateAsync(
            DateTimeOffset startUtc,
            int slaHours,
            Guid tenantId,
            Guid? departmentId = null,
            CancellationToken cancellationToken = default)
        {
            SlaHours = slaHours;
            DepartmentId = departmentId;
            return Task.FromResult(result);
        }
    }

    private sealed class NullAfterHoursJobSmsNotifier : IAfterHoursJobSmsNotifier
    {
        public Task NotifyJobCreatedAsync(Job job, IReadOnlyCollection<Guid> departmentIds, Guid? actorUserId = null, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task NotifyTaskAssignedAsync(Job job, Guid assigneeUserId, Guid? assignedDepartmentId, Guid? actorUserId = null, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task NotifyFirstAssignmentAsync(Job job, Guid assigneeUserId, Guid? assignedDepartmentId, Guid? actorUserId = null, CancellationToken cancellationToken = default) => Task.CompletedTask;
    }

    private sealed class NullJobMailNotifier : IJobMailNotifier
    {
        public Task NotifyIncomingAsync(Job job, IReadOnlyCollection<Guid> departmentIds, Guid? actorUserId = null, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task NotifyTaskAssignedAsync(Job job, Guid assigneeUserId, Guid? assignedDepartmentId, Guid? actorUserId = null, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task ProcessOverdueMailsAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;
    }
}

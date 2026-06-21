using CityCommunicationCenter.Application;
using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Application.Common.Exceptions;
using CityCommunicationCenter.Application.Features.Reports;
using CityCommunicationCenter.Domain.Entities;
using CityCommunicationCenter.Domain.Enums;
using CityCommunicationCenter.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CityCommunicationCenter.Application.Tests.Features.Reports;

public sealed class ExecutiveReportQueryTests
{
    private static readonly Guid TenantId = Guid.Parse("b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e");
    private static readonly Guid OtherTenantId = Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc");
    private static readonly Guid ManagedDepartmentId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid OtherDepartmentId = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid ManagerId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");

    [Fact]
    public async Task Handle_ManagerOnlyReceivesManagedDepartmentAndTenantData()
    {
        await using var db = CreateDbContext();
        await SeedAsync(db);

        var handler = new GetExecutiveReportQueryHandler(
            db,
            new TestTenantContextAccessor(new TenantContext(TenantId, ManagerId, "Manager", "Manager", true, "claims", null, true)));

        var response = await handler.Handle(
            new GetExecutiveReportQuery("monthly", DateTimeOffset.UtcNow.AddDays(-10), DateTimeOffset.UtcNow),
            CancellationToken.None);

        Assert.Equal(1, response.Kpi.TotalRequests);
        Assert.Equal(1, response.Kpi.OpenSocialMessages);
        Assert.Single(response.ByDepartment);
        Assert.Equal(ManagedDepartmentId, response.ByDepartment[0].DepartmentId);
    }

    [Fact]
    public async Task Handle_SystemAdminUsesRequestedDateRangeAcrossTenantDepartments()
    {
        await using var db = CreateDbContext();
        await SeedAsync(db);

        var handler = new GetExecutiveReportQueryHandler(
            db,
            new TestTenantContextAccessor(new TenantContext(TenantId, Guid.NewGuid(), "Admin", "SystemAdmin", true, "claims", null, true)));

        var response = await handler.Handle(
            new GetExecutiveReportQuery("weekly", DateTimeOffset.UtcNow.AddDays(-10), DateTimeOffset.UtcNow),
            CancellationToken.None);

        Assert.Equal(2, response.Kpi.TotalRequests);
        Assert.Equal(1, response.Kpi.CompletedRequests);
        Assert.Equal(2, response.ByDepartment.Count);
    }

    [Fact]
    public async Task Handle_RejectsNonExecutiveRole()
    {
        await using var db = CreateDbContext();
        var handler = new GetExecutiveReportQueryHandler(
            db,
            new TestTenantContextAccessor(new TenantContext(TenantId, Guid.NewGuid(), "Staff", "Staff", true, "claims", null, true)));

        await Assert.ThrowsAsync<ForbiddenAccessException>(() => handler.Handle(
            new GetExecutiveReportQuery("monthly", null, null), CancellationToken.None).AsTask());
    }

    [Theory]
    [InlineData("weekly")]
    [InlineData("monthly")]
    [InlineData("yearly")]
    public void Validator_AcceptsSupportedPeriods(string period)
    {
        var result = new GetExecutiveReportQueryValidator().Validate(new GetExecutiveReportQuery(period, null, null));
        Assert.True(result.IsValid);
    }

    private static CityCommunicationCenterDbContext CreateDbContext() => new(
        new DbContextOptionsBuilder<CityCommunicationCenterDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private static async Task SeedAsync(CityCommunicationCenterDbContext db)
    {
        var now = DateTimeOffset.UtcNow;
        db.Tenants.AddRange(
            new Tenant { TenantId = TenantId, MunicipalityName = "Test", DisplayName = "Test" },
            new Tenant { TenantId = OtherTenantId, MunicipalityName = "Other", DisplayName = "Other" });
        db.Departments.AddRange(
            new Department { TenantId = TenantId, DepartmentId = ManagedDepartmentId, Name = "Managed", DepartmentType = "Unit", ManagerUserId = ManagerId },
            new Department { TenantId = TenantId, DepartmentId = OtherDepartmentId, Name = "Other", DepartmentType = "Unit" });
        db.Users.Add(new ApplicationUser { TenantId = TenantId, UserId = ManagerId, DepartmentId = ManagedDepartmentId, DisplayName = "Manager", RoleCode = RoleCode.Manager, IsActive = true });
        db.Jobs.AddRange(
            Job(TenantId, ManagedDepartmentId, now.AddDays(-2), JobStatus.Completed, now.AddDays(-1)),
            Job(TenantId, OtherDepartmentId, now.AddDays(-2), JobStatus.Active, null),
            Job(OtherTenantId, OtherDepartmentId, now.AddDays(-2), JobStatus.Completed, now.AddDays(-1)),
            Job(TenantId, ManagedDepartmentId, now.AddMonths(-2), JobStatus.Active, null));
        db.SocialMessages.AddRange(
            new SocialMessage { TenantId = TenantId, SocialMessageId = Guid.NewGuid(), AssignedDepartmentId = ManagedDepartmentId, Status = SocialMessageStatus.New },
            new SocialMessage { TenantId = TenantId, SocialMessageId = Guid.NewGuid(), AssignedDepartmentId = OtherDepartmentId, Status = SocialMessageStatus.New },
            new SocialMessage { TenantId = OtherTenantId, SocialMessageId = Guid.NewGuid(), AssignedDepartmentId = OtherDepartmentId, Status = SocialMessageStatus.New });
        await db.SaveChangesAsync();
    }

    private static Job Job(Guid tenantId, Guid departmentId, DateTimeOffset createdAt, JobStatus status, DateTimeOffset? completedAt) => new()
    {
        TenantId = tenantId, JobId = Guid.NewGuid(), OwnerDepartmentId = departmentId,
        Title = "Request", Description = "Request", Status = status, CreatedAtUtc = createdAt,
        CompletedAtUtc = completedAt, DueDateUtc = createdAt.AddDays(2)
    };

    private sealed class TestTenantContextAccessor(TenantContext context) : ITenantContextAccessor
    {
        public TenantContext GetCurrent() => context;
    }
}

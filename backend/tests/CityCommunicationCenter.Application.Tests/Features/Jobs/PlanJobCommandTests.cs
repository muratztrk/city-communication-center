using CityCommunicationCenter.Application;
using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Application.Common.Exceptions;
using CityCommunicationCenter.Application.Features.Departments;
using CityCommunicationCenter.Application.Features.Jobs;
using CityCommunicationCenter.Domain.Entities;
using CityCommunicationCenter.Domain.Enums;
using CityCommunicationCenter.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CityCommunicationCenter.Application.Tests.Features.Jobs;

public sealed class PlanJobCommandTests
{
    private static readonly Guid TenantId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid OwnerDepartmentId = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid TargetDepartmentId = Guid.Parse("33333333-3333-3333-3333-333333333333");
    private static readonly Guid OtherDepartmentId = Guid.Parse("44444444-4444-4444-4444-444444444444");
    private static readonly Guid CitizenManagerId = Guid.Parse("55555555-5555-5555-5555-555555555555");
    private static readonly Guid ResponsibleId = Guid.Parse("66666666-6666-6666-6666-666666666666");
    private static readonly Guid StaffId = Guid.Parse("77777777-7777-7777-7777-777777777777");

    [Fact]
    public async Task Handle_CitizenRequestManagerInTargetDepartment_PlansIncomingCitizenRequest()
    {
        await using var dbContext = CreateDbContext();
        var job = await SeedCitizenRequestAsync(dbContext, new ApplicationUser
        {
            TenantId = TenantId,
            UserId = CitizenManagerId,
            DepartmentId = TargetDepartmentId,
            DisplayName = "Vatandaş Yöneticisi",
            RoleCode = RoleCode.CitizenRequestManager,
            IsActive = true,
            UserSource = UserSource.Manual,
        });

        var planned = await CreateHandler(dbContext).Handle(new PlanJobCommand(job.JobId, CitizenManagerId), CancellationToken.None);

        Assert.True(planned);
        Assert.NotNull(job.PlannedAtUtc);
        Assert.Equal("Vatandaş Yöneticisi", job.PlannedByDisplayName);
    }

    [Fact]
    public async Task Handle_DepartmentResponsible_PlansIncomingCitizenRequest()
    {
        await using var dbContext = CreateDbContext();
        var job = await SeedCitizenRequestAsync(dbContext, new ApplicationUser
        {
            TenantId = TenantId,
            UserId = ResponsibleId,
            DepartmentId = OtherDepartmentId,
            DisplayName = "Birim Sorumlusu",
            RoleCode = RoleCode.Manager,
            IsActive = true,
            UserSource = UserSource.Manual,
        });
        var target = await dbContext.Departments.SingleAsync(entity => entity.DepartmentId == TargetDepartmentId);
        target.ResponsibleUserIdsJson = DepartmentResponseFactory.SerializeResponsibleUserIds([ResponsibleId]);
        await dbContext.SaveChangesAsync();

        var planned = await CreateHandler(dbContext).Handle(new PlanJobCommand(job.JobId, ResponsibleId), CancellationToken.None);

        Assert.True(planned);
        Assert.Equal("Birim Sorumlusu", job.PlannedByDisplayName);
    }

    [Fact]
    public async Task Handle_Staff_IsRejected()
    {
        await using var dbContext = CreateDbContext();
        var job = await SeedCitizenRequestAsync(dbContext, new ApplicationUser
        {
            TenantId = TenantId,
            UserId = StaffId,
            DepartmentId = TargetDepartmentId,
            DisplayName = "Personel",
            RoleCode = RoleCode.Staff,
            IsActive = true,
            UserSource = UserSource.Manual,
        });

        var act = async () =>
        {
            await CreateHandler(dbContext).Handle(new PlanJobCommand(job.JobId, StaffId), CancellationToken.None);
        };

        var error = await Assert.ThrowsAsync<ForbiddenAccessException>(act);
        Assert.Equal("Bu talebi plana alma yetkiniz yok.", error.Message);
        Assert.Null(job.PlannedAtUtc);
    }

    private static PlanJobCommandHandler CreateHandler(CityCommunicationCenterDbContext dbContext) =>
        new(
            dbContext,
            new TestTenantContextAccessor(new TenantContext(TenantId, null, null, null, true, "test", null, false)));

    private static async Task<Job> SeedCitizenRequestAsync(CityCommunicationCenterDbContext dbContext, ApplicationUser actor)
    {
        var job = new Job
        {
            JobId = Guid.NewGuid(),
            TenantId = TenantId,
            Title = "Vatandaş talebi",
            Description = "Test",
            OwnerDepartmentId = OwnerDepartmentId,
            RequestType = JobRequestType.ExternalUnit,
            SourceType = JobSourceType.SocialMessage,
            Status = JobStatus.Active,
            CreatedByUserId = StaffId,
        };
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
                Name = "Çağrı Merkezi",
                DepartmentType = "Unit",
            },
            new Department
            {
                TenantId = TenantId,
                DepartmentId = TargetDepartmentId,
                Name = "Bilgi İşlem",
                DepartmentType = "Unit",
            },
            new Department
            {
                TenantId = TenantId,
                DepartmentId = OtherDepartmentId,
                Name = "Başka Birim",
                DepartmentType = "Unit",
            });
        dbContext.Users.Add(actor);
        dbContext.JobDepartments.Add(new JobDepartment
        {
            JobDepartmentId = Guid.NewGuid(),
            TenantId = TenantId,
            JobId = job.JobId,
            DepartmentId = TargetDepartmentId,
            Role = JobDepartmentRole.Target,
            ApprovalStatus = JobApprovalStatus.Pending,
        });
        dbContext.Jobs.Add(job);
        await dbContext.SaveChangesAsync();
        return job;
    }

    private static CityCommunicationCenterDbContext CreateDbContext() => new(
        new DbContextOptionsBuilder<CityCommunicationCenterDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private sealed class TestTenantContextAccessor(TenantContext context) : ITenantContextAccessor
    {
        public TenantContext GetCurrent() => context;
    }
}

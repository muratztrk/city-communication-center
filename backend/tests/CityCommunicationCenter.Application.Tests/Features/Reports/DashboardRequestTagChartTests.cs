using CityCommunicationCenter.Application;
using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Application.Features.Reports;
using CityCommunicationCenter.Domain.Entities;
using CityCommunicationCenter.Domain.Enums;
using CityCommunicationCenter.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CityCommunicationCenter.Application.Tests.Features.Reports;

public sealed class DashboardRequestTagChartTests
{
    private static readonly Guid TenantId = Guid.Parse("b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e");
    private static readonly Guid UserId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static readonly Guid DepartmentId = Guid.Parse("11111111-1111-1111-1111-111111111111");

    [Fact]
    public async Task Handle_All_GroupsTagsPerRequestAndUsesConversationLabelAsFallback()
    {
        await using var db = CreateDbContext();
        await SeedAsync(db);

        var chart = await GetRequestTagChartAsync(db, RequestTagDashboardFilter.All);
        var slices = chart.Slices.ToDictionary(slice => slice.Label, slice => slice.Value);

        Assert.Equal(4, slices.Count);
        Assert.Equal(0, slices["Ağaç"]);
        Assert.Equal(2, slices["Yol"]);
        Assert.Equal(1, slices["Park"]);
        Assert.Equal(1, slices["Atık"]);
    }

    [Fact]
    public async Task Handle_InProgress_OnlyCountsActiveRequests()
    {
        await using var db = CreateDbContext();
        await SeedAsync(db);

        var chart = await GetRequestTagChartAsync(db, RequestTagDashboardFilter.InProgress);
        var slices = chart.Slices.ToDictionary(slice => slice.Label, slice => slice.Value);

        Assert.Equal(4, slices.Count);
        Assert.Equal(0, slices["Ağaç"]);
        Assert.Equal(0, slices["Park"]);
        Assert.Equal(1, slices["Yol"]);
        Assert.Equal(1, slices["Atık"]);
    }

    [Fact]
    public async Task Handle_Completed_OnlyCountsCompletedRequests()
    {
        await using var db = CreateDbContext();
        await SeedAsync(db);

        var chart = await GetRequestTagChartAsync(db, RequestTagDashboardFilter.Completed);
        var slices = chart.Slices.ToDictionary(slice => slice.Label, slice => slice.Value);

        Assert.Equal(4, slices.Count);
        Assert.Equal(1, slices["Yol"]);
        Assert.Equal(0, slices["Ağaç"]);
        Assert.Equal(0, slices["Atık"]);
        Assert.Equal(0, slices["Park"]);
    }

    private static async Task<CityCommunicationCenter.Shared.Contracts.DashboardChartResponse> GetRequestTagChartAsync(
        CityCommunicationCenterDbContext db,
        RequestTagDashboardFilter filter)
    {
        var handler = new GetDashboardStatusChartsQueryHandler(
            db,
            new TestTenantContextAccessor(new TenantContext(
                TenantId, UserId, "Reporter", "Reporter", true, "claims", null, true)));
        var response = await handler.Handle(
            new GetDashboardStatusChartsQuery(null, null, RequestTagStatus: filter),
            CancellationToken.None);

        return Assert.Single(response.Charts, chart => chart.TitleKey == "dashboard.charts.requestTags");
    }

    private static CityCommunicationCenterDbContext CreateDbContext() => new(
        new DbContextOptionsBuilder<CityCommunicationCenterDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private static async Task SeedAsync(CityCommunicationCenterDbContext db)
    {
        var tenant = new Tenant { TenantId = TenantId, MunicipalityName = "Test", DisplayName = "Test" };
        var department = new Department
        {
            TenantId = TenantId,
            DepartmentId = DepartmentId,
            Name = "Test Birimi",
            DepartmentType = "Unit",
        };
        var user = new ApplicationUser
        {
            TenantId = TenantId,
            UserId = UserId,
            DepartmentId = DepartmentId,
            DisplayName = "Reporter",
            RoleCode = RoleCode.Reporter,
            IsActive = true,
        };
        var conversation = new CitizenConversation
        {
            TenantId = TenantId,
            CitizenConversationId = Guid.NewGuid(),
            CitizenPhone = "905301234567",
            Label = "Atık",
            LastMessageAt = DateTimeOffset.UtcNow,
        };
        var activeRoad = Job(JobStatus.Active);
        var completedRoad = Job(JobStatus.Completed);
        var cancelledPark = Job(JobStatus.Cancelled);
        var activeFallback = Job(JobStatus.Active);

        db.AddRange(tenant, department, user, conversation, activeRoad, completedRoad, cancelledPark, activeFallback);
        db.RequestTags.AddRange(
            Tag("Ağaç"),
            Tag("Atık"),
            Tag("Park"),
            Tag("Yol"));
        db.SocialMessages.AddRange(
            Message(activeRoad.JobId, "Yol"),
            Message(activeRoad.JobId, "yol"),
            Message(completedRoad.JobId, "Yol"),
            Message(cancelledPark.JobId, "Park"),
            Message(activeFallback.JobId, null, conversation.CitizenConversationId));
        await db.SaveChangesAsync();
    }

    private static Job Job(JobStatus status) => new()
    {
        TenantId = TenantId,
        JobId = Guid.NewGuid(),
        OwnerDepartmentId = DepartmentId,
        Title = "Talep",
        Description = "Talep",
        Status = status,
        RequestType = JobRequestType.ExternalUnit,
        CreatedAtUtc = DateTimeOffset.UtcNow,
    };

    private static SocialMessage Message(Guid jobId, string? category, Guid? conversationId = null) => new()
    {
        TenantId = TenantId,
        SocialMessageId = Guid.NewGuid(),
        ExternalMessageId = Guid.NewGuid().ToString("N"),
        CitizenHandle = "Vatandaş",
        Content = "Talep",
        Category = category,
        CitizenConversationId = conversationId,
        JobId = jobId,
        // Talep Etiketi pie yalnız VT numaralı mesajları sayar (card #1845).
        CitizenRequestNumber = Random.Shared.Next(1, 9_999),
        CitizenRequestNumberYear = 2026,
        Channel = SocialChannel.WhatsApp,
    };

    private static RequestTag Tag(string name) => new()
    {
        TenantId = TenantId,
        TagId = Guid.NewGuid(),
        Name = name,
    };

    private sealed class TestTenantContextAccessor(TenantContext context) : ITenantContextAccessor
    {
        public TenantContext GetCurrent() => context;
    }
}

using CityCommunicationCenter.Application.Abstractions.Identity;
using CityCommunicationCenter.Application.Features.Auth;
using CityCommunicationCenter.Domain.Entities;
using CityCommunicationCenter.Domain.Enums;
using CityCommunicationCenter.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CityCommunicationCenter.Application.Tests.Features.Auth;

public sealed class MobileSessionCommandTests
{
    private static readonly Guid TenantId = Guid.Parse("b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e");
    private static readonly Guid UserId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static readonly Guid DepartmentId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid MobileSessionId = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid WebSessionId = Guid.Parse("33333333-3333-3333-3333-333333333333");

    [Fact]
    public async Task Refresh_ReadsCurrentUserAndLeavesBothSessionsUntouched()
    {
        await using var db = await CreateDbAsync();
        var user = await db.Users.SingleAsync();
        user.DisplayName = "Yeni Ad";
        user.RoleCode = RoleCode.Manager;
        await db.SaveChangesAsync();

        var payload = await RefreshAsync(db, MobileSessionId);

        Assert.NotNull(payload);
        Assert.Equal("Yeni Ad", payload.DisplayName);
        Assert.Equal(nameof(RoleCode.Manager), payload.RoleCode);
        Assert.Equal("Test Belediyesi", payload.TenantName);
        Assert.Equal(MobileSessionId, payload.MobileSessionId);
        Assert.Equal(WebSessionId, payload.ActiveSessionId);

        var stored = await db.Users.AsNoTracking().SingleAsync();
        Assert.Equal(MobileSessionId, stored.MobileSessionId);
        Assert.Equal(WebSessionId, stored.ActiveSessionId);
    }

    [Fact]
    public async Task Refresh_RejectsAnotherSession()
    {
        await using var db = await CreateDbAsync();
        Assert.Null(await RefreshAsync(db, Guid.NewGuid()));
    }

    [Fact]
    public async Task Refresh_RejectsARevokedSession()
    {
        await using var db = await CreateDbAsync();
        await new RevokeMobileSessionCommandHandler(db)
            .Handle(new RevokeMobileSessionCommand(UserId, TenantId), default);

        Assert.Null((await db.Users.AsNoTracking().SingleAsync()).MobileSessionId);
        Assert.Null(await RefreshAsync(db, MobileSessionId));
    }

    [Fact]
    public async Task Refresh_RejectsADeactivatedUser()
    {
        await using var db = await CreateDbAsync();
        (await db.Users.SingleAsync()).IsActive = false;
        await db.SaveChangesAsync();

        Assert.Null(await RefreshAsync(db, MobileSessionId));
    }

    [Fact]
    public async Task Refresh_RejectsADeactivatedTenant()
    {
        await using var db = await CreateDbAsync();
        (await db.Tenants.SingleAsync()).IsActive = false;
        await db.SaveChangesAsync();

        Assert.Null(await RefreshAsync(db, MobileSessionId));
    }

    [Fact]
    public async Task Refresh_RejectsAnotherTenant()
    {
        await using var db = await CreateDbAsync();
        var payload = await new RefreshMobileSessionCommandHandler(db)
            .Handle(new RefreshMobileSessionCommand(UserId, Guid.NewGuid(), MobileSessionId), default);

        Assert.Null(payload);
    }

    [Fact]
    public async Task MobileLogin_StartsANewMobileSession()
    {
        await using var db = await CreateDbAsync();

        var payload = await LoginAsync(db, startMobileSession: true);

        Assert.NotNull(payload?.MobileSessionId);
        Assert.NotEqual(MobileSessionId, payload.MobileSessionId);
        Assert.Equal(payload.MobileSessionId, (await db.Users.AsNoTracking().SingleAsync()).MobileSessionId);
    }

    [Fact]
    public async Task WebLogin_KeepsTheMobileSession()
    {
        await using var db = await CreateDbAsync();

        var payload = await LoginAsync(db, startMobileSession: false);

        Assert.Null(payload?.MobileSessionId);
        Assert.Equal(MobileSessionId, (await db.Users.AsNoTracking().SingleAsync()).MobileSessionId);
        Assert.NotNull(await RefreshAsync(db, MobileSessionId));
    }

    private static ValueTask<AuthenticatedTokenPayload?> RefreshAsync(CityCommunicationCenterDbContext db, Guid sessionId) =>
        new RefreshMobileSessionCommandHandler(db)
            .Handle(new RefreshMobileSessionCommand(UserId, TenantId, sessionId), default);

    private static ValueTask<AuthenticatedTokenPayload?> LoginAsync(CityCommunicationCenterDbContext db, bool startMobileSession) =>
        new AuthenticateUserCommandHandler(new FakeAuthentication(), db).Handle(
            new AuthenticateUserCommand("kullanici", "parola", TenantId.ToString(), startMobileSession),
            default);

    private static async Task<CityCommunicationCenterDbContext> CreateDbAsync()
    {
        var options = new DbContextOptionsBuilder<CityCommunicationCenterDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new CityCommunicationCenterDbContext(options);
        db.Tenants.Add(new Tenant
        {
            TenantId = TenantId,
            MunicipalityName = "Test Belediyesi",
            DisplayName = "Test Belediyesi",
        });
        db.Departments.Add(new Department
        {
            TenantId = TenantId,
            DepartmentId = DepartmentId,
            Name = "Birim",
            DepartmentType = "Unit",
        });
        db.Users.Add(new ApplicationUser
        {
            TenantId = TenantId,
            UserId = UserId,
            DepartmentId = DepartmentId,
            Username = "kullanici",
            DisplayName = "Kullanici",
            RoleCode = RoleCode.Staff,
            IsActive = true,
            UserSource = UserSource.Manual,
            MobileSessionId = MobileSessionId,
            ActiveSessionId = WebSessionId,
        });
        await db.SaveChangesAsync();
        return db;
    }

    private sealed class FakeAuthentication : IUserAuthenticationService
    {
        public Task<AuthenticatedUserDescriptor?> AuthenticateAsync(
            Guid tenantId,
            string username,
            string password,
            CancellationToken cancellationToken = default) =>
            Task.FromResult<AuthenticatedUserDescriptor?>(new AuthenticatedUserDescriptor(
                UserId,
                TenantId,
                DepartmentId,
                username,
                "Kullanici",
                string.Empty,
                nameof(RoleCode.Staff),
                [],
                "Test Belediyesi",
                "LocalUser"));

        public Task<AuthenticatedUserDescriptor?> AuthenticateTrustedIdentityAsync(
            Guid tenantId,
            string username,
            string authenticationMode,
            CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();
    }
}

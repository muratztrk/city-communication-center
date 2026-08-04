using CityCommunicationCenter.Application;
using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Application.Common.Tenancy;
using CityCommunicationCenter.Application.Features.Users;
using CityCommunicationCenter.Domain.Entities;
using CityCommunicationCenter.Domain.Enums;
using CityCommunicationCenter.Infrastructure.Persistence;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;

namespace CityCommunicationCenter.Application.Tests.Features.Users;

public sealed class UserRoleAccessTests
{
    private static readonly Guid TenantId = Guid.Parse("b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e");
    private static readonly Guid DepartmentId = Guid.Parse("11111111-1111-1111-1111-111111111111");

    [Theory]
    [InlineData(nameof(RoleCode.Staff))]
    [InlineData(nameof(RoleCode.CitizenRequestManager))]
    public void ApplyAdditionalRoleCodes_RejectsIncompatibleManagerRoles(string additionalRole)
    {
        var user = new ApplicationUser { RoleCode = RoleCode.Manager };

        var exception = Assert.Throws<ValidationException>(
            () => UserRoleAccess.ApplyAdditionalRoleCodes(user, [additionalRole]));

        Assert.Contains("Müdür rolüne", exception.Message, StringComparison.Ordinal);
        Assert.Null(user.AdditionalRoleCodesJson);
    }

    [Fact]
    public void ApplyAdditionalRoleCodes_AllowsCompatibleManagerRole()
    {
        var user = new ApplicationUser { RoleCode = RoleCode.Manager };

        UserRoleAccess.ApplyAdditionalRoleCodes(user, [nameof(RoleCode.Reporter)]);

        Assert.Equal([RoleCode.Reporter], UserRoleAccess.ParseAdditionalRoleCodes(user.AdditionalRoleCodesJson));
    }

    [Fact]
    public async Task UpdateUser_RejectsUsernameThatMatchesAnotherUsersEmail()
    {
        await using var dbContext = CreateDbContext();
        var user = await SeedUsersAsync(dbContext);
        var handler = new UpdateUserCommandHandler(
            dbContext,
            new TestTenantContextAccessor(new TenantContext(
                TenantId,
                user.UserId,
                user.DisplayName,
                nameof(RoleCode.SystemAdmin),
                true,
                "test",
                null,
                true)),
            new TestLocalizer());

        await Assert.ThrowsAsync<ValidationException>(async () =>
            await handler.Handle(
                new UpdateUserCommand(
                    user.UserId,
                    DepartmentId,
                    [],
                    nameof(RoleCode.Staff),
                    [],
                    true,
                    "other@example.com"),
                CancellationToken.None));
    }

    private static CityCommunicationCenterDbContext CreateDbContext() => new(
        new DbContextOptionsBuilder<CityCommunicationCenterDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private static async Task<ApplicationUser> SeedUsersAsync(CityCommunicationCenterDbContext dbContext)
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

        var user = new ApplicationUser
        {
            TenantId = TenantId,
            UserId = Guid.NewGuid(),
            DepartmentId = DepartmentId,
            Username = "editable.user",
            DisplayName = "Editable User",
            RoleCode = RoleCode.Staff,
            UserSource = UserSource.Manual,
        };
        dbContext.Users.AddRange(
            user,
            new ApplicationUser
            {
                TenantId = TenantId,
                UserId = Guid.NewGuid(),
                DepartmentId = DepartmentId,
                Username = "other.user",
                Email = "other@example.com",
                DisplayName = "Other User",
                RoleCode = RoleCode.Staff,
                UserSource = UserSource.Manual,
            });
        await dbContext.SaveChangesAsync();
        return user;
    }

    private sealed class TestTenantContextAccessor(TenantContext context) : ITenantContextAccessor
    {
        public TenantContext GetCurrent() => context;
    }

    private sealed class TestLocalizer : IStringLocalizer<ApplicationResource>
    {
        public LocalizedString this[string name] => new(name, name);
        public LocalizedString this[string name, params object[] arguments] => new(name, string.Format(name, arguments));
        public IEnumerable<LocalizedString> GetAllStrings(bool includeParentCultures) => [];
    }
}

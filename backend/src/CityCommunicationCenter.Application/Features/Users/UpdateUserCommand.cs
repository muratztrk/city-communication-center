using Microsoft.Extensions.Localization;

namespace CityCommunicationCenter.Application.Features.Users;

public sealed record UpdateUserCommand(
    Guid UserId,
    Guid DepartmentId,
    IReadOnlyCollection<Guid>? AdditionalDepartmentIds,
    string RoleCode,
    IReadOnlyCollection<string>? AdditionalRoleCodes,
    bool IsActive) : ICommand<UserSummaryResponse>;

public sealed class UpdateUserCommandValidator : AbstractValidator<UpdateUserCommand>
{
    public UpdateUserCommandValidator(IStringLocalizer<ApplicationResource> localizer)
    {
        RuleFor(command => command.UserId)
            .NotEmpty()
            .WithMessage(localizer["ValidationUserIdRequired"]);

        RuleFor(command => command.DepartmentId)
            .NotEmpty()
            .WithMessage(localizer["ValidationDepartmentRequired"]);

        RuleFor(command => command.RoleCode)
            .NotEmpty()
            .Must(value => Enum.TryParse<RoleCode>(value, true, out _))
            .WithMessage(localizer["ValidationRoleRequired"]);
    }
}

public sealed class UpdateUserCommandHandler : ICommandHandler<UpdateUserCommand, UserSummaryResponse>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;
    private readonly IStringLocalizer<ApplicationResource> _localizer;

    public UpdateUserCommandHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor,
        IStringLocalizer<ApplicationResource> localizer)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
        _localizer = localizer;
    }

    public async ValueTask<UserSummaryResponse> Handle(UpdateUserCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();

        var user = await _dbContext.Users
            .FirstOrDefaultAsync(
                entity => entity.UserId == request.UserId && entity.TenantId == tenantId,
                cancellationToken);

        if (user is null)
        {
            throw new ValidationException(_localizer["ValidationUserNotFound"]);
        }

        var department = await _dbContext.Departments
            .FirstOrDefaultAsync(
                entity => entity.DepartmentId == request.DepartmentId && entity.TenantId == tenantId,
                cancellationToken);

        if (department is null)
        {
            throw new ValidationException(_localizer["ValidationDepartmentNotFound"]);
        }

        var roleCode = Enum.Parse<RoleCode>(request.RoleCode, true);
        if (roleCode == RoleCode.Manager)
        {
            await UserManagerQuotaValidator.EnsureSingleManagerPerDepartmentAsync(
                _dbContext,
                tenantId,
                request.DepartmentId,
                user.UserId,
                cancellationToken);
        }

        user.DepartmentId = request.DepartmentId;
        user.RoleCode = roleCode;
        user.IsActive = request.IsActive;
        UserRoleAccess.ApplyAdditionalRoleCodes(user, request.AdditionalRoleCodes);
        user.UpdatedAtUtc = DateTimeOffset.UtcNow;
        user.UpdatedByUserId = context.UserId;

        await UserDepartmentAccess.ReplaceAdditionalAssignmentsAsync(
            _dbContext,
            tenantId,
            user.UserId,
            user.DepartmentId,
            request.AdditionalDepartmentIds,
            context.UserId,
            user.UpdatedAtUtc.Value,
            cancellationToken);

        await _dbContext.SaveChangesAsync(cancellationToken);
        var departments = await UserDepartmentAccess.GetMembershipDepartmentSummariesAsync(
            _dbContext,
            tenantId,
            user,
            cancellationToken);

        return new UserSummaryResponse(
            user.UserId,
            user.TenantId,
            user.DepartmentId,
            user.Username,
            user.DisplayName,
            user.Email,
            user.RoleCode.ToString(),
            user.IsActive,
            user.UserSource.ToString(),
            user.Title,
            user.Phone,
            departments,
            UserRoleAccess.GetAdditionalRoleCodeStrings(user));
    }
}

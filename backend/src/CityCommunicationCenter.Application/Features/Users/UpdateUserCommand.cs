using Microsoft.Extensions.Localization;

namespace CityCommunicationCenter.Application.Features.Users;

public sealed record UpdateUserCommand(
    Guid UserId,
    Guid DepartmentId,
    string RoleCode,
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

        user.DepartmentId = request.DepartmentId;
        user.RoleCode = Enum.Parse<RoleCode>(request.RoleCode, true);
        user.IsActive = request.IsActive;
        user.UpdatedAtUtc = DateTimeOffset.UtcNow;
        user.UpdatedByUserId = context.UserId;

        await _dbContext.SaveChangesAsync(cancellationToken);

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
            user.Phone);
    }
}

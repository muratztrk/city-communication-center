
using CityCommunicationCenter.Application.Features.Users;

namespace CityCommunicationCenter.Application.Features.Social;

public sealed record RouteSocialMessageCommand(Guid MessageId, Guid? ActorUserId, Guid? DepartmentId, Guid? UserId) : ICommand<bool>;

public sealed class RouteSocialMessageCommandValidator : AbstractValidator<RouteSocialMessageCommand>
{
    public RouteSocialMessageCommandValidator()
    {
        RuleFor(command => command)
            .Must(command => command.DepartmentId.HasValue || command.UserId.HasValue)
            .WithMessage("En az bir yonlendirme hedefi gereklidir.");
    }
}

public sealed class RouteSocialMessageCommandHandler : ICommandHandler<RouteSocialMessageCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public RouteSocialMessageCommandHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<bool> Handle(RouteSocialMessageCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        var actor = await ActorAuthorization.RequireActiveActorAsync(_dbContext, request.ActorUserId, tenantId, cancellationToken);
        var message = await _dbContext.SocialMessages.FirstOrDefaultAsync(
            entity => entity.SocialMessageId == request.MessageId && entity.TenantId == tenantId,
            cancellationToken);
        if (message is null)
        {
            return false;
        }

        if (actor.RoleCode != RoleCode.Operator && actor.RoleCode != RoleCode.SystemAdmin)
        {
            throw new ForbiddenAccessException("Vatandaş talebini sadece operatör veya sistem yöneticisi müdürlüğe atayabilir.");
        }

        if (message.AssignedDepartmentId.HasValue)
        {
            throw new ValidationException([
                new FluentValidation.Results.ValidationFailure(nameof(request.MessageId), "Bu vatandaş talebi zaten bir müdürlüğe atanmış.")
            ]);
        }

        Department? targetDepartment = null;
        if (request.DepartmentId.HasValue)
        {
            targetDepartment = await _dbContext.Departments.FirstOrDefaultAsync(
                entity => entity.DepartmentId == request.DepartmentId.Value && entity.TenantId == tenantId,
                cancellationToken);
            if (targetDepartment is null)
            {
                throw new ValidationException([
                    new FluentValidation.Results.ValidationFailure(nameof(request.DepartmentId), "Secilen departman bulunamadi.")
                ]);
            }
        }

        if (request.UserId.HasValue)
        {
            var targetUser = await _dbContext.Users.FirstOrDefaultAsync(
                entity => entity.UserId == request.UserId.Value && entity.TenantId == tenantId,
                cancellationToken);
            if (targetUser is null || !targetUser.IsActive)
            {
                throw new ValidationException([
                    new FluentValidation.Results.ValidationFailure(nameof(request.UserId), "Secilen kullanici bulunamadi veya aktif degil.")
                ]);
            }

            if (targetDepartment is not null &&
                !await UserDepartmentAccess.CanWorkInDepartmentAsync(_dbContext, tenantId, targetUser, targetDepartment.DepartmentId, cancellationToken))
            {
                throw new ValidationException([
                    new FluentValidation.Results.ValidationFailure(nameof(request.UserId), "Secilen kullanici secilen departmana ait degil.")
                ]);
            }

            if (targetDepartment is null)
            {
                var defaultDepartmentId = await UserDepartmentAccess.GetDefaultDepartmentIdAsync(
                    _dbContext,
                    tenantId,
                    targetUser,
                    context.ActiveDepartmentId,
                    cancellationToken);
                targetDepartment = await _dbContext.Departments.FirstOrDefaultAsync(
                    entity => entity.DepartmentId == defaultDepartmentId && entity.TenantId == tenantId,
                    cancellationToken);
            }
        }

        message.AssignedDepartmentId = targetDepartment?.DepartmentId;
        message.Status = SocialMessageStatus.Routed;
        message.UpdatedByUserId = actor.UserId;
        message.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }
}

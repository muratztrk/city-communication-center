using Microsoft.Extensions.Localization;

namespace CityCommunicationCenter.Application.Features.Users;

public sealed record DeleteUserCommand(Guid UserId) : ICommand<Unit>;

public sealed class DeleteUserCommandValidator : AbstractValidator<DeleteUserCommand>
{
    public DeleteUserCommandValidator(IStringLocalizer<ApplicationResource> localizer)
    {
        RuleFor(command => command.UserId)
            .NotEmpty()
            .WithMessage(localizer["ValidationUserIdRequired"]);
    }
}

public sealed class DeleteUserCommandHandler : ICommandHandler<DeleteUserCommand, Unit>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;
    private readonly IStringLocalizer<ApplicationResource> _localizer;

    public DeleteUserCommandHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor,
        IStringLocalizer<ApplicationResource> localizer)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
        _localizer = localizer;
    }

    public async ValueTask<Unit> Handle(DeleteUserCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        var currentUserId = context.UserId;

        if (request.UserId == currentUserId)
        {
            throw new ValidationException(_localizer["ValidationCannotDeleteSelf"]);
        }

        var user = await _dbContext.Users
            .FirstOrDefaultAsync(
                entity => entity.UserId == request.UserId && entity.TenantId == tenantId,
                cancellationToken);

        if (user is null)
        {
            throw new ValidationException(_localizer["ValidationUserNotFound"]);
        }

        // Nullify references in tasks assigned to this user
        await _dbContext.Tasks
            .Where(task => task.TenantId == tenantId && task.AssignedUserId == request.UserId)
            .ExecuteUpdateAsync(
                setters => setters.SetProperty(task => task.AssignedUserId, (Guid?)null),
                cancellationToken);

        _dbContext.AuditLogs.Add(new AuditLog
        {
            AuditLogId = Guid.NewGuid(),
            TenantId = tenantId,
            EntityType = nameof(ApplicationUser),
            EntityId = user.UserId.ToString(),
            Action = "UserDeleted",
            ActorUserId = currentUserId,
            Details = $"User '{user.DisplayName}' deleted.",
        });

        _dbContext.Users.Remove(user);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return Unit.Value;
    }
}

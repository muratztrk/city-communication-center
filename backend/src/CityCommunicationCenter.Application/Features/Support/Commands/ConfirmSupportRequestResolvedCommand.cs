using CityCommunicationCenter.Application.Abstractions.Support;

namespace CityCommunicationCenter.Application.Features.Support;

public sealed record ConfirmSupportRequestResolvedCommand(Guid SupportRequestId) : ICommand<bool>;

public sealed class ConfirmSupportRequestResolvedCommandValidator
    : AbstractValidator<ConfirmSupportRequestResolvedCommand>
{
    public ConfirmSupportRequestResolvedCommandValidator()
    {
        RuleFor(command => command.SupportRequestId)
            .NotEmpty()
            .WithMessage("Destek talebi kimliği gereklidir.");
    }
}

public sealed class ConfirmSupportRequestResolvedCommandHandler
    : ICommandHandler<ConfirmSupportRequestResolvedCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;
    private readonly ILumespecSupportClient _lumespecSupportClient;

    public ConfirmSupportRequestResolvedCommandHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor,
        ILumespecSupportClient lumespecSupportClient)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
        _lumespecSupportClient = lumespecSupportClient;
    }

    public async ValueTask<bool> Handle(
        ConfirmSupportRequestResolvedCommand request,
        CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        var userId = context.UserId;

        var entity = await _dbContext.SupportRequests
            .Where(item => item.SupportRequestId == request.SupportRequestId && item.TenantId == tenantId)
            .FirstOrDefaultAsync(cancellationToken);

        if (entity is null)
        {
            return false;
        }

        if (userId.HasValue && entity.CreatedByUserId != userId)
        {
            throw new ForbiddenAccessException("Bu destek talebini onaylama yetkiniz yok.");
        }

        var synced = await _lumespecSupportClient.UpdateTicketStatusAsync(
            entity.SupportRequestId,
            "resolved",
            cancellationToken);

        entity.CentralStatus = "resolved";
        entity.ResolvedAtUtc = DateTimeOffset.UtcNow;
        entity.CentralSyncedAtUtc = DateTimeOffset.UtcNow;
        entity.CentralSyncError = synced ? null : "Merkezi destek durumu güncellenemedi.";
        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }
}

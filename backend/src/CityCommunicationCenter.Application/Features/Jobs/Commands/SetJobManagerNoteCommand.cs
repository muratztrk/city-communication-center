using CityCommunicationCenter.Application.Abstractions;

namespace CityCommunicationCenter.Application.Features.Jobs;

/// <summary>
/// Talep sahibinin yöneticisinin, hedef birim onaylayana kadar talebe eklediği "Yönetici Notu" (card 453).
/// </summary>
public sealed record SetJobManagerNoteCommand(
    Guid JobId,
    Guid? ActorUserId,
    string? Note) : ICommand<bool>;

public sealed class SetJobManagerNoteCommandHandler : ICommandHandler<SetJobManagerNoteCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public SetJobManagerNoteCommandHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<bool> Handle(SetJobManagerNoteCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        var actor = await JobWorkflowAuthorization.RequireActorAsync(
            _dbContext, request.ActorUserId, tenantId, cancellationToken);

        if (actor.RoleCode is not (RoleCode.Manager or RoleCode.Reporter or RoleCode.SystemAdmin))
        {
            throw new ForbiddenAccessException("Yönetici notu ekleme yetkiniz yok.");
        }

        var job = await _dbContext.Jobs.FirstOrDefaultAsync(
            item => item.JobId == request.JobId && item.TenantId == tenantId,
            cancellationToken);
        if (job is null)
        {
            return false;
        }

        var note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim();
        job.ManagerNote = note;
        job.UpdatedAtUtc = DateTimeOffset.UtcNow;
        job.UpdatedByUserId = actor.UserId;

        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }
}

using CityCommunicationCenter.Application.Abstractions;

namespace CityCommunicationCenter.Application.Features.Jobs;

/// <summary>
/// Talep sahibinin yöneticisinin, hedef birim onaylayana kadar talebe eklediği "Yönetici Notu" (card 453).
/// </summary>
public sealed record SetJobManagerNoteCommand(
    Guid JobId,
    Guid? ActorUserId,
    string? Note) : ICommand<bool>;

public sealed class SetJobManagerNoteCommandValidator : AbstractValidator<SetJobManagerNoteCommand>
{
    public SetJobManagerNoteCommandValidator()
    {
        RuleFor(command => command.Note)
            .MaximumLength(100)
            .WithMessage("Yönetici notu en fazla 100 karakter olabilir.");
    }
}

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

        if (job.Status is JobStatus.Completed or JobStatus.Cancelled)
        {
            throw new ValidationException([
                new FluentValidation.Results.ValidationFailure(
                    nameof(request.JobId),
                    "Tamamlanmış veya iptal edilmiş taleplere yönetici notu eklenemez.")
            ]);
        }

        var note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim();
        var utcNow = DateTimeOffset.UtcNow;
        job.ManagerNote = note;
        job.UpdatedAtUtc = utcNow;
        job.UpdatedByUserId = actor.UserId;

        // Göreve atanmış kullanıcı, yönetici notu eklendiğinde bildirim akışında bu
        // değişikliği görebilsin. Bildirim sorgusu denetim kayıtlarını kullanır.
        _dbContext.AuditLogs.Add(new AuditLog
        {
            AuditLogId = Guid.NewGuid(),
            TenantId = tenantId,
            EntityType = nameof(Job),
            EntityId = job.JobId.ToString(),
            Action = note is null ? "JobManagerNoteDeleted" : "JobManagerNoteAdded",
            ActorUserId = actor.UserId,
            ActorDisplayName = actor.DisplayName,
            StatusAtEvent = job.Status.ToString(),
            Notes = note,
            Details = note,
            EventTimeUtc = utcNow,
        });

        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }
}

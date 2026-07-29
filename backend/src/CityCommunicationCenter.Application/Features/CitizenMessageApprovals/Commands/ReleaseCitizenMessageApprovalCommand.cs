using CityCommunicationCenter.Application.Features.Jobs;

namespace CityCommunicationCenter.Application.Features.CitizenMessageApprovals.Commands;

/// <summary>
/// Vatandaşa Gönderilecek Mesaj Onayı — "Mesajı Gönder": terminal otomatik mesajı + notu operatör
/// WhatsApp ekranına Pending olarak serbest bırakır. `SendPendingConversationEntryCommand` DEĞİLDİR;
/// Manager/CRM burada yalnızca serbest bırakır, gerçek gönderimi Operator/SystemAdmin yapar (card #2039).
/// </summary>
public sealed record ReleaseCitizenMessageApprovalCommand(Guid JobId, Guid? ActorUserId) : ICommand<bool>;

public sealed class ReleaseCitizenMessageApprovalCommandHandler : ICommandHandler<ReleaseCitizenMessageApprovalCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;
    private readonly ICitizenJobStatusNotifier _citizenJobStatusNotifier;

    public ReleaseCitizenMessageApprovalCommandHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor,
        ICitizenJobStatusNotifier citizenJobStatusNotifier)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
        _citizenJobStatusNotifier = citizenJobStatusNotifier;
    }

    public async ValueTask<bool> Handle(ReleaseCitizenMessageApprovalCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        var actor = await JobWorkflowAuthorization.RequireActorAsync(
            _dbContext, request.ActorUserId, tenantId, cancellationToken);

        var job = await _dbContext.Jobs.AsNoTracking().FirstOrDefaultAsync(
            j => j.JobId == request.JobId
                && j.TenantId == tenantId
                && j.RequestType == JobRequestType.Citizen
                && (j.Status == JobStatus.Completed || j.Status == JobStatus.Cancelled),
            cancellationToken);
        if (job is null)
        {
            return false;
        }

        if (!await CitizenMessageApprovalAccess.CanAccessJobAsync(
                _dbContext, tenantId, actor, job, context.ActiveDepartmentId, cancellationToken))
        {
            throw new ForbiddenAccessException("Bu talebin vatandaş mesajını gönderme yetkiniz yok.");
        }

        var note = await CitizenMessageApprovalNoteResolver.ResolveAsync(_dbContext, tenantId, job, cancellationToken);
        if (string.IsNullOrWhiteSpace(note))
        {
            throw new ValidationException([
                new FluentValidation.Results.ValidationFailure(
                    nameof(request.JobId),
                    "Vatandaşa gönderilecek mesajın notu boş olamaz. Lütfen önce Mesajı Düzenle ile bir not girin.")
            ]);
        }

        await _citizenJobStatusNotifier.ReleaseTerminalMessagesAsync(tenantId, job.JobId, cancellationToken);

        _dbContext.AuditLogs.Add(new AuditLog
        {
            AuditLogId = Guid.NewGuid(),
            TenantId = tenantId,
            EntityType = nameof(Job),
            EntityId = job.JobId.ToString(),
            Action = "CitizenMessageApprovalReleased",
            ActorUserId = actor.UserId,
            ActorDisplayName = actor.DisplayName,
            StatusAtEvent = job.Status.ToString(),
            Notes = note,
        });
        await _dbContext.SaveChangesAsync(cancellationToken);

        return true;
    }
}

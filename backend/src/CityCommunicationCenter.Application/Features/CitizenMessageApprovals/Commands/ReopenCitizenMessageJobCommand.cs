using CityCommunicationCenter.Application.Features.Jobs;

namespace CityCommunicationCenter.Application.Features.CitizenMessageApprovals.Commands;

/// <summary>
/// Vatandaşa Gönderilecek Mesaj Onayı — detay popup "Talep Durumu Değiştir":
/// Completed/Cancelled talebi tekrar Active (İşleme Alındı) yapar; terminal görevler
/// InProgress'e alınmaz (yeniden personel ataması gerekir); serbest bırakma bayrağını
/// temizler (liste dışına çıkar — card #2057 / #6a6ae7e2).
/// </summary>
public sealed record ReopenCitizenMessageJobCommand(Guid JobId, Guid? ActorUserId) : ICommand<bool>;

public sealed class ReopenCitizenMessageJobCommandHandler : ICommandHandler<ReopenCitizenMessageJobCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public ReopenCitizenMessageJobCommandHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<bool> Handle(ReopenCitizenMessageJobCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        var actor = await JobWorkflowAuthorization.RequireActorAsync(
            _dbContext, request.ActorUserId, tenantId, cancellationToken);

        var job = await CitizenMessageApprovalAccess.FindEligibleTerminalJobAsync(
            _dbContext, tenantId, request.JobId, track: true, cancellationToken);
        if (job is null)
        {
            return false;
        }

        if (!await CitizenMessageApprovalAccess.CanAccessJobAsync(
                _dbContext, tenantId, actor, job, context.ActiveDepartmentId, cancellationToken))
        {
            throw new ForbiddenAccessException("Bu talebin durumunu değiştirme yetkiniz yok.");
        }

        var previousStatus = job.Status;
        var utcNow = DateTimeOffset.UtcNow;

        job.Status = JobStatus.Active;
        // Tamamlanma tarihini timeline için koru (Active + completedAt = reopen geçmişi — #2099).
        if (previousStatus != JobStatus.Completed)
        {
            job.CompletedAtUtc = null;
        }
        job.CompletionPercentage = 0;
        job.CitizenTerminalMessageReleasedAtUtc = null;
        job.UpdatedAtUtc = utcNow;
        job.UpdatedByUserId = actor.UserId;

        // Terminal görevler InProgress'e alınmaz — UI "İşleme Alındı" + Onayla (atama) kalır (#6a6ae7e2).

        _dbContext.AuditLogs.Add(new AuditLog
        {
            AuditLogId = Guid.NewGuid(),
            TenantId = tenantId,
            EntityType = nameof(Job),
            EntityId = job.JobId.ToString(),
            Action = "CitizenMessageJobReopenedToProcessingReceived",
            ActorUserId = actor.UserId,
            ActorDisplayName = actor.DisplayName,
            StatusAtEvent = JobStatus.Active.ToString(),
            Notes = "Vatandaşa Gönderilecek Mesaj Onayı — talep durumu İşleme Alındı olarak değiştirildi.",
            Details = $"{previousStatus}->{JobStatus.Active}",
        });

        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }
}

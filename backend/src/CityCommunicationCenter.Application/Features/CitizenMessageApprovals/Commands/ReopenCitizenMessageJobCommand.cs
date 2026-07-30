using CityCommunicationCenter.Application.Features.Jobs;
using WorkflowTaskStatus = CityCommunicationCenter.Domain.Enums.TaskStatus;

namespace CityCommunicationCenter.Application.Features.CitizenMessageApprovals.Commands;

/// <summary>
/// Vatandaşa Gönderilecek Mesaj Onayı — detay popup "Talep Durumu Değiştir":
/// Completed/Cancelled talebi tekrar Active (Yapılmakta) yapar; bağlı terminal görevleri
/// InProgress'e alır; serbest bırakma bayrağını temizler (liste dışına çıkar — card #2057).
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
        job.CitizenTerminalMessageReleasedAtUtc = null;
        job.UpdatedAtUtc = utcNow;
        job.UpdatedByUserId = actor.UserId;

        var terminalTasks = await _dbContext.Tasks
            .Where(t => t.TenantId == tenantId
                && t.JobId == job.JobId
                && (t.CurrentStatus == WorkflowTaskStatus.Completed
                    || t.CurrentStatus == WorkflowTaskStatus.Cancelled))
            .ToListAsync(cancellationToken);

        foreach (var task in terminalTasks)
        {
            task.CurrentStatus = WorkflowTaskStatus.InProgress;
            task.CompletedAtUtc = null;
            task.CompletionPercentage = 0;
            task.UpdatedAtUtc = utcNow;
            task.UpdatedByUserId = actor.UserId;
        }

        _dbContext.AuditLogs.Add(new AuditLog
        {
            AuditLogId = Guid.NewGuid(),
            TenantId = tenantId,
            EntityType = nameof(Job),
            EntityId = job.JobId.ToString(),
            Action = "CitizenMessageJobReopenedToInProgress",
            ActorUserId = actor.UserId,
            ActorDisplayName = actor.DisplayName,
            StatusAtEvent = JobStatus.Active.ToString(),
            Notes = "Vatandaşa Gönderilecek Mesaj Onayı — talep durumu Yapılmakta olarak değiştirildi.",
            Details = $"{previousStatus}->{JobStatus.Active}",
        });

        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }
}

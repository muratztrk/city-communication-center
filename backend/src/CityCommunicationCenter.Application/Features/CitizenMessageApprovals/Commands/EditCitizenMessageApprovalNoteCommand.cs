using CityCommunicationCenter.Application.Features.Jobs;
using WorkflowTaskStatus = CityCommunicationCenter.Domain.Enums.TaskStatus;

namespace CityCommunicationCenter.Application.Features.CitizenMessageApprovals.Commands;

/// <summary>
/// Vatandaşa Gönderilecek Mesaj Onayı — terminal notu (Tamamlanma/İptal Notu) Manager/CRM tarafından
/// düzenlenir; not asla boş olamaz (card #2039 / #2063).
/// </summary>
public sealed record EditCitizenMessageApprovalNoteCommand(
    Guid JobId,
    Guid? ActorUserId,
    string Note) : ICommand<bool>;

public sealed class EditCitizenMessageApprovalNoteCommandValidator : AbstractValidator<EditCitizenMessageApprovalNoteCommand>
{
    public EditCitizenMessageApprovalNoteCommandValidator()
    {
        RuleFor(command => command.Note)
            .NotEmpty().WithMessage("Not ifadesi zorunludur.")
            .MaximumLength(100).WithMessage("Not en fazla 100 karakter olabilir.");
    }
}

public sealed class EditCitizenMessageApprovalNoteCommandHandler : ICommandHandler<EditCitizenMessageApprovalNoteCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public EditCitizenMessageApprovalNoteCommandHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<bool> Handle(EditCitizenMessageApprovalNoteCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        var actor = await JobWorkflowAuthorization.RequireActorAsync(
            _dbContext, request.ActorUserId, tenantId, cancellationToken);

        var job = await _dbContext.Jobs.FirstOrDefaultAsync(
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
            throw new ForbiddenAccessException("Bu talebin vatandaş mesajı notunu düzenleme yetkiniz yok.");
        }

        var note = request.Note.Trim();
        string action;
        if (job.Status == JobStatus.Cancelled)
        {
            job.CancelReason = note;
            action = "CitizenMessageApprovalCancelNoteEdited";
        }
        else
        {
            var task = await _dbContext.Tasks
                .Where(t => t.TenantId == tenantId
                    && t.JobId == job.JobId
                    && (t.CompletedAtUtc != null || t.CurrentStatus == WorkflowTaskStatus.Completed))
                .OrderByDescending(t => t.CompletedAtUtc ?? t.UpdatedAtUtc)
                .FirstOrDefaultAsync(cancellationToken)
                ?? await _dbContext.Tasks
                    .Where(t => t.TenantId == tenantId && t.JobId == job.JobId)
                    .OrderByDescending(t => t.UpdatedAtUtc)
                    .FirstOrDefaultAsync(cancellationToken);

            if (task is null)
            {
                throw new ValidationException([
                    new FluentValidation.Results.ValidationFailure(
                        nameof(request.Note),
                        "Not kaydedilecek tamamlanmış görev bulunamadı.")
                ]);
            }

            task.Notes = note;
            task.UpdatedByUserId = actor.UserId;
            action = "CitizenMessageApprovalCompletionNoteEdited";
        }

        job.UpdatedByUserId = actor.UserId;

        _dbContext.AuditLogs.Add(new AuditLog
        {
            AuditLogId = Guid.NewGuid(),
            TenantId = tenantId,
            EntityType = nameof(Job),
            EntityId = job.JobId.ToString(),
            Action = action,
            ActorUserId = actor.UserId,
            ActorDisplayName = actor.DisplayName,
            StatusAtEvent = job.Status.ToString(),
            Notes = note,
            Details = note,
        });

        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }
}

using CityCommunicationCenter.Application.Features.Jobs;
using WorkflowTaskStatus = CityCommunicationCenter.Domain.Enums.TaskStatus;

namespace CityCommunicationCenter.Application.Features.Tasks;

public sealed record UpdateTaskCompletionNoteCommand(Guid TaskId, Guid? ActorUserId, string Note) : ICommand<bool>;

public sealed class UpdateTaskCompletionNoteCommandValidator : AbstractValidator<UpdateTaskCompletionNoteCommand>
{
    public UpdateTaskCompletionNoteCommandValidator()
    {
        RuleFor(x => x.Note)
            .NotEmpty()
            .WithMessage("Tamamlama notu gereklidir.")
            .MaximumLength(400)
            .WithMessage("Tamamlama notu en fazla 400 karakter olabilir.");
    }
}

public sealed class UpdateTaskCompletionNoteCommandHandler : ICommandHandler<UpdateTaskCompletionNoteCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public UpdateTaskCompletionNoteCommandHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<bool> Handle(UpdateTaskCompletionNoteCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        var task = await _dbContext.Tasks.FirstOrDefaultAsync(
            entity => entity.TaskId == request.TaskId && entity.TenantId == tenantId,
            cancellationToken);
        if (task is null)
        {
            return false;
        }

        var actor = await TaskWorkflowAuthorization.RequireActiveActorAsync(
            _dbContext, request.ActorUserId, tenantId, cancellationToken);
        await TaskWorkflowAuthorization.EnsureCanActAsAssigneeAsync(
            _dbContext, task, request.ActorUserId, tenantId, cancellationToken);

        if (task.CurrentStatus is not (WorkflowTaskStatus.Completed or WorkflowTaskStatus.PendingCloseApproval))
        {
            throw Validation(nameof(request.Note), "Tamamlama notu yalnızca tamamlanmış veya onay bekleyen görevde düzenlenebilir.");
        }

        var job = await _dbContext.Jobs.FirstOrDefaultAsync(
            entity => entity.JobId == task.JobId && entity.TenantId == tenantId,
            cancellationToken);
        var isCitizen = job is not null && JobCitizenRequestHelper.IsCitizenRequest(job);
        if (isCitizen && job!.CitizenTerminalMessageReleasedAtUtc is not null)
        {
            throw Validation(nameof(request.Note), "Onaylanmış tamamlama notu düzenlenemez.");
        }

        if (!isCitizen && task.CurrentStatus != WorkflowTaskStatus.PendingCloseApproval)
        {
            throw Validation(nameof(request.Note), "Tamamlama notu yalnızca onaylanmadan önce düzenlenebilir.");
        }

        var note = TurkishText.EnsureLeadingCapital(request.Note.Trim()) ?? request.Note.Trim();
        task.Notes = note;
        task.UpdatedAtUtc = DateTimeOffset.UtcNow;
        task.UpdatedByUserId = actor.UserId;

        if (job is not null)
        {
            job.UpdatedByUserId = actor.UserId;
        }

        // Görevlerim düzenlemesi onay sayfasındaki "Güncellenen Tamamlama Notu" ayrımını
        // açmamalı — o ayrım yalnız Mesaj Onayı "Notu Düzenle" audit'inden gelir (#3962).
        _dbContext.AuditLogs.Add(new AuditLog
        {
            AuditLogId = Guid.NewGuid(),
            TenantId = tenantId,
            EntityType = nameof(WorkTask),
            EntityId = task.TaskId.ToString(),
            Action = "TaskCompletionNoteEdited",
            ActorUserId = actor.UserId,
            ActorDisplayName = actor.DisplayName,
            StatusAtEvent = task.CurrentStatus.ToString(),
            Notes = note,
            Details = note,
        });

        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    private static ValidationException Validation(string property, string message) =>
        new([new FluentValidation.Results.ValidationFailure(property, message)]);
}

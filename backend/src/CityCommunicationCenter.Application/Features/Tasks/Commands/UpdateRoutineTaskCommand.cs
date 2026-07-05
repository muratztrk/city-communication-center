using System.Text.Json;
using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Application.Common;
using CityCommunicationCenter.Application.Features.Users;
using WorkflowTaskStatus = CityCommunicationCenter.Domain.Enums.TaskStatus;

namespace CityCommunicationCenter.Application.Features.Tasks;

public sealed record RoutineTaskEditSnapshotAttachment(
    Guid AttachmentId,
    string FileName,
    string ContentType,
    long FileSizeBytes,
    string RelativeUrl);

public sealed record RoutineTaskEditSnapshot(
    string Title,
    string Description,
    string Priority,
    DateTimeOffset? DueDateUtc,
    string? Neighborhood,
    string? Street,
    string? OpenAddress,
    IReadOnlyList<RoutineTaskEditSnapshotAttachment> Attachments);

public sealed record UpdateRoutineTaskCommand(
    Guid TaskId,
    Guid? ActorUserId,
    string Title,
    string Description,
    string Priority,
    DateTimeOffset? DueDateUtc,
    string? Notes,
    string? Neighborhood = null,
    string? Street = null,
    string? OpenAddress = null) : ICommand<TaskSummaryResponse>;

public sealed class UpdateRoutineTaskCommandValidator : AbstractValidator<UpdateRoutineTaskCommand>
{
    public UpdateRoutineTaskCommandValidator()
    {
        RuleFor(c => c.Title).NotEmpty().WithMessage("Gorev basligi zorunludur.");
        RuleFor(c => c.Description).NotEmpty().WithMessage("Gorev aciklamasi zorunludur.");
        RuleFor(c => c.Priority).NotEmpty().WithMessage("Oncelik alani zorunludur.");
        RuleFor(c => c.Street).MaximumLength(AddressFieldLimits.StreetMaxLength)
            .WithMessage("Cadde / Sokak / Bulvar en fazla 50 karakter olabilir.");
        RuleFor(c => c.OpenAddress).MaximumLength(AddressFieldLimits.OpenAddressMaxLength)
            .WithMessage("Açık Adres en fazla 100 karakter olabilir.");
    }
}

public sealed class UpdateRoutineTaskCommandHandler : ICommandHandler<UpdateRoutineTaskCommand, TaskSummaryResponse>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public UpdateRoutineTaskCommandHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<TaskSummaryResponse> Handle(UpdateRoutineTaskCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();

        var task = await _dbContext.Tasks.FirstOrDefaultAsync(
            entity => entity.TaskId == request.TaskId && entity.TenantId == tenantId,
            cancellationToken)
            ?? throw Validation(nameof(request.TaskId), "Gorev bulunamadi.");

        var job = await _dbContext.Jobs.FirstOrDefaultAsync(
            entity => entity.JobId == task.JobId && entity.TenantId == tenantId,
            cancellationToken)
            ?? throw Validation(nameof(request.TaskId), "Gorev bulunamadi.");

        if (job.SourceType != Domain.Enums.JobSourceType.Routine)
            throw Validation(nameof(request.TaskId), "Yalnizca rutin gorevler duzenlenebilir.");

        if (task.CurrentStatus is not (WorkflowTaskStatus.Assigned or WorkflowTaskStatus.InProgress or WorkflowTaskStatus.RevisionRequested))
            throw Validation(nameof(request.TaskId), "Tamamlanmis veya iptal edilmis rutin gorev duzenlenemez.");

        var actor = await TaskWorkflowAuthorization.RequireActiveActorAsync(_dbContext, request.ActorUserId, tenantId, cancellationToken);
        await TaskWorkflowAuthorization.EnsureCanActAsAssigneeAsync(_dbContext, task, request.ActorUserId, tenantId, cancellationToken);

        var utcNow = DateTimeOffset.UtcNow;
        var attachments = await _dbContext.Attachments
            .AsNoTracking()
            .Where(a => a.TenantId == tenantId && a.EntityType == "Task" && a.EntityId == request.TaskId)
            .OrderBy(a => a.CreatedAtUtc)
            .Select(a => new RoutineTaskEditSnapshotAttachment(
                a.AttachmentId,
                a.FileName,
                a.ContentType,
                a.FileSizeBytes,
                a.RelativeUrl))
            .ToListAsync(cancellationToken);

        var snapshot = new RoutineTaskEditSnapshot(
            task.Title,
            task.Description,
            task.Priority,
            task.DueDateUtc,
            job.Neighborhood,
            job.Street,
            job.OpenAddress,
            attachments);

        _dbContext.AuditLogs.Add(new AuditLog
        {
            AuditLogId = Guid.NewGuid(),
            TenantId = tenantId,
            EntityType = nameof(WorkTask),
            EntityId = task.TaskId.ToString(),
            Action = "RoutineTaskEditSnapshot",
            ActorUserId = context.UserId,
            ActorDisplayName = actor.DisplayName,
            StatusAtEvent = task.CurrentStatus.ToString(),
            Notes = JsonSerializer.Serialize(snapshot, JsonSerializerOptions.Web),
            Details = $"Routine task snapshot before edit by {actor.DisplayName}"
        });

        var title = request.Title.Trim();
        var description = request.Description.Trim();
        var priority = request.Priority.Trim();

        task.Title = title;
        task.Description = description;
        task.Priority = priority;
        task.DueDateUtc = request.DueDateUtc;
        task.Notes = request.Notes;
        task.UpdatedAtUtc = utcNow;
        task.UpdatedByUserId = actor.UserId;

        job.Title = title;
        job.Description = description;
        job.Priority = priority;
        job.DueDateUtc = request.DueDateUtc;
        job.Neighborhood = string.IsNullOrWhiteSpace(request.Neighborhood) ? null : request.Neighborhood.Trim();
        job.Street = string.IsNullOrWhiteSpace(request.Street) ? null : request.Street.Trim();
        job.OpenAddress = string.IsNullOrWhiteSpace(request.OpenAddress) ? null : request.OpenAddress.Trim();
        job.UpdatedAtUtc = utcNow;
        job.UpdatedByUserId = actor.UserId;

        _dbContext.AuditLogs.Add(new AuditLog
        {
            AuditLogId = Guid.NewGuid(),
            TenantId = tenantId,
            EntityType = nameof(WorkTask),
            EntityId = task.TaskId.ToString(),
            Action = "RoutineTaskUpdated",
            ActorUserId = context.UserId,
            ActorDisplayName = actor.DisplayName,
            StatusAtEvent = task.CurrentStatus.ToString(),
            Details = $"Routine task updated by {actor.DisplayName}"
        });

        await _dbContext.SaveChangesAsync(cancellationToken);
        return await TaskSummaryResponseFactory.CreateAsync(_dbContext, task, cancellationToken);
    }

    private static ValidationException Validation(string p, string m) =>
        new([new FluentValidation.Results.ValidationFailure(p, m)]);
}

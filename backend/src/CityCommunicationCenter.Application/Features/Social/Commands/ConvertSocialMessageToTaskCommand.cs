using CityCommunicationCenter.Domain.Enums;
using WorkflowTaskStatus = CityCommunicationCenter.Domain.Enums.TaskStatus;

namespace CityCommunicationCenter.Application.Features.Social;

public sealed record ConvertSocialMessageToTaskCommand(
    Guid MessageId,
    Guid? ActorUserId,
    string Title,
    string Description,
    string Priority,
    DateTimeOffset? DueDateUtc) : ICommand<TaskSummaryResponse?>;

public sealed class ConvertSocialMessageToTaskCommandValidator : AbstractValidator<ConvertSocialMessageToTaskCommand>
{
    public ConvertSocialMessageToTaskCommandValidator()
    {
        RuleFor(command => command.Title)
            .NotEmpty()
            .WithMessage("Gorev basligi zorunludur.");
        RuleFor(command => command.Description)
            .NotEmpty()
            .WithMessage("Gorev aciklamasi zorunludur.");
        RuleFor(command => command.Priority)
            .NotEmpty()
            .WithMessage("Oncelik zorunludur.");
    }
}

public sealed class ConvertSocialMessageToTaskCommandHandler : IRequestHandler<ConvertSocialMessageToTaskCommand, TaskSummaryResponse?>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public ConvertSocialMessageToTaskCommandHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async Task<TaskSummaryResponse?> Handle(ConvertSocialMessageToTaskCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var message = await _dbContext.SocialMessages.FirstOrDefaultAsync(entity => entity.SocialMessageId == request.MessageId, cancellationToken);
        if (message is null)
        {
            return null;
        }

        if (message.TaskId.HasValue)
        {
            var existingTask = await _dbContext.Tasks.FirstOrDefaultAsync(entity => entity.TaskId == message.TaskId.Value, cancellationToken);
            if (existingTask is not null)
            {
                return new TaskSummaryResponse(
                    existingTask.TaskId,
                    existingTask.TenantId,
                    existingTask.Title,
                    existingTask.TaskType.ToString(),
                    existingTask.Priority,
                    existingTask.CurrentStatus.ToString(),
                    existingTask.TargetDepartmentId,
                    existingTask.AssignedUserId,
                    existingTask.DueDateUtc);
            }

            throw new ValidationException([
                new FluentValidation.Results.ValidationFailure(nameof(request.MessageId), "Mesaj zaten goreve donusturulmus ancak hedef gorev bulunamadi.")
            ]);
        }

        var task = new WorkTask
        {
            TaskId = Guid.NewGuid(),
            TenantId = context.TenantId!.Value,
            Title = request.Title.Trim(),
            Description = request.Description.Trim(),
            TaskType = TaskType.CitizenRequest,
            SourceType = SourceType.SocialMessage,
            SourceRefId = message.SocialMessageId,
            TargetDepartmentId = message.AssignedDepartmentId,
            AssignedDepartmentId = message.AssignedDepartmentId,
            Priority = request.Priority.Trim(),
            DueDateUtc = request.DueDateUtc,
            CurrentStatus = WorkflowTaskStatus.Draft,
            CreatedByUserId = request.ActorUserId
        };

        _dbContext.Tasks.Add(task);
        message.TaskId = task.TaskId;
        message.Status = SocialMessageStatus.ConvertedToTask;
        message.UpdatedByUserId = request.ActorUserId;
        message.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _dbContext.SaveChangesAsync(cancellationToken);

        return new TaskSummaryResponse(
            task.TaskId,
            task.TenantId,
            task.Title,
            task.TaskType.ToString(),
            task.Priority,
            task.CurrentStatus.ToString(),
            task.TargetDepartmentId,
            task.AssignedUserId,
            task.DueDateUtc);
    }
}
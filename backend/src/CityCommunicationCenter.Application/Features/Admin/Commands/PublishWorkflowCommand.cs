namespace CityCommunicationCenter.Application.Features.Admin;

public sealed record PublishWorkflowCommand(
    string WorkflowName,
    int Version,
    string? Description) : ICommand<PublishWorkflowAcceptedResponse>;

public sealed class PublishWorkflowCommandValidator : AbstractValidator<PublishWorkflowCommand>
{
    public PublishWorkflowCommandValidator()
    {
        RuleFor(command => command.WorkflowName)
            .NotEmpty()
            .WithMessage("Workflow adi zorunludur.")
            .MaximumLength(200);
        RuleFor(command => command.Version)
            .GreaterThan(0)
            .WithMessage("Workflow versiyonu pozitif olmalidir.");
    }
}

public sealed class PublishWorkflowCommandHandler : ICommandHandler<PublishWorkflowCommand, PublishWorkflowAcceptedResponse>
{
    public ValueTask<PublishWorkflowAcceptedResponse> Handle(PublishWorkflowCommand request, CancellationToken cancellationToken)
    {
        return ValueTask.FromResult(new PublishWorkflowAcceptedResponse(
            "Workflow yayinlama istegi kabul edildi.",
            request.WorkflowName.Trim(),
            request.Version,
            request.Description));
    }
}
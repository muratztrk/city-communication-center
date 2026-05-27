namespace CityCommunicationCenter.Application.Features.Admin;

public sealed record UpdateWorkingHoursCommand(
    Guid TenantId,
    WorkingHoursScheduleRequest Default,
    IReadOnlyList<WorkingHoursDepartmentOverrideRequest> DepartmentOverrides) : ICommand<Unit>;

public sealed class UpdateWorkingHoursCommandValidator : AbstractValidator<UpdateWorkingHoursCommand>
{
    public UpdateWorkingHoursCommandValidator()
    {
        RuleFor(command => command.TenantId)
            .NotEmpty();

        RuleFor(command => command.Default)
            .NotNull();
    }
}

public sealed class UpdateWorkingHoursCommandHandler : ICommandHandler<UpdateWorkingHoursCommand, Unit>
{
    private readonly ITenantWorkingHoursService _tenantWorkingHoursService;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public UpdateWorkingHoursCommandHandler(ITenantWorkingHoursService tenantWorkingHoursService, ITenantContextAccessor tenantContextAccessor)
    {
        _tenantWorkingHoursService = tenantWorkingHoursService;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<Unit> Handle(UpdateWorkingHoursCommand request, CancellationToken cancellationToken)
    {
        var actorUserId = _tenantContextAccessor.GetCurrent().UserId;

        await _tenantWorkingHoursService.SaveSettingsAsync(
            request.TenantId,
            new WorkingHoursUpdate(
                new WorkingHoursSchedule(
                    request.Default.IsAlwaysOpen,
                    request.Default.Schedule.Select(s => new WorkingHoursDaySchedule(s.Day, s.From, s.To)).ToList()),
                request.DepartmentOverrides.Select(o => new WorkingHoursDepartmentOverride(
                    o.DepartmentId,
                    o.DepartmentName,
                    o.IsAlwaysOpen,
                    o.Schedule.Select(s => new WorkingHoursDaySchedule(s.Day, s.From, s.To)).ToList())).ToList()),
            actorUserId,
            cancellationToken);

        return Unit.Value;
    }
}

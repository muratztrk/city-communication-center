using System.Text.Json;

namespace CityCommunicationCenter.Application.Features.Admin;

public sealed record UpdateSlaWeekendSettingsCommand(
    Guid TenantId,
    bool ExcludeWeekends,
    IReadOnlyList<Guid> ExemptDepartmentIds) : ICommand<Unit>;

public sealed class UpdateSlaWeekendSettingsCommandValidator : AbstractValidator<UpdateSlaWeekendSettingsCommand>
{
    public UpdateSlaWeekendSettingsCommandValidator()
    {
        RuleFor(c => c.TenantId).NotEmpty();
        RuleFor(c => c.ExemptDepartmentIds).NotNull();
    }
}

public sealed class UpdateSlaWeekendSettingsCommandHandler : ICommandHandler<UpdateSlaWeekendSettingsCommand, Unit>
{
    private readonly IApplicationDbContext _dbContext;

    public UpdateSlaWeekendSettingsCommandHandler(IApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async ValueTask<Unit> Handle(UpdateSlaWeekendSettingsCommand request, CancellationToken cancellationToken)
    {
        var setting = await _dbContext.TenantSettings
            .FirstOrDefaultAsync(s => s.TenantId == request.TenantId, cancellationToken);

        if (setting is null) return Unit.Value;

        setting.SlaWeekendSettingsJson = JsonSerializer.Serialize(new
        {
            request.ExcludeWeekends,
            request.ExemptDepartmentIds,
        });

        setting.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _dbContext.SaveChangesAsync(cancellationToken);
        return Unit.Value;
    }
}

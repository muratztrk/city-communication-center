namespace CityCommunicationCenter.Application.Features.Admin;

public sealed record GetWorkingHoursQuery(Guid TenantId) : IQuery<WorkingHoursResponse?>;

public sealed class GetWorkingHoursQueryHandler : IQueryHandler<GetWorkingHoursQuery, WorkingHoursResponse?>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantWorkingHoursService _tenantWorkingHoursService;

    public GetWorkingHoursQueryHandler(IApplicationDbContext dbContext, ITenantWorkingHoursService tenantWorkingHoursService)
    {
        _dbContext = dbContext;
        _tenantWorkingHoursService = tenantWorkingHoursService;
    }

    public async ValueTask<WorkingHoursResponse?> Handle(GetWorkingHoursQuery request, CancellationToken cancellationToken)
    {
        var exists = await _dbContext.Tenants.AnyAsync(entity => entity.TenantId == request.TenantId, cancellationToken);
        if (!exists)
        {
            return null;
        }

        var settings = await _tenantWorkingHoursService.GetSettingsAsync(request.TenantId, cancellationToken);
        return new WorkingHoursResponse(
            new WorkingHoursScheduleResponse(
                settings.Default.IsAlwaysOpen,
                settings.Default.Schedule.Select(s => new WorkingHoursDayScheduleResponse(s.Day, s.From, s.To)).ToList()),
            settings.DepartmentOverrides.Select(o => new WorkingHoursDepartmentOverrideResponse(
                o.DepartmentId,
                o.DepartmentName,
                o.IsAlwaysOpen,
                o.Schedule.Select(s => new WorkingHoursDayScheduleResponse(s.Day, s.From, s.To)).ToList())).ToList());
    }
}

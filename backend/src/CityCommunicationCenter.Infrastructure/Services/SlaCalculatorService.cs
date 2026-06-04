using System.Text.Json;
using CityCommunicationCenter.Application.Abstractions;

namespace CityCommunicationCenter.Infrastructure.Services;

public sealed class SlaCalculatorService : ISlaCalculatorService
{
    private readonly IApplicationDbContext _dbContext;

    public SlaCalculatorService(IApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<DateTimeOffset> CalculateDueDateAsync(
        DateTimeOffset startUtc,
        int slaHours,
        Guid tenantId,
        Guid? departmentId = null,
        CancellationToken cancellationToken = default)
    {
        var setting = await _dbContext.TenantSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.TenantId == tenantId, cancellationToken);

        if (!ShouldExcludeWeekends(setting, departmentId))
            return startUtc.AddHours(slaHours);

        return AddBusinessHours(startUtc, slaHours);
    }

    private static bool ShouldExcludeWeekends(Domain.Entities.TenantSetting? setting, Guid? departmentId)
    {
        if (setting?.SlaWeekendSettingsJson is null) return false;

        try
        {
            var payload = JsonSerializer.Deserialize<SlaWeekendPayload>(setting.SlaWeekendSettingsJson);
            if (payload is null || !payload.ExcludeWeekends) return false;

            if (departmentId.HasValue && payload.ExemptDepartmentIds.Contains(departmentId.Value))
                return false;

            return true;
        }
        catch
        {
            return false;
        }
    }

    private static DateTimeOffset AddBusinessHours(DateTimeOffset start, int hours)
    {
        var current = start;
        var remaining = hours;
        while (remaining > 0)
        {
            current = current.AddHours(1);
            if (current.DayOfWeek != DayOfWeek.Saturday && current.DayOfWeek != DayOfWeek.Sunday)
                remaining--;
        }
        return current;
    }

    private sealed class SlaWeekendPayload
    {
        public bool ExcludeWeekends { get; set; }
        public List<Guid> ExemptDepartmentIds { get; set; } = [];
    }
}

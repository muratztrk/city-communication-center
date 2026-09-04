using System.Text.Json;
using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Application.Common;

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

        return SlaBusinessHours.AddExcludingNonWorkingDays(startUtc, slaHours, excludeWeekends: true, excludePublicHolidays: true);
    }

    private static bool ShouldExcludeWeekends(Domain.Entities.TenantSetting? setting, Guid? departmentId)
    {
        // Varsayılan: hiç kaydedilmemişse hafta sonu SLA ilerlemesi durdurulmuş sayılır (card #2232).
        if (setting?.SlaWeekendSettingsJson is null) return true;

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
            return true;
        }
    }

    private sealed class SlaWeekendPayload
    {
        public bool ExcludeWeekends { get; set; }
        public List<Guid> ExemptDepartmentIds { get; set; } = [];
    }
}

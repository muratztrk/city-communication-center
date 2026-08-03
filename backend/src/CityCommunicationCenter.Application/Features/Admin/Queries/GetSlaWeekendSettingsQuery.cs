using System.Text.Json;
using CityCommunicationCenter.Shared.Contracts;

namespace CityCommunicationCenter.Application.Features.Admin;

public sealed record GetSlaWeekendSettingsQuery(Guid TenantId) : IQuery<SlaWeekendSettingsResponse>;

public sealed class GetSlaWeekendSettingsQueryHandler : IQueryHandler<GetSlaWeekendSettingsQuery, SlaWeekendSettingsResponse>
{
    private readonly IApplicationDbContext _dbContext;

    public GetSlaWeekendSettingsQueryHandler(IApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async ValueTask<SlaWeekendSettingsResponse> Handle(GetSlaWeekendSettingsQuery request, CancellationToken cancellationToken)
    {
        var setting = await _dbContext.TenantSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.TenantId == request.TenantId, cancellationToken);

        // Varsayılan: hiç kaydedilmemişse checkbox işaretli görünür (card #2232).
        if (setting?.SlaWeekendSettingsJson is null)
            return new SlaWeekendSettingsResponse(true, []);

        try
        {
            var payload = JsonSerializer.Deserialize<SlaWeekendPayload>(setting.SlaWeekendSettingsJson);
            return new SlaWeekendSettingsResponse(
                payload?.ExcludeWeekends ?? true,
                payload?.ExemptDepartmentIds ?? []);
        }
        catch
        {
            return new SlaWeekendSettingsResponse(true, []);
        }
    }

    private sealed class SlaWeekendPayload
    {
        public bool ExcludeWeekends { get; set; }
        public List<Guid> ExemptDepartmentIds { get; set; } = [];
    }
}

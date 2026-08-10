using System.Text.Json;
using CityCommunicationCenter.Shared.Contracts;

namespace CityCommunicationCenter.Application.Features.InternalMessages;

public sealed record GetInternalMessagesSettingsQuery : IQuery<InternalMessagesSettingsResponse>;

public sealed class GetInternalMessagesSettingsQueryHandler
    : IQueryHandler<GetInternalMessagesSettingsQuery, InternalMessagesSettingsResponse>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public GetInternalMessagesSettingsQueryHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<InternalMessagesSettingsResponse> Handle(
        GetInternalMessagesSettingsQuery request,
        CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();
        var setting = await _dbContext.TenantSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.TenantId == tenantId, cancellationToken);

        if (setting?.InternalMessagesSettingsJson is null)
        {
            return new InternalMessagesSettingsResponse(false);
        }

        try
        {
            var payload = JsonSerializer.Deserialize<InternalMessagesSettingsPayload>(setting.InternalMessagesSettingsJson);
            return new InternalMessagesSettingsResponse(payload?.ShowUserTitleInMessages ?? false);
        }
        catch (JsonException)
        {
            return new InternalMessagesSettingsResponse(false);
        }
    }

    private sealed class InternalMessagesSettingsPayload
    {
        public bool ShowUserTitleInMessages { get; set; }
    }
}

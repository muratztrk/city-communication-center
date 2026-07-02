namespace CityCommunicationCenter.Application.Features.Admin;

public sealed record GetCitizenAutoReplyTemplatesQuery(Guid TenantId) : IQuery<CitizenAutoReplyTemplatesResponse?>;

public sealed class GetCitizenAutoReplyTemplatesQueryHandler : IQueryHandler<GetCitizenAutoReplyTemplatesQuery, CitizenAutoReplyTemplatesResponse?>
{
    private readonly IApplicationDbContext _dbContext;

    public GetCitizenAutoReplyTemplatesQueryHandler(IApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async ValueTask<CitizenAutoReplyTemplatesResponse?> Handle(GetCitizenAutoReplyTemplatesQuery request, CancellationToken cancellationToken)
    {
        var tenantExists = await _dbContext.Tenants.AnyAsync(entity => entity.TenantId == request.TenantId, cancellationToken);
        if (!tenantExists)
        {
            return null;
        }

        var raw = await _dbContext.TenantSettings
            .Where(entity => entity.TenantId == request.TenantId)
            .Select(entity => entity.CitizenAutoReplyTemplatesJson)
            .FirstOrDefaultAsync(cancellationToken);
        var templates = CitizenAutoReplyTemplateJson.ParseOrDefault(raw);
        return new CitizenAutoReplyTemplatesResponse(
            templates.ProcessingReceived,
            templates.InProgress,
            templates.Completed,
            templates.Cancelled);
    }
}

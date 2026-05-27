namespace CityCommunicationCenter.Application.Features.Admin;

public sealed record UpdateRolePageAccessCommand(Guid TenantId, string? MatrixJson) : ICommand<Unit>;

public sealed class UpdateRolePageAccessCommandHandler : ICommandHandler<UpdateRolePageAccessCommand, Unit>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public UpdateRolePageAccessCommandHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<Unit> Handle(UpdateRolePageAccessCommand request, CancellationToken cancellationToken)
    {
        var actorUserId = _tenantContextAccessor.GetCurrent().UserId;
        var settings = await _dbContext.TenantSettings
            .FirstOrDefaultAsync(entity => entity.TenantId == request.TenantId, cancellationToken);

        if (settings is null)
        {
            settings = new TenantSetting
            {
                TenantSettingId = Guid.NewGuid(),
                TenantId = request.TenantId,
                CreatedByUserId = actorUserId
            };

            _dbContext.TenantSettings.Add(settings);
        }
        else
        {
            settings.UpdatedByUserId = actorUserId;
            settings.UpdatedAtUtc = DateTimeOffset.UtcNow;
        }

        settings.RolePageAccessJson = string.IsNullOrWhiteSpace(request.MatrixJson)
            ? null
            : request.MatrixJson.Trim();

        await _dbContext.SaveChangesAsync(cancellationToken);
        return Unit.Value;
    }
}

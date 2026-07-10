namespace CityCommunicationCenter.Application.Features.Social;

public sealed record DeleteRequestTagCommand(Guid TagId) : ICommand<bool>;

public sealed class DeleteRequestTagCommandHandler : ICommandHandler<DeleteRequestTagCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public DeleteRequestTagCommandHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<bool> Handle(DeleteRequestTagCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();

        var canManage = Enum.TryParse<RoleCode>(context.RoleCode, true, out var roleCode)
            && roleCode is RoleCode.Operator or RoleCode.SystemAdmin;
        if (!canManage)
        {
            throw new ForbiddenAccessException("Talep etiketi yalnızca Vatandaş Talep Operatörü veya Sistem Yöneticisi silebilir.");
        }

        var tag = await _dbContext.RequestTags
            .FirstOrDefaultAsync(entity => entity.TagId == request.TagId && entity.TenantId == tenantId, cancellationToken);
        if (tag is null) return false;

        _dbContext.RequestTags.Remove(tag);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }
}

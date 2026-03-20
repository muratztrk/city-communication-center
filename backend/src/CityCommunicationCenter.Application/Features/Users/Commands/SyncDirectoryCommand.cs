
namespace CityCommunicationCenter.Application.Features.Users;

public sealed record SyncDirectoryCommand() : ICommand<string>;

public sealed class SyncDirectoryCommandHandler : IRequestHandler<SyncDirectoryCommand, string>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public SyncDirectoryCommandHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async Task<string> Handle(SyncDirectoryCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();

        _dbContext.AuditLogs.Add(new AuditLog
        {
            AuditLogId = Guid.NewGuid(),
            TenantId = context.TenantId!.Value,
            EntityType = "DirectorySync",
            EntityId = context.TenantId.Value.ToString(),
            Action = "DirectorySyncRequested",
            ActorUserId = context.UserId,
            Details = "AD/LDAP senkronizasyon istegi kuyruğa alindi."
        });
        await _dbContext.SaveChangesAsync(cancellationToken);

        return "Directory synchronization request recorded.";
    }
}
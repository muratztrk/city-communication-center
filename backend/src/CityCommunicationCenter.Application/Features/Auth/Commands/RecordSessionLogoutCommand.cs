namespace CityCommunicationCenter.Application.Features.Auth;

public sealed record RecordSessionLogoutCommand(Guid UserId, Guid TenantId) : ICommand<Unit>;

public sealed class RecordSessionLogoutCommandHandler : ICommandHandler<RecordSessionLogoutCommand, Unit>
{
    private readonly IApplicationDbContext _dbContext;

    public RecordSessionLogoutCommandHandler(IApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async ValueTask<Unit> Handle(RecordSessionLogoutCommand request, CancellationToken cancellationToken)
    {
        var entity = await _dbContext.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(user => user.UserId == request.UserId && user.TenantId == request.TenantId, cancellationToken);
        if (entity is null)
        {
            return Unit.Value;
        }

        var departmentName = await _dbContext.Departments
            .Where(department => department.DepartmentId == entity.DepartmentId && department.TenantId == entity.TenantId)
            .Select(department => department.Name)
            .FirstOrDefaultAsync(cancellationToken);

        _dbContext.AuditLogs.Add(new AuditLog
        {
            AuditLogId = Guid.NewGuid(),
            TenantId = entity.TenantId,
            EntityType = nameof(ApplicationUser),
            EntityId = entity.UserId.ToString(),
            Action = "Logout",
            ActorUserId = entity.UserId,
            ActorDisplayName = entity.DisplayName,
            DepartmentName = departmentName,
            EventTimeUtc = DateTimeOffset.UtcNow,
            Details = $"Username={entity.Username}",
        });
        await _dbContext.SaveChangesAsync(cancellationToken);
        return Unit.Value;
    }
}

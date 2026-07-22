namespace CityCommunicationCenter.Application.Features.Users;

public sealed record DeleteUnusedLdapUsersCommand() : ICommand<DeleteUnusedLdapUsersResult>;

public sealed record DeleteUnusedLdapUsersResult(int DeletedCount, string Message);

public sealed class DeleteUnusedLdapUsersCommandHandler
    : ICommandHandler<DeleteUnusedLdapUsersCommand, DeleteUnusedLdapUsersResult>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public DeleteUnusedLdapUsersCommandHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<DeleteUnusedLdapUsersResult> Handle(
        DeleteUnusedLdapUsersCommand request,
        CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        var currentUserId = context.UserId;

        // Talep oluşturmamış LDAP kullanıcıları (card #1790). Görev oluşturanlar da silinmez (#1753).
        var ldapUsers = await _dbContext.Users
            .Where(user => user.TenantId == tenantId
                && user.UserSource == UserSource.Ldap
                && user.RoleCode != RoleCode.SystemAdmin
                && (!currentUserId.HasValue || user.UserId != currentUserId.Value))
            .ToListAsync(cancellationToken);

        var deletable = new List<ApplicationUser>();
        foreach (var user in ldapUsers)
        {
            var hasCreatedJobs = await _dbContext.Jobs
                .AnyAsync(job => job.TenantId == tenantId && job.CreatedByUserId == user.UserId, cancellationToken);
            if (hasCreatedJobs)
            {
                continue;
            }

            var hasCreatedTasks = await _dbContext.Tasks
                .AnyAsync(task => task.TenantId == tenantId && task.CreatedByUserId == user.UserId, cancellationToken);
            if (hasCreatedTasks)
            {
                continue;
            }

            deletable.Add(user);
        }

        if (deletable.Count == 0)
        {
            return new DeleteUnusedLdapUsersResult(0, "Silinecek LDAP kullanıcısı bulunamadı.");
        }

        var deletableIds = deletable.Select(user => user.UserId).ToArray();

        await _dbContext.Tasks
            .Where(task => task.TenantId == tenantId && task.AssignedUserId.HasValue && deletableIds.Contains(task.AssignedUserId.Value))
            .ExecuteUpdateAsync(
                setters => setters.SetProperty(task => task.AssignedUserId, (Guid?)null),
                cancellationToken);

        await _dbContext.UserDepartmentAssignments
            .Where(assignment => assignment.TenantId == tenantId && deletableIds.Contains(assignment.UserId))
            .ExecuteDeleteAsync(cancellationToken);

        foreach (var user in deletable)
        {
            _dbContext.AuditLogs.Add(new AuditLog
            {
                AuditLogId = Guid.NewGuid(),
                TenantId = tenantId,
                EntityType = nameof(ApplicationUser),
                EntityId = user.UserId.ToString(),
                Action = "UnusedLdapUserDeleted",
                ActorUserId = currentUserId,
                Details = $"Talep oluşturmamış LDAP kullanıcısı silindi: '{user.DisplayName}'.",
            });
            _dbContext.Users.Remove(user);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        return new DeleteUnusedLdapUsersResult(
            deletable.Count,
            $"{deletable.Count} LDAP kullanıcısı silindi.");
    }
}

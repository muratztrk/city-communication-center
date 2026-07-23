namespace CityCommunicationCenter.Application.Features.Departments;

public sealed record DeleteUnusedLdapDepartmentsCommand() : ICommand<DeleteUnusedLdapDepartmentsResult>;

public sealed record DeleteUnusedLdapDepartmentsResult(int DeletedCount, string Message);

/// <summary>
/// LDAP kaynaklı (<c>SourceType=Ldap</c>) ve hiç kullanıcısı/talep sahipliği olmayan birimleri
/// toplu siler (cards #1853/#1855). Güvenlik kuralları <see cref="DeleteDepartmentCommand"/> ile
/// aynıdır: kullanıcısı (doğrudan atanmış veya ek birim ataması) veya sahip olduğu talep (Job)
/// varsa silinmez; diğer referanslar (Task/SocialMessage atamaları, routing kuralları, atama
/// geçmişi, JobDepartment bağlantıları, alt birim üst birim referansı) sıfırlanarak/silinerek
/// FK kısıtları aşılır.
/// </summary>
public sealed class DeleteUnusedLdapDepartmentsCommandHandler
    : ICommandHandler<DeleteUnusedLdapDepartmentsCommand, DeleteUnusedLdapDepartmentsResult>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public DeleteUnusedLdapDepartmentsCommandHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<DeleteUnusedLdapDepartmentsResult> Handle(
        DeleteUnusedLdapDepartmentsCommand request,
        CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();

        var ldapDepartments = await _dbContext.Departments
            .Where(department => department.TenantId == tenantId && department.SourceType == "Ldap")
            .ToListAsync(cancellationToken);

        var deletable = new List<Department>();
        foreach (var department in ldapDepartments)
        {
            var hasUsers = await _dbContext.Users
                .AnyAsync(user => user.TenantId == tenantId && user.DepartmentId == department.DepartmentId, cancellationToken);
            if (hasUsers)
            {
                continue;
            }

            var hasAdditionalUserAssignments = await _dbContext.UserDepartmentAssignments
                .AnyAsync(assignment => assignment.TenantId == tenantId && assignment.DepartmentId == department.DepartmentId, cancellationToken);
            if (hasAdditionalUserAssignments)
            {
                continue;
            }

            var hasJobs = await _dbContext.Jobs
                .AnyAsync(job => job.TenantId == tenantId && job.OwnerDepartmentId == department.DepartmentId, cancellationToken);
            if (hasJobs)
            {
                continue;
            }

            deletable.Add(department);
        }

        if (deletable.Count == 0)
        {
            return new DeleteUnusedLdapDepartmentsResult(0, "Silinecek LDAP birimi bulunamadı.");
        }

        var deletableIds = deletable.Select(department => department.DepartmentId).ToArray();

        await _dbContext.Tasks
            .Where(task => task.TenantId == tenantId && task.AssignedDepartmentId.HasValue && deletableIds.Contains(task.AssignedDepartmentId.Value))
            .ExecuteUpdateAsync(
                setters => setters.SetProperty(task => task.AssignedDepartmentId, (Guid?)null),
                cancellationToken);

        await _dbContext.SocialMessages
            .Where(message => message.TenantId == tenantId && message.AssignedDepartmentId.HasValue && deletableIds.Contains(message.AssignedDepartmentId.Value))
            .ExecuteUpdateAsync(
                setters => setters.SetProperty(message => message.AssignedDepartmentId, (Guid?)null),
                cancellationToken);

        await _dbContext.RoutingRules
            .Where(rule => rule.TenantId == tenantId && deletableIds.Contains(rule.TargetDepartmentId))
            .ExecuteDeleteAsync(cancellationToken);

        await _dbContext.AssignmentHistories
            .Where(history => history.FromDepartmentId.HasValue && deletableIds.Contains(history.FromDepartmentId.Value))
            .ExecuteUpdateAsync(
                setters => setters.SetProperty(history => history.FromDepartmentId, (Guid?)null),
                cancellationToken);

        await _dbContext.AssignmentHistories
            .Where(history => history.ToDepartmentId.HasValue && deletableIds.Contains(history.ToDepartmentId.Value))
            .ExecuteUpdateAsync(
                setters => setters.SetProperty(history => history.ToDepartmentId, (Guid?)null),
                cancellationToken);

        await _dbContext.JobDepartments
            .Where(link => deletableIds.Contains(link.DepartmentId))
            .ExecuteDeleteAsync(cancellationToken);

        await _dbContext.Departments
            .Where(department => department.TenantId == tenantId && department.ParentDepartmentId.HasValue && deletableIds.Contains(department.ParentDepartmentId.Value))
            .ExecuteUpdateAsync(
                setters => setters.SetProperty(department => department.ParentDepartmentId, (Guid?)null),
                cancellationToken);

        foreach (var department in deletable)
        {
            _dbContext.AuditLogs.Add(new AuditLog
            {
                AuditLogId = Guid.NewGuid(),
                TenantId = tenantId,
                EntityType = nameof(Department),
                EntityId = department.DepartmentId.ToString(),
                Action = "UnusedLdapDepartmentDeleted",
                ActorUserId = context.UserId,
                Details = $"Kullanıcısı ve talebi olmayan LDAP birimi silindi: '{department.Name}'.",
            });
            _dbContext.Departments.Remove(department);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        return new DeleteUnusedLdapDepartmentsResult(
            deletable.Count,
            $"{deletable.Count} LDAP birimi silindi.");
    }
}

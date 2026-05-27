using Microsoft.Extensions.Localization;

namespace CityCommunicationCenter.Application.Features.Departments;

public sealed record DeleteDepartmentCommand(Guid DepartmentId) : ICommand<Unit>;

public sealed class DeleteDepartmentCommandValidator : AbstractValidator<DeleteDepartmentCommand>
{
    public DeleteDepartmentCommandValidator(IStringLocalizer<ApplicationResource> localizer)
    {
        RuleFor(command => command.DepartmentId)
            .NotEmpty()
            .WithMessage(localizer["ValidationDepartmentIdRequired"]);
    }
}

public sealed class DeleteDepartmentCommandHandler : ICommandHandler<DeleteDepartmentCommand, Unit>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;
    private readonly IStringLocalizer<ApplicationResource> _localizer;

    public DeleteDepartmentCommandHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor,
        IStringLocalizer<ApplicationResource> localizer)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
        _localizer = localizer;
    }

    public async ValueTask<Unit> Handle(DeleteDepartmentCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();

        var entity = await _dbContext.Departments
            .FirstOrDefaultAsync(
                d => d.DepartmentId == request.DepartmentId && d.TenantId == tenantId,
                cancellationToken);

        if (entity is null)
        {
            throw new ValidationException(_localizer["ValidationDepartmentNotFound"]);
        }

        // Check if users are assigned to this department
        var hasUsers = await _dbContext.Users
            .AnyAsync(
                u => u.DepartmentId == request.DepartmentId && u.TenantId == tenantId,
                cancellationToken);
        var hasAdditionalUserAssignments = await _dbContext.UserDepartmentAssignments
            .AnyAsync(
                assignment => assignment.DepartmentId == request.DepartmentId && assignment.TenantId == tenantId,
                cancellationToken);

        if (hasUsers || hasAdditionalUserAssignments)
        {
            throw new ValidationException(_localizer["ValidationDepartmentHasUsers"]);
        }

        // Nullify references in tasks
        await _dbContext.Tasks
            .Where(t => t.TenantId == tenantId && t.AssignedDepartmentId == request.DepartmentId)
            .ExecuteUpdateAsync(
                s => s.SetProperty(t => t.AssignedDepartmentId, (Guid?)null),
                cancellationToken);

        // Nullify references in social messages
        await _dbContext.SocialMessages
            .Where(m => m.TenantId == tenantId && m.AssignedDepartmentId == request.DepartmentId)
            .ExecuteUpdateAsync(
                s => s.SetProperty(m => m.AssignedDepartmentId, (Guid?)null),
                cancellationToken);

        // Remove routing rules targeting this department
        await _dbContext.RoutingRules
            .Where(r => r.TenantId == tenantId && r.TargetDepartmentId == request.DepartmentId)
            .ExecuteDeleteAsync(cancellationToken);

        // Nullify references in assignment history
        await _dbContext.AssignmentHistories
            .Where(h => h.TenantId == tenantId && h.FromDepartmentId == request.DepartmentId)
            .ExecuteUpdateAsync(
                s => s.SetProperty(h => h.FromDepartmentId, (Guid?)null),
                cancellationToken);

        await _dbContext.AssignmentHistories
            .Where(h => h.TenantId == tenantId && h.ToDepartmentId == request.DepartmentId)
            .ExecuteUpdateAsync(
                s => s.SetProperty(h => h.ToDepartmentId, (Guid?)null),
                cancellationToken);

        // Remove job_department entries for this department (Restrict FK on jobdepartments)
        await _dbContext.JobDepartments
            .Where(jd => jd.DepartmentId == request.DepartmentId)
            .ExecuteDeleteAsync(cancellationToken);

        // Block deletion if department owns any jobs
        var hasJobs = await _dbContext.Jobs
            .AnyAsync(j => j.TenantId == tenantId && j.OwnerDepartmentId == request.DepartmentId,
                cancellationToken);

        if (hasJobs)
        {
            throw new ValidationException(_localizer["ValidationDepartmentHasJobs"]);
        }

        // Nullify child department parent references
        await _dbContext.Departments
            .Where(d => d.TenantId == tenantId && d.ParentDepartmentId == request.DepartmentId)
            .ExecuteUpdateAsync(
                s => s.SetProperty(d => d.ParentDepartmentId, (Guid?)null),
                cancellationToken);

        _dbContext.AuditLogs.Add(new AuditLog
        {
            AuditLogId = Guid.NewGuid(),
            TenantId = tenantId,
            EntityType = nameof(Department),
            EntityId = entity.DepartmentId.ToString(),
            Action = "DepartmentDeleted",
            ActorUserId = context.UserId,
            Details = $"Department '{entity.Name}' deleted."
        });

        _dbContext.Departments.Remove(entity);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return Unit.Value;
    }
}

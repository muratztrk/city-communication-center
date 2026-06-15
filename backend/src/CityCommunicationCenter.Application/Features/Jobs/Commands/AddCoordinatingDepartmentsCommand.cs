using CityCommunicationCenter.Application.Abstractions;

namespace CityCommunicationCenter.Application.Features.Jobs;

public sealed record AddCoordinatingDepartmentsCommand(
    Guid JobId,
    Guid? ActorUserId,
    IReadOnlyCollection<Guid> DepartmentIds) : ICommand<bool>;

public sealed class AddCoordinatingDepartmentsCommandValidator : AbstractValidator<AddCoordinatingDepartmentsCommand>
{
    public AddCoordinatingDepartmentsCommandValidator()
    {
        RuleFor(command => command.DepartmentIds)
            .NotEmpty()
            .WithMessage("En az bir koordine birim secilmelidir.");
    }
}

public sealed class AddCoordinatingDepartmentsCommandHandler
    : ICommandHandler<AddCoordinatingDepartmentsCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public AddCoordinatingDepartmentsCommandHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<bool> Handle(
        AddCoordinatingDepartmentsCommand request,
        CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        var actor = await JobWorkflowAuthorization.RequireActorAsync(
            _dbContext, request.ActorUserId, tenantId, cancellationToken);

        var job = await _dbContext.Jobs.FirstOrDefaultAsync(
            item => item.JobId == request.JobId && item.TenantId == tenantId,
            cancellationToken);
        if (job is null)
        {
            return false;
        }

        var existingDepartmentIds = await _dbContext.JobDepartments
            .Where(item => item.JobId == job.JobId && item.TenantId == tenantId)
            .Select(item => item.DepartmentId)
            .ToArrayAsync(cancellationToken);

        if (actor.RoleCode == RoleCode.Manager)
        {
            var canManageRequest = existingDepartmentIds.Contains(actor.DepartmentId)
                || await _dbContext.Departments.AnyAsync(
                    department => department.TenantId == tenantId
                        && existingDepartmentIds.Contains(department.DepartmentId)
                        && (department.ManagerUserId == actor.UserId
                            || department.DeputyManagerUserId == actor.UserId),
                    cancellationToken);
            if (!canManageRequest)
            {
                throw new ForbiddenAccessException("Bu talebe koordine birim ekleme yetkiniz yok.");
            }
        }
        else if (actor.RoleCode is not (RoleCode.Reporter or RoleCode.SystemAdmin))
        {
            throw new ForbiddenAccessException("Bu talebe koordine birim ekleme yetkiniz yok.");
        }

        var requestedDepartmentIds = request.DepartmentIds
            .Where(departmentId => departmentId != Guid.Empty
                && !existingDepartmentIds.Contains(departmentId))
            .Distinct()
            .ToArray();
        if (requestedDepartmentIds.Length == 0)
        {
            throw Validation(nameof(request.DepartmentIds), "Secilen birimler talebe zaten eklenmis.");
        }

        var departments = await _dbContext.Departments
            .Where(department => department.TenantId == tenantId
                && requestedDepartmentIds.Contains(department.DepartmentId))
            .ToArrayAsync(cancellationToken);
        if (departments.Length != requestedDepartmentIds.Length)
        {
            throw Validation(nameof(request.DepartmentIds), "Secilen birimlerden biri bulunamadi.");
        }

        var utcNow = DateTimeOffset.UtcNow;
        foreach (var department in departments)
        {
            _dbContext.JobDepartments.Add(new JobDepartment
            {
                JobDepartmentId = Guid.NewGuid(),
                TenantId = tenantId,
                JobId = job.JobId,
                DepartmentId = department.DepartmentId,
                Role = JobDepartmentRole.Coordinating,
                ApprovalStatus = JobApprovalStatus.NotRequired,
                RequestedByUserId = actor.UserId,
                RequestedAtUtc = utcNow,
                CreatedByUserId = actor.UserId
            });
        }

        job.IsCoordinated = true;
        job.UpdatedAtUtc = utcNow;
        job.UpdatedByUserId = actor.UserId;

        var departmentNames = string.Join(", ", departments.Select(department => department.Name));
        _dbContext.AuditLogs.Add(new AuditLog
        {
            AuditLogId = Guid.NewGuid(),
            TenantId = tenantId,
            EntityType = nameof(Job),
            EntityId = job.JobId.ToString(),
            Action = "CoordinatingDepartmentsAdded",
            ActorUserId = actor.UserId,
            ActorDisplayName = actor.DisplayName,
            StatusAtEvent = job.Status.ToString(),
            Notes = $"Koordine birimler eklendi: {departmentNames}",
            Details = $"DepartmentIds={string.Join(",", requestedDepartmentIds)}"
        });

        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    private static ValidationException Validation(string propertyName, string message) =>
        new([new FluentValidation.Results.ValidationFailure(propertyName, message)]);
}

using Microsoft.Extensions.Localization;

namespace CityCommunicationCenter.Application.Features.Departments;

public sealed record UpdateDepartmentCommand(
    Guid? ActorUserId,
    Guid DepartmentId,
    string Name,
    string DepartmentType,
    Guid? ManagerUserId,
    Guid? DeputyManagerUserId,
    IReadOnlyCollection<Guid>? ResponsibleUserIds) : ICommand<DepartmentResponse>;

public sealed class UpdateDepartmentCommandValidator : AbstractValidator<UpdateDepartmentCommand>
{
    public UpdateDepartmentCommandValidator(IStringLocalizer<ApplicationResource> localizer)
    {
        RuleFor(command => command.DepartmentId)
            .NotEmpty()
            .WithMessage(localizer["ValidationDepartmentIdRequired"]);

        RuleFor(command => command.Name)
            .NotEmpty()
            .MaximumLength(200)
            .WithMessage(localizer["ValidationDepartmentNameRequired"]);

        RuleFor(command => command.DepartmentType)
            .NotEmpty()
            .MaximumLength(100);
    }
}

public sealed class UpdateDepartmentCommandHandler : ICommandHandler<UpdateDepartmentCommand, DepartmentResponse>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;
    private readonly IStringLocalizer<ApplicationResource> _localizer;

    public UpdateDepartmentCommandHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor,
        IStringLocalizer<ApplicationResource> localizer)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
        _localizer = localizer;
    }

    public async ValueTask<DepartmentResponse> Handle(UpdateDepartmentCommand request, CancellationToken cancellationToken)
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

        var actor = context.UserId.HasValue
            ? await _dbContext.Users.AsNoTracking().FirstOrDefaultAsync(
                user => user.UserId == context.UserId.Value && user.TenantId == tenantId && user.IsActive,
                cancellationToken)
            : null;

        if (actor is null || (actor.RoleCode != RoleCode.SystemAdmin && entity.ManagerUserId != actor.UserId))
        {
            throw new ForbiddenAccessException("Müdürlük kaydını sadece o müdürlüğün müdürü güncelleyebilir.");
        }

        await EnsureDepartmentUsersAsync(
            tenantId,
            request.DepartmentId,
            request.ManagerUserId,
            request.DeputyManagerUserId,
            request.ResponsibleUserIds,
            cancellationToken);

        var isLdapSourced = string.Equals(entity.SourceType, "Ldap", StringComparison.OrdinalIgnoreCase);
        var oldName = entity.Name;
        if (!isLdapSourced)
        {
            entity.Name = request.Name.Trim();
            entity.DepartmentType = request.DepartmentType.Trim();
        }

        entity.ManagerUserId = request.ManagerUserId;
        entity.DeputyManagerUserId = request.DeputyManagerUserId;
        entity.ResponsibleUserIdsJson = DepartmentResponseFactory.SerializeResponsibleUserIds(request.ResponsibleUserIds);
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;
        entity.UpdatedByUserId = context.UserId;

        _dbContext.AuditLogs.Add(new AuditLog
        {
            AuditLogId = Guid.NewGuid(),
            TenantId = tenantId,
            EntityType = nameof(Department),
            EntityId = entity.DepartmentId.ToString(),
            Action = "DepartmentUpdated",
            ActorUserId = context.UserId,
            Details = $"Department '{oldName}' updated to '{entity.Name}'."
        });

        await _dbContext.SaveChangesAsync(cancellationToken);

        return DepartmentResponseFactory.Create(entity);
    }

    private async Task EnsureDepartmentUsersAsync(
        Guid tenantId,
        Guid departmentId,
        Guid? managerUserId,
        Guid? deputyManagerUserId,
        IReadOnlyCollection<Guid>? responsibleUserIds,
        CancellationToken cancellationToken)
    {
        var selectedUserIds = new[] { managerUserId, deputyManagerUserId }
            .Where(id => id.HasValue)
            .Select(id => id!.Value)
            .Concat(responsibleUserIds ?? [])
            .Where(id => id != Guid.Empty)
            .Distinct()
            .ToArray();

        if (selectedUserIds.Length == 0)
        {
            return;
        }

        var validUserCount = await _dbContext.Users.CountAsync(
            user => user.TenantId == tenantId
                && user.IsActive
                && selectedUserIds.Contains(user.UserId)
                && (user.DepartmentId == departmentId
                    || _dbContext.UserDepartmentAssignments.Any(assignment =>
                        assignment.TenantId == tenantId
                        && assignment.UserId == user.UserId
                        && assignment.DepartmentId == departmentId)
                    || user.UserId == managerUserId
                    || user.UserId == deputyManagerUserId),
            cancellationToken);

        if (validUserCount != selectedUserIds.Length)
        {
            throw new ValidationException("Seçilen müdür, vekil müdür ve sorumlular bu müdürlükte görev yapabilen aktif kullanıcılardan olmalıdır.");
        }
    }
}

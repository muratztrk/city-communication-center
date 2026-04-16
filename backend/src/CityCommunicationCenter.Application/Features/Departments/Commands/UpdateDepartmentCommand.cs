using Microsoft.Extensions.Localization;

namespace CityCommunicationCenter.Application.Features.Departments;

public sealed record UpdateDepartmentCommand(
    Guid DepartmentId,
    string Name,
    string DepartmentType) : ICommand<DepartmentResponse>;

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

public sealed class UpdateDepartmentCommandHandler : IRequestHandler<UpdateDepartmentCommand, DepartmentResponse>
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

    public async Task<DepartmentResponse> Handle(UpdateDepartmentCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.TenantId!.Value;

        var entity = await _dbContext.Departments
            .FirstOrDefaultAsync(
                d => d.DepartmentId == request.DepartmentId && d.TenantId == tenantId,
                cancellationToken);

        if (entity is null)
        {
            throw new ValidationException(_localizer["ValidationDepartmentNotFound"]);
        }

        var oldName = entity.Name;
        entity.Name = request.Name.Trim();
        entity.DepartmentType = request.DepartmentType.Trim();
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

        return new DepartmentResponse(
            entity.DepartmentId,
            entity.TenantId,
            entity.Name,
            entity.DepartmentType,
            entity.ParentDepartmentId,
            entity.ManagerUserId);
    }
}

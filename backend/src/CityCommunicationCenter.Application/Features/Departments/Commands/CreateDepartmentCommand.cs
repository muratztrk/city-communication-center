

namespace CityCommunicationCenter.Application.Features.Departments;

public sealed record CreateDepartmentCommand(
    Guid TenantId,
    Guid? ActorUserId,
    string Name,
    string DepartmentType,
    Guid? ParentDepartmentId,
    Guid? ManagerUserId,
    Guid? DeputyManagerUserId,
    IReadOnlyCollection<Guid>? ResponsibleUserIds,
    string? SourceType = null) : ICommand<DepartmentResponse>;

public sealed class CreateDepartmentCommandValidator : AbstractValidator<CreateDepartmentCommand>
{
    public CreateDepartmentCommandValidator()
    {
        RuleFor(command => command.TenantId).NotEmpty();
        RuleFor(command => command.Name).NotEmpty().MaximumLength(200);
        RuleFor(command => command.DepartmentType).NotEmpty().MaximumLength(100);
    }
}

public sealed class CreateDepartmentCommandHandler : ICommandHandler<CreateDepartmentCommand, DepartmentResponse>
{
    private readonly IApplicationDbContext _dbContext;

    public CreateDepartmentCommandHandler(IApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async ValueTask<DepartmentResponse> Handle(CreateDepartmentCommand request, CancellationToken cancellationToken)
    {
        var entity = new Department
        {
            DepartmentId = Guid.NewGuid(),
            TenantId = request.TenantId,
            Name = request.Name.Trim(),
            DepartmentType = request.DepartmentType.Trim(),
            SourceType = NormalizeSourceType(request.SourceType),
            ParentDepartmentId = request.ParentDepartmentId,
            ManagerUserId = request.ManagerUserId,
            DeputyManagerUserId = request.DeputyManagerUserId,
            ResponsibleUserIdsJson = DepartmentResponseFactory.SerializeResponsibleUserIds(request.ResponsibleUserIds),
            CreatedByUserId = request.ActorUserId
        };

        _dbContext.Departments.Add(entity);
        _dbContext.AuditLogs.Add(new AuditLog
        {
            AuditLogId = Guid.NewGuid(),
            TenantId = request.TenantId,
            EntityType = nameof(Department),
            EntityId = entity.DepartmentId.ToString(),
            Action = "DepartmentCreated",
            ActorUserId = request.ActorUserId,
            Details = $"Department '{entity.Name}' created."
        });
        await _dbContext.SaveChangesAsync(cancellationToken);

        return DepartmentResponseFactory.Create(entity);
    }

    private static string NormalizeSourceType(string? sourceType)
    {
        if (string.Equals(sourceType, "Ldap", StringComparison.OrdinalIgnoreCase))
        {
            return "Ldap";
        }

        return "Manual";
    }
}

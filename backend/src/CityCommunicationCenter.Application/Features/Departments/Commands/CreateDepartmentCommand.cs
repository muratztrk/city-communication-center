

namespace CityCommunicationCenter.Application.Features.Departments;

public sealed record CreateDepartmentCommand(
    Guid TenantId,
    Guid? ActorUserId,
    string Name,
    string DepartmentType,
    Guid? ParentDepartmentId,
    Guid? ManagerUserId) : ICommand<DepartmentResponse>;

public sealed class CreateDepartmentCommandValidator : AbstractValidator<CreateDepartmentCommand>
{
    public CreateDepartmentCommandValidator()
    {
        RuleFor(command => command.TenantId).NotEmpty();
        RuleFor(command => command.Name).NotEmpty().MaximumLength(200);
        RuleFor(command => command.DepartmentType).NotEmpty().MaximumLength(100);
    }
}

public sealed class CreateDepartmentCommandHandler : IRequestHandler<CreateDepartmentCommand, DepartmentResponse>
{
    private readonly IApplicationDbContext _dbContext;

    public CreateDepartmentCommandHandler(IApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<DepartmentResponse> Handle(CreateDepartmentCommand request, CancellationToken cancellationToken)
    {
        var entity = new Department
        {
            DepartmentId = Guid.NewGuid(),
            TenantId = request.TenantId,
            Name = request.Name.Trim(),
            DepartmentType = request.DepartmentType.Trim(),
            ParentDepartmentId = request.ParentDepartmentId,
            ManagerUserId = request.ManagerUserId,
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

        return new DepartmentResponse(
            entity.DepartmentId,
            entity.TenantId,
            entity.Name,
            entity.DepartmentType,
            entity.ParentDepartmentId,
            entity.ManagerUserId);
    }
}
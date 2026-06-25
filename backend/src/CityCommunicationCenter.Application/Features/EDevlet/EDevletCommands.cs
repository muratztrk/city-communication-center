namespace CityCommunicationCenter.Application.Features.EDevlet;

public sealed record GetEDevletActivityTypesQuery() : IQuery<IReadOnlyList<EDevletActivityTypeResponse>>;

public sealed class GetEDevletActivityTypesQueryHandler : IQueryHandler<GetEDevletActivityTypesQuery, IReadOnlyList<EDevletActivityTypeResponse>>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public GetEDevletActivityTypesQueryHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<IReadOnlyList<EDevletActivityTypeResponse>> Handle(GetEDevletActivityTypesQuery request, CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();
        return await _dbContext.EDevletActivityTypes
            .AsNoTracking()
            .Where(entity => entity.TenantId == tenantId)
            .OrderBy(entity => entity.SortOrder)
            .ThenBy(entity => entity.Name)
            .Select(entity => new EDevletActivityTypeResponse(entity.ActivityTypeId, entity.Name, entity.SortOrder))
            .ToListAsync(cancellationToken);
    }
}

public sealed record CreateEDevletActivityTypeCommand(string Name) : ICommand<EDevletActivityTypeResponse>;

public sealed class CreateEDevletActivityTypeCommandValidator : AbstractValidator<CreateEDevletActivityTypeCommand>
{
    public CreateEDevletActivityTypeCommandValidator()
    {
        RuleFor(c => c.Name).NotEmpty().WithMessage("Faaliyet tipi adi zorunludur.");
    }
}

public sealed class CreateEDevletActivityTypeCommandHandler : ICommandHandler<CreateEDevletActivityTypeCommand, EDevletActivityTypeResponse>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public CreateEDevletActivityTypeCommandHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<EDevletActivityTypeResponse> Handle(CreateEDevletActivityTypeCommand request, CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();
        var maxSort = await _dbContext.EDevletActivityTypes
            .Where(entity => entity.TenantId == tenantId)
            .MaxAsync(entity => (int?)entity.SortOrder, cancellationToken) ?? 0;
        var entity = new EDevletActivityType
        {
            ActivityTypeId = Guid.NewGuid(),
            TenantId = tenantId,
            Name = request.Name.Trim(),
            SortOrder = maxSort + 1,
        };
        _dbContext.EDevletActivityTypes.Add(entity);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return new EDevletActivityTypeResponse(entity.ActivityTypeId, entity.Name, entity.SortOrder);
    }
}

public sealed record UpdateEDevletActivityTypeCommand(Guid ActivityTypeId, string Name) : ICommand<bool>;

public sealed class UpdateEDevletActivityTypeCommandValidator : AbstractValidator<UpdateEDevletActivityTypeCommand>
{
    public UpdateEDevletActivityTypeCommandValidator()
    {
        RuleFor(c => c.Name).NotEmpty().WithMessage("Faaliyet tipi adi zorunludur.");
    }
}

public sealed class UpdateEDevletActivityTypeCommandHandler : ICommandHandler<UpdateEDevletActivityTypeCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public UpdateEDevletActivityTypeCommandHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<bool> Handle(UpdateEDevletActivityTypeCommand request, CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();
        var entity = await _dbContext.EDevletActivityTypes
            .FirstOrDefaultAsync(e => e.ActivityTypeId == request.ActivityTypeId && e.TenantId == tenantId, cancellationToken);
        if (entity is null) return false;
        entity.Name = request.Name.Trim();
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }
}

public sealed record DeleteEDevletActivityTypeCommand(Guid ActivityTypeId) : ICommand<bool>;

public sealed class DeleteEDevletActivityTypeCommandHandler : ICommandHandler<DeleteEDevletActivityTypeCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public DeleteEDevletActivityTypeCommandHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<bool> Handle(DeleteEDevletActivityTypeCommand request, CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();
        var entity = await _dbContext.EDevletActivityTypes
            .FirstOrDefaultAsync(e => e.ActivityTypeId == request.ActivityTypeId && e.TenantId == tenantId, cancellationToken);
        if (entity is null) return false;
        var inUse = await _dbContext.EDevletDailyActivityPlans
            .AnyAsync(plan => plan.ActivityTypeId == request.ActivityTypeId && plan.TenantId == tenantId, cancellationToken);
        if (inUse)
        {
            throw new ValidationException([
                new FluentValidation.Results.ValidationFailure(nameof(request.ActivityTypeId), "Kullanımda olan faaliyet tipi silinemez.")
            ]);
        }
        _dbContext.EDevletActivityTypes.Remove(entity);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }
}

public sealed record CreateEDevletDailyActivityPlanCommand(
    Guid ActivityTypeId,
    string Description,
    string? Neighborhood,
    string? Street,
    string? OpenAddress) : ICommand<EDevletDailyActivityPlanResponse>;

public sealed class CreateEDevletDailyActivityPlanCommandValidator : AbstractValidator<CreateEDevletDailyActivityPlanCommand>
{
    public CreateEDevletDailyActivityPlanCommandValidator()
    {
        RuleFor(c => c.ActivityTypeId).NotEmpty().WithMessage("Faaliyet tipi secilmelidir.");
        RuleFor(c => c.Description).NotEmpty().WithMessage("Aciklama zorunludur.");
    }
}

public sealed class CreateEDevletDailyActivityPlanCommandHandler : ICommandHandler<CreateEDevletDailyActivityPlanCommand, EDevletDailyActivityPlanResponse>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public CreateEDevletDailyActivityPlanCommandHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<EDevletDailyActivityPlanResponse> Handle(CreateEDevletDailyActivityPlanCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        var activityType = await _dbContext.EDevletActivityTypes
            .AsNoTracking()
            .FirstOrDefaultAsync(entity => entity.ActivityTypeId == request.ActivityTypeId && entity.TenantId == tenantId, cancellationToken)
            ?? throw ValidationExceptionFactory.Field(nameof(request.ActivityTypeId), "Faaliyet tipi bulunamadi.");

        var plan = new EDevletDailyActivityPlan
        {
            PlanId = Guid.NewGuid(),
            TenantId = tenantId,
            ActivityTypeId = request.ActivityTypeId,
            Description = request.Description.Trim(),
            Neighborhood = string.IsNullOrWhiteSpace(request.Neighborhood) ? null : request.Neighborhood.Trim(),
            Street = string.IsNullOrWhiteSpace(request.Street) ? null : request.Street.Trim(),
            OpenAddress = string.IsNullOrWhiteSpace(request.OpenAddress) ? null : request.OpenAddress.Trim(),
            CreatedByUserId = context.UserId,
        };
        _dbContext.EDevletDailyActivityPlans.Add(plan);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return new EDevletDailyActivityPlanResponse(
            plan.PlanId,
            plan.ActivityTypeId,
            activityType.Name,
            plan.Description,
            plan.Neighborhood,
            plan.Street,
            plan.OpenAddress,
            plan.CreatedAtUtc);
    }
}

internal static class ValidationExceptionFactory
{
    public static ValidationException Field(string field, string message) =>
        new([new FluentValidation.Results.ValidationFailure(field, message)]);
}

namespace CityCommunicationCenter.Application.Features.EDevlet;

public sealed record GetEDevletDailyActivityPlansQuery() : IQuery<IReadOnlyList<EDevletDailyActivityPlanListItemResponse>>;

public sealed class GetEDevletDailyActivityPlansQueryHandler : IQueryHandler<GetEDevletDailyActivityPlansQuery, IReadOnlyList<EDevletDailyActivityPlanListItemResponse>>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public GetEDevletDailyActivityPlansQueryHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<IReadOnlyList<EDevletDailyActivityPlanListItemResponse>> Handle(
        GetEDevletDailyActivityPlansQuery request,
        CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();
        var (_, departmentIds) = await EDevletDepartmentAccess.RequireUserAndDepartmentsAsync(
            _dbContext, _tenantContextAccessor, cancellationToken);

        return await _dbContext.EDevletDailyActivityPlans
            .AsNoTracking()
            .Where(plan => plan.TenantId == tenantId && departmentIds.Contains(plan.DepartmentId))
            .OrderByDescending(plan => plan.CreatedAtUtc)
            .Select(plan => new EDevletDailyActivityPlanListItemResponse(
                plan.PlanId,
                plan.PlanNumber,
                plan.PlanNumberYear,
                plan.CreatedAtUtc,
                plan.ActivityType.Name,
                plan.Neighborhood,
                plan.Street,
                plan.Description,
                plan.Status.ToString()))
            .ToListAsync(cancellationToken);
    }
}

public sealed record GetEDevletDailyActivityPlanByIdQuery(Guid PlanId) : IQuery<EDevletDailyActivityPlanResponse?>;

public sealed class GetEDevletDailyActivityPlanByIdQueryHandler : IQueryHandler<GetEDevletDailyActivityPlanByIdQuery, EDevletDailyActivityPlanResponse?>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public GetEDevletDailyActivityPlanByIdQueryHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<EDevletDailyActivityPlanResponse?> Handle(
        GetEDevletDailyActivityPlanByIdQuery request,
        CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();
        var (_, departmentIds) = await EDevletDepartmentAccess.RequireUserAndDepartmentsAsync(
            _dbContext, _tenantContextAccessor, cancellationToken);

        return await _dbContext.EDevletDailyActivityPlans
            .AsNoTracking()
            .Where(plan => plan.PlanId == request.PlanId && plan.TenantId == tenantId && departmentIds.Contains(plan.DepartmentId))
            .Select(plan => new EDevletDailyActivityPlanResponse(
                plan.PlanId,
                plan.ActivityTypeId,
                plan.ActivityType.Name,
                plan.Description,
                plan.Neighborhood,
                plan.Street,
                plan.OpenAddress,
                plan.PlanNumber,
                plan.PlanNumberYear,
                plan.Status.ToString(),
                plan.CreatedAtUtc))
            .FirstOrDefaultAsync(cancellationToken);
    }
}

public sealed record UpdateEDevletDailyActivityPlanCommand(
    Guid PlanId,
    Guid ActivityTypeId,
    string Description,
    string? Neighborhood,
    string? Street,
    string? OpenAddress) : ICommand<EDevletDailyActivityPlanResponse?>;

public sealed class UpdateEDevletDailyActivityPlanCommandValidator : AbstractValidator<UpdateEDevletDailyActivityPlanCommand>
{
    public UpdateEDevletDailyActivityPlanCommandValidator()
    {
        RuleFor(c => c.ActivityTypeId).NotEmpty().WithMessage("Faaliyet tipi secilmelidir.");
        RuleFor(c => c.Description).NotEmpty().WithMessage("Aciklama zorunludur.");
        RuleFor(c => c.Description).MaximumLength(100).WithMessage("Aciklama en fazla 100 karakter olabilir.");
        RuleFor(c => c.Neighborhood).NotEmpty().WithMessage("Mahalle secilmelidir.");
        RuleFor(c => c.Street).NotEmpty().WithMessage("Cadde / sokak / bulvar zorunludur.");
        RuleFor(c => c.Street).MaximumLength(50).WithMessage("Cadde / sokak / bulvar en fazla 50 karakter olabilir.");
    }
}

public sealed class UpdateEDevletDailyActivityPlanCommandHandler : ICommandHandler<UpdateEDevletDailyActivityPlanCommand, EDevletDailyActivityPlanResponse?>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public UpdateEDevletDailyActivityPlanCommandHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<EDevletDailyActivityPlanResponse?> Handle(
        UpdateEDevletDailyActivityPlanCommand request,
        CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        var (_, departmentIds) = await EDevletDepartmentAccess.RequireUserAndDepartmentsAsync(
            _dbContext, _tenantContextAccessor, cancellationToken);

        var plan = await _dbContext.EDevletDailyActivityPlans
            .Include(entity => entity.ActivityType)
            .FirstOrDefaultAsync(entity => entity.PlanId == request.PlanId && entity.TenantId == tenantId, cancellationToken);
        if (plan is null) return null;

        EDevletDepartmentAccess.EnsureDepartmentAccess(plan.DepartmentId, departmentIds);
        if (plan.Status == EDevletDailyActivityPlanStatus.Cancelled)
        {
            throw ValidationExceptionFactory.Field(nameof(request.PlanId), "Iptal edilmis faaliyet plani duzenlenemez.");
        }

        var activityType = await _dbContext.EDevletActivityTypes
            .AsNoTracking()
            .FirstOrDefaultAsync(entity => entity.ActivityTypeId == request.ActivityTypeId && entity.TenantId == tenantId, cancellationToken)
            ?? throw ValidationExceptionFactory.Field(nameof(request.ActivityTypeId), "Faaliyet tipi bulunamadi.");
        EDevletDepartmentAccess.EnsureDepartmentAccess(activityType.DepartmentId, departmentIds);

        plan.ActivityTypeId = request.ActivityTypeId;
        plan.Description = request.Description.Trim();
        plan.Neighborhood = string.IsNullOrWhiteSpace(request.Neighborhood) ? null : request.Neighborhood.Trim();
        plan.Street = string.IsNullOrWhiteSpace(request.Street) ? null : request.Street.Trim();
        plan.OpenAddress = string.IsNullOrWhiteSpace(request.OpenAddress) ? null : request.OpenAddress.Trim();
        plan.UpdatedAtUtc = DateTimeOffset.UtcNow;
        plan.UpdatedByUserId = context.UserId;
        await _dbContext.SaveChangesAsync(cancellationToken);

        return new EDevletDailyActivityPlanResponse(
            plan.PlanId,
            plan.ActivityTypeId,
            activityType.Name,
            plan.Description,
            plan.Neighborhood,
            plan.Street,
            plan.OpenAddress,
            plan.PlanNumber,
            plan.PlanNumberYear,
            plan.Status.ToString(),
            plan.CreatedAtUtc);
    }
}

public sealed record CancelEDevletDailyActivityPlanCommand(Guid PlanId) : ICommand<bool>;

public sealed class CancelEDevletDailyActivityPlanCommandHandler : ICommandHandler<CancelEDevletDailyActivityPlanCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public CancelEDevletDailyActivityPlanCommandHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<bool> Handle(CancelEDevletDailyActivityPlanCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        var (_, departmentIds) = await EDevletDepartmentAccess.RequireUserAndDepartmentsAsync(
            _dbContext, _tenantContextAccessor, cancellationToken);

        var plan = await _dbContext.EDevletDailyActivityPlans
            .FirstOrDefaultAsync(entity => entity.PlanId == request.PlanId && entity.TenantId == tenantId, cancellationToken);
        if (plan is null) return false;

        EDevletDepartmentAccess.EnsureDepartmentAccess(plan.DepartmentId, departmentIds);
        if (plan.Status == EDevletDailyActivityPlanStatus.Cancelled) return true;

        plan.Status = EDevletDailyActivityPlanStatus.Cancelled;
        plan.UpdatedAtUtc = DateTimeOffset.UtcNow;
        plan.UpdatedByUserId = context.UserId;
        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }
}

public sealed record DuplicateEDevletDailyActivityPlanCommand(Guid PlanId) : ICommand<EDevletDailyActivityPlanResponse?>;

public sealed class DuplicateEDevletDailyActivityPlanCommandHandler : ICommandHandler<DuplicateEDevletDailyActivityPlanCommand, EDevletDailyActivityPlanResponse?>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public DuplicateEDevletDailyActivityPlanCommandHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<EDevletDailyActivityPlanResponse?> Handle(
        DuplicateEDevletDailyActivityPlanCommand request,
        CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        var (user, departmentIds) = await EDevletDepartmentAccess.RequireUserAndDepartmentsAsync(
            _dbContext, _tenantContextAccessor, cancellationToken);

        var source = await _dbContext.EDevletDailyActivityPlans
            .AsNoTracking()
            .Include(plan => plan.ActivityType)
            .FirstOrDefaultAsync(plan => plan.PlanId == request.PlanId && plan.TenantId == tenantId, cancellationToken);
        if (source is null) return null;

        EDevletDepartmentAccess.EnsureDepartmentAccess(source.DepartmentId, departmentIds);

        var utcNow = DateTimeOffset.UtcNow;
        var plan = new EDevletDailyActivityPlan
        {
            PlanId = Guid.NewGuid(),
            TenantId = tenantId,
            DepartmentId = user.DepartmentId,
            ActivityTypeId = source.ActivityTypeId,
            PlanNumberYear = utcNow.Year,
            PlanNumber = await SequenceNumberHelper.NextEDevletPlanNumberAsync(_dbContext, tenantId, utcNow.Year, cancellationToken),
            Status = EDevletDailyActivityPlanStatus.Active,
            Description = source.Description,
            Neighborhood = source.Neighborhood,
            Street = source.Street,
            OpenAddress = source.OpenAddress,
            CreatedByUserId = context.UserId,
        };
        _dbContext.EDevletDailyActivityPlans.Add(plan);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return new EDevletDailyActivityPlanResponse(
            plan.PlanId,
            plan.ActivityTypeId,
            source.ActivityType.Name,
            plan.Description,
            plan.Neighborhood,
            plan.Street,
            plan.OpenAddress,
            plan.PlanNumber,
            plan.PlanNumberYear,
            plan.Status.ToString(),
            plan.CreatedAtUtc);
    }
}

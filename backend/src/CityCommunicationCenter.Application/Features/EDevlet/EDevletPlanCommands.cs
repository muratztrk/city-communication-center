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

        var response = await _dbContext.EDevletDailyActivityPlans
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
                plan.CreatedAtUtc,
                _dbContext.Users
                    .Where(user => user.UserId == plan.CreatedByUserId)
                    .Select(user => user.DisplayName)
                    .FirstOrDefault(),
                _dbContext.Departments
                    .Where(department => department.DepartmentId == plan.DepartmentId)
                    .Select(department => department.Name)
                    .FirstOrDefault(),
                null))
            .FirstOrDefaultAsync(cancellationToken);
        if (response is null) return null;

        var edits = await _dbContext.EDevletDailyActivityPlanEdits
            .AsNoTracking()
            .Where(edit => edit.PlanId == request.PlanId && edit.TenantId == tenantId)
            .OrderBy(edit => edit.EditedAtUtc)
            .Select(edit => new { edit.EditedByDisplayName, edit.EditedAtUtc, edit.ChangedFields, edit.Action, edit.ChangeSummary })
            .ToListAsync(cancellationToken);
        return response with
        {
            Edits = edits
                .Select(edit => new EDevletDailyActivityPlanEditResponse(
                    edit.EditedByDisplayName,
                    edit.EditedAtUtc,
                    edit.ChangedFields.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries),
                    edit.Action,
                    string.IsNullOrWhiteSpace(edit.ChangeSummary)
                        ? null
                        : edit.ChangeSummary.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)))
                .ToList(),
        };
    }
}

public sealed record UpdateEDevletDailyActivityPlanCommand(
    Guid PlanId,
    Guid ActivityTypeId,
    string Description,
    string? Neighborhood,
    string? Street,
    string? OpenAddress,
    string? Status = null) : ICommand<EDevletDailyActivityPlanResponse?>;

public sealed class UpdateEDevletDailyActivityPlanCommandValidator : AbstractValidator<UpdateEDevletDailyActivityPlanCommand>
{
    public UpdateEDevletDailyActivityPlanCommandValidator()
    {
        RuleFor(c => c.ActivityTypeId).NotEmpty().WithMessage("Faaliyet tipi secilmelidir.");
        RuleFor(c => c.Description).NotEmpty().WithMessage("Aciklama zorunludur.");
        RuleFor(c => c.Description).MaximumLength(400).WithMessage("Aciklama en fazla 400 karakter olabilir.");
        // Mahalle zorunlu değil (#6abfb6a3); mahalle seçildiyse cadde / sokak zorunludur.
        RuleFor(c => c.Street).NotEmpty().When(c => !string.IsNullOrWhiteSpace(c.Neighborhood))
            .WithMessage("Cadde / sokak zorunludur.");
        RuleFor(c => c.Street).MaximumLength(50).WithMessage("Cadde / sokak en fazla 50 karakter olabilir.");
        RuleFor(c => c.Status).Must(status => string.IsNullOrWhiteSpace(status) || Enum.TryParse<EDevletDailyActivityPlanStatus>(status, true, out _))
            .WithMessage("Gecersiz faaliyet plani durumu.");
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
        // Detay popup'ında Durum da değiştirilebilir (#6ac20d67): iptal edilmiş plan yalnız Aktif'e döndürülürken düzenlenebilir.
        EDevletDailyActivityPlanStatus? requestedStatus = string.IsNullOrWhiteSpace(request.Status)
            ? null
            : Enum.Parse<EDevletDailyActivityPlanStatus>(request.Status, true);
        if (plan.Status == EDevletDailyActivityPlanStatus.Cancelled && requestedStatus != EDevletDailyActivityPlanStatus.Active)
        {
            throw ValidationExceptionFactory.Field(nameof(request.PlanId), "Iptal edilmis faaliyet plani duzenlenemez.");
        }

        var activityType = await _dbContext.EDevletActivityTypes
            .AsNoTracking()
            .FirstOrDefaultAsync(entity => entity.ActivityTypeId == request.ActivityTypeId && entity.TenantId == tenantId, cancellationToken)
            ?? throw ValidationExceptionFactory.Field(nameof(request.ActivityTypeId), "Faaliyet tipi bulunamadi.");
        EDevletDepartmentAccess.EnsureDepartmentAccess(activityType.DepartmentId, departmentIds);

        var newDescription = request.Description.Trim();
        var newNeighborhood = string.IsNullOrWhiteSpace(request.Neighborhood) ? null : request.Neighborhood.Trim();
        var newStreet = string.IsNullOrWhiteSpace(request.Street) ? null : request.Street.Trim();

        // Düzenleme geçmişi (#6ac21381): yalnız gerçekten değişen alanlar kaydedilir.
        var changedFields = new List<string>();
        var changeSummary = new List<string>();
        static string Show(string? value) => string.IsNullOrWhiteSpace(value) ? "—" : value;
        static string StatusLabel(EDevletDailyActivityPlanStatus status) => status == EDevletDailyActivityPlanStatus.Active ? "Aktif" : "Pasif";
        var statusChanged = requestedStatus.HasValue && requestedStatus.Value != plan.Status;
        if (plan.ActivityTypeId != request.ActivityTypeId)
        {
            changedFields.Add("Faaliyet Tipi");
            changeSummary.Add($"Faaliyet Tipi: {Show(plan.ActivityType.Name)} → {Show(activityType.Name)}");
        }

        if (statusChanged)
        {
            changedFields.Add("Durum");
            changeSummary.Add($"Durum: {StatusLabel(plan.Status)} → {StatusLabel(requestedStatus!.Value)}");
        }

        if (!string.Equals(plan.Neighborhood, newNeighborhood, StringComparison.Ordinal))
        {
            changedFields.Add("Mahalle");
            changeSummary.Add($"Mahalle: {Show(plan.Neighborhood)} → {Show(newNeighborhood)}");
        }

        if (!string.Equals(plan.Street, newStreet, StringComparison.Ordinal))
        {
            changedFields.Add("Cadde/Sokak");
            changeSummary.Add($"Cadde/Sokak: {Show(plan.Street)} → {Show(newStreet)}");
        }

        if (!string.Equals(plan.Description, newDescription, StringComparison.Ordinal))
        {
            changedFields.Add("Açıklama");
            changeSummary.Add("Açıklama güncellendi");
        }

        var editAction = statusChanged && changedFields.Count == 1
            ? (requestedStatus == EDevletDailyActivityPlanStatus.Cancelled ? "Pasife Alma" : "Aktife Alma")
            : "Düzenleme";
        if (changedFields.Count > 0)
        {
            var editorName = await _dbContext.Users
                .AsNoTracking()
                .Where(user => user.UserId == context.UserId)
                .Select(user => user.DisplayName)
                .FirstOrDefaultAsync(cancellationToken);
            _dbContext.EDevletDailyActivityPlanEdits.Add(new EDevletDailyActivityPlanEdit
            {
                EditId = Guid.NewGuid(),
                TenantId = tenantId,
                PlanId = plan.PlanId,
                EditedByUserId = context.UserId,
                EditedByDisplayName = editorName,
                EditedAtUtc = DateTimeOffset.UtcNow,
                ChangedFields = string.Join(';', changedFields),
                Action = editAction,
                ChangeSummary = string.Join('\n', changeSummary),
                CreatedByUserId = context.UserId,
                UpdatedByUserId = context.UserId,
            });
        }

        plan.ActivityTypeId = request.ActivityTypeId;
        plan.Description = newDescription;
        plan.Neighborhood = newNeighborhood;
        plan.Street = newStreet;
        plan.OpenAddress = string.IsNullOrWhiteSpace(request.OpenAddress) ? null : request.OpenAddress.Trim();
        if (requestedStatus.HasValue) plan.Status = requestedStatus.Value;
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

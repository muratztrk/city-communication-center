namespace CityCommunicationCenter.Application.Features.Reports;

/// <summary>
/// Üst Düzey Yönetici Anasayfa-Birimler "e-Devlet Günlük Faaliyet Planları" pie'ında bir birime tıklanınca
/// açılan popup'ın gridview verisi: o birimin (dönem içindeki) faaliyet planları (#6ac0ccf8).
/// </summary>
public sealed record GetDashboardEDevletPlansQuery(
    Guid DepartmentId,
    DateTimeOffset? FromUtc,
    DateTimeOffset? ToUtc) : IQuery<DashboardEDevletPlansResponse>;

public sealed class GetDashboardEDevletPlansQueryHandler
    : IQueryHandler<GetDashboardEDevletPlansQuery, DashboardEDevletPlansResponse>
{
    private const int MaxRows = 500;

    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public GetDashboardEDevletPlansQueryHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<DashboardEDevletPlansResponse> Handle(
        GetDashboardEDevletPlansQuery request,
        CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        if (context.RoleCode is not ("Reporter" or "SystemAdmin"))
        {
            throw new ForbiddenAccessException("Bu rapor detayına yalnızca Üst Düzey Yönetici erişebilir.");
        }

        var departmentName = await _dbContext.Departments.AsNoTracking()
            .Where(department => department.TenantId == tenantId && department.DepartmentId == request.DepartmentId)
            .Select(department => department.Name)
            .FirstOrDefaultAsync(cancellationToken) ?? "—";

        var rows = await _dbContext.EDevletDailyActivityPlans.AsNoTracking()
            .Where(plan => plan.TenantId == tenantId
                && plan.DepartmentId == request.DepartmentId
                && (!request.FromUtc.HasValue || plan.CreatedAtUtc >= request.FromUtc.Value)
                && (!request.ToUtc.HasValue || plan.CreatedAtUtc <= request.ToUtc.Value))
            .OrderByDescending(plan => plan.CreatedAtUtc)
            .Take(MaxRows)
            .Select(plan => new DashboardEDevletPlanRow(
                plan.PlanId,
                plan.PlanNumber,
                plan.PlanNumberYear,
                plan.CreatedAtUtc,
                plan.ActivityType.Name,
                plan.Neighborhood,
                plan.Street,
                plan.Description,
                plan.Status.ToString(),
                _dbContext.Users
                    .Where(user => user.UserId == plan.CreatedByUserId)
                    .Select(user => user.DisplayName)
                    .FirstOrDefault()))
            .ToListAsync(cancellationToken);

        return new DashboardEDevletPlansResponse(departmentName, rows);
    }
}

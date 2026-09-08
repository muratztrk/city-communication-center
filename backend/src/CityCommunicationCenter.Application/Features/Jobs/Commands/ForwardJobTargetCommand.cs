using CityCommunicationCenter.Application.Features.Users;

namespace CityCommunicationCenter.Application.Features.Jobs;

/// <summary>
/// Birime düşen talebi (dış birim veya VTY vatandaş talebi), hedef birim yöneticisi veya VTY'nin
/// başka bir birime yönlendirmesi. Onay bekleyen tek hedef kaydı yeni birime taşınır; yönlendirme notu
/// hedef kaydın Notes alanında saklanır ("Talebin Yönlenme Sebebi"). Onaylanmış talep yönlendirilemez
/// (cards #1405-#1408). VTY vatandaş talebi yönlendirme (#3449).
/// </summary>
public sealed record ForwardJobTargetCommand(Guid JobId, Guid TargetDepartmentId, Guid? ActorUserId, string Note) : ICommand<bool>;

public sealed class ForwardJobTargetCommandValidator : AbstractValidator<ForwardJobTargetCommand>
{
    public ForwardJobTargetCommandValidator()
    {
        RuleFor(c => c.JobId).NotEmpty().WithMessage("Talep zorunludur.");
        RuleFor(c => c.TargetDepartmentId).NotEmpty().WithMessage("Yönlendirilecek birim zorunludur.");
        RuleFor(c => c.Note).NotEmpty().WithMessage("Talep yönlendirme notu zorunludur.")
            .MaximumLength(100).WithMessage("Talep yönlendirme notu en fazla 100 karakter olabilir.");
    }
}

public sealed class ForwardJobTargetCommandHandler : ICommandHandler<ForwardJobTargetCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public ForwardJobTargetCommandHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<bool> Handle(ForwardJobTargetCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        var utcNow = DateTimeOffset.UtcNow;

        var job = await _dbContext.Jobs.FirstOrDefaultAsync(
            j => j.JobId == request.JobId && j.TenantId == tenantId, cancellationToken);
        if (job is null) return false;

        // Yalnızca birim dışı veya VTY tarafından yönetilen vatandaş talepleri yönlendirilebilir.
        var isCitizenRequest = JobCitizenRequestHelper.IsCitizenRequest(job);
        if (job.RequestType != JobRequestType.ExternalUnit && !isCitizenRequest)
        {
            throw Validation(nameof(request.JobId), "Yalnızca birim dışı talepler yönlendirilebilir.");
        }

        var actor = await JobWorkflowAuthorization.RequireActorAsync(_dbContext, request.ActorUserId, tenantId, cancellationToken);
        var isSystemAdmin = JobWorkflowAuthorization.IsSystemAdmin(actor);
        if (isCitizenRequest && !UserRoleAccess.IsCitizenRequestManager(actor))
        {
            throw new ForbiddenAccessException("Talebi yönlendirme yetkiniz yok.");
        }

        var targets = await _dbContext.JobDepartments
            .Where(jd => jd.JobId == job.JobId && jd.Role == JobDepartmentRole.Target)
            .ToListAsync(cancellationToken);

        // Aktörün yönettiği hedef kaydı bulunur (SystemAdmin: ilk hedef). Manager oluşturduğu tek hedefli
        // birim dışı talep oluşturmada otomatik Approved olur; bu, hedef birim yöneticisinin kararı
        // DEĞİLDİR — bu yüzden "onaylı" kabulü ApprovalStatus'e göre değil, hedefe görev atanmış olmasına
        // göre yapılır (card #1407).
        JobDepartment? currentTarget = null;
        foreach (var target in targets)
        {
            if (isSystemAdmin
                || await JobWorkflowAuthorization.ManagesDepartmentAsync(_dbContext, actor, target.DepartmentId, cancellationToken)
                || (isCitizenRequest && await UserRoleAccess.CanManageCitizenRequestInTargetDepartmentAsync(
                    _dbContext,
                    tenantId,
                    actor,
                    job,
                    target.DepartmentId,
                    cancellationToken)))
            {
                currentTarget = target;
                break;
            }
        }
        if (currentTarget is null)
        {
            throw new ForbiddenAccessException("Talebi yönlendirme yetkiniz yok.");
        }

        if (currentTarget.ApprovalStatus == JobApprovalStatus.Rejected)
        {
            throw Validation(nameof(request.JobId), "Reddedilmiş talep yönlendirilemez.");
        }

        // Hedef birime görev atanmışsa talep yönetici tarafından onaylanmış demektir; yönlendirilemez (card #1407).
        var hasAssignedTasks = await _dbContext.Tasks.AnyAsync(
            t => t.JobId == job.JobId
                && t.TenantId == tenantId
                && t.AssignedDepartmentId == currentTarget.DepartmentId
                && t.CurrentStatus != CityCommunicationCenter.Domain.Enums.TaskStatus.Cancelled
                && t.CurrentStatus != CityCommunicationCenter.Domain.Enums.TaskStatus.Rejected,
            cancellationToken);
        if (hasAssignedTasks)
        {
            throw Validation(nameof(request.JobId), "Onaylanmış talep başka birime yönlendirilemez.");
        }

        if (request.TargetDepartmentId == currentTarget.DepartmentId)
        {
            throw Validation(nameof(request.TargetDepartmentId), "Talep zaten bu birimde. Farklı bir birim seçin.");
        }
        if (!isCitizenRequest && request.TargetDepartmentId == job.OwnerDepartmentId)
        {
            throw Validation(nameof(request.TargetDepartmentId), "Talep, talep sahibi birime yönlendirilemez.");
        }
        if (targets.Any(t => t.DepartmentId == request.TargetDepartmentId))
        {
            throw Validation(nameof(request.TargetDepartmentId), "Bu birim zaten talebin hedefinde.");
        }

        var newDept = await _dbContext.Departments.FirstOrDefaultAsync(
            d => d.DepartmentId == request.TargetDepartmentId && d.TenantId == tenantId, cancellationToken)
            ?? throw Validation(nameof(request.TargetDepartmentId), "Yönlendirilecek birim bulunamadı.");

        var previousDepartmentId = currentTarget.DepartmentId;

        // Hedef kaydı yeni birime taşınır; onay durumu (Pending / oto-Approved) korunur — böylece yeni birim
        // yöneticisi talebi aynı akışla görür ve onaylar. Yönlendirme notu Notes alanında saklanır ("Talebin
        // Yönlenme Sebebi"). Onay bekleyen/atanmamış hedefte henüz görev olmadığından taşınacak görev yoktur.
        currentTarget.DepartmentId = request.TargetDepartmentId;
        currentTarget.Notes = request.Note.Trim();
        currentTarget.RequestedByUserId = actor.UserId;
        currentTarget.RequestedAtUtc = utcNow;
        currentTarget.ApprovedByUserId = null;
        currentTarget.DecidedAtUtc = null;
        currentTarget.RejectReason = null;
        currentTarget.UpdatedAtUtc = utcNow;
        currentTarget.UpdatedByUserId = actor.UserId;

        job.UpdatedAtUtc = utcNow;
        job.UpdatedByUserId = actor.UserId;

        _dbContext.AuditLogs.Add(new AuditLog
        {
            AuditLogId = Guid.NewGuid(),
            TenantId = tenantId,
            EntityType = nameof(Job),
            EntityId = job.JobId.ToString(),
            Action = "JobTargetForwarded",
            ActorUserId = actor.UserId,
            ActorDisplayName = actor.DisplayName,
            StatusAtEvent = job.Status.ToString(),
            Notes = request.Note.Trim(),
            Details = $"From={previousDepartmentId} To={newDept.DepartmentId}"
        });

        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    private static ValidationException Validation(string property, string message) =>
        new([new FluentValidation.Results.ValidationFailure(property, message)]);
}

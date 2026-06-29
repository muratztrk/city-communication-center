using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Application.Features.Users;

namespace CityCommunicationCenter.Application.Features.Jobs;

public sealed record CreateJobCommand(
    Guid? ActorUserId,
    string Title,
    string Description,
    Guid OwnerDepartmentId,
    IReadOnlyCollection<Guid>? OwnerUserIds,
    string Priority,
    string? RequestType,
    bool IsProject,
    string? CitizenName,
    string? CitizenPhone,
    DateTimeOffset? StartDateUtc,
    DateTimeOffset? DueDateUtc,
    IReadOnlyCollection<Guid>? TargetDepartmentIds,
    string? SourceType,
    Guid? SourceRefId,
    double? Latitude = null,
    double? Longitude = null,
    string? Neighborhood = null,
    string? Street = null,
    string? OpenAddress = null) : ICommand<JobSummaryResponse>;

public sealed class CreateJobCommandValidator : AbstractValidator<CreateJobCommand>
{
    public CreateJobCommandValidator()
    {
        RuleFor(c => c.Title).NotEmpty().WithMessage("Is basligi zorunludur.");
        RuleFor(c => c.Description).NotEmpty().WithMessage("Is aciklamasi zorunludur.");
        RuleFor(c => c.OwnerDepartmentId).NotEmpty().WithMessage("Is sahibi mudurluk zorunludur.");
        RuleFor(c => c.Priority).NotEmpty().WithMessage("Oncelik zorunludur.");
    }
}

public sealed class CreateJobCommandHandler : ICommandHandler<CreateJobCommand, JobSummaryResponse>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;
    private readonly ISlaCalculatorService _slaCalculator;

    public CreateJobCommandHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor, ISlaCalculatorService slaCalculator)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
        _slaCalculator = slaCalculator;
    }

    public async ValueTask<JobSummaryResponse> Handle(CreateJobCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        var utcNow = DateTimeOffset.UtcNow;

        var actor = await JobWorkflowAuthorization.RequireActorAsync(_dbContext, request.ActorUserId, tenantId, cancellationToken);
        var isSystemAdmin = JobWorkflowAuthorization.IsSystemAdmin(actor);
        var isDepartmentScopedRequester = actor.RoleCode is RoleCode.Staff or RoleCode.Operator or RoleCode.CitizenRequestManager;

        // Auth: Staff can only create for own dept, Manager for managed dept, Admin for any
        if (!isSystemAdmin)
        {
            if (isDepartmentScopedRequester &&
                !await UserDepartmentAccess.CanWorkInDepartmentAsync(_dbContext, tenantId, actor, request.OwnerDepartmentId, cancellationToken, includeManagedDepartments: false))
            {
                var roleLabel = actor.RoleCode switch
                {
                    RoleCode.Staff => "Personel",
                    RoleCode.Operator => "Operator",
                    RoleCode.CitizenRequestManager => "Vatandas Talep Yoneticisi",
                    _ => "Bu rol"
                };
                throw new ForbiddenAccessException($"{roleLabel} sadece kendi mudurlugu icin talep olusturabilir.");
            }
            if (actor.RoleCode == RoleCode.Manager &&
                !await JobWorkflowAuthorization.ManagesDepartmentAsync(_dbContext, actor, request.OwnerDepartmentId, cancellationToken))
            {
                throw new ForbiddenAccessException("Mudur sadece yonettigi mudurluk icin talep olusturabilir.");
            }
            // Üst Düzey Yönetici (Reporter) sahip müdürlük kısıtı olmadan; CRM/Staff/Operator kendi birimiyle talep oluşturabilir.
            if (actor.RoleCode != RoleCode.Staff && actor.RoleCode != RoleCode.Manager && actor.RoleCode != RoleCode.Reporter && actor.RoleCode != RoleCode.Operator && actor.RoleCode != RoleCode.CitizenRequestManager)
            {
                throw new ForbiddenAccessException("Bu rol talep olusturamaz.");
            }
        }

        var ownerDept = await _dbContext.Departments.FirstOrDefaultAsync(
            d => d.DepartmentId == request.OwnerDepartmentId && d.TenantId == tenantId, cancellationToken)
            ?? throw Validation(nameof(request.OwnerDepartmentId), "Sahip mudurluk bulunamadi.");

        var ownerUserIds = request.OwnerUserIds?
            .Where(id => id != Guid.Empty)
            .Distinct()
            .ToArray() ?? [];

        var ownerUsers = Array.Empty<ApplicationUser>();
        if (ownerUserIds.Length > 0)
        {
            ownerUsers = await _dbContext.Users
                .Where(u => u.TenantId == tenantId && ownerUserIds.Contains(u.UserId))
                .ToArrayAsync(cancellationToken);

            if (ownerUsers.Length != ownerUserIds.Length || ownerUsers.Any(u => !u.IsActive))
            {
                throw Validation(nameof(request.OwnerUserIds), "Secilen kullanicilardan biri bulunamadi veya aktif degil.");
            }

            foreach (var ownerUser in ownerUsers)
            {
                if (!await UserDepartmentAccess.CanWorkInDepartmentAsync(_dbContext, tenantId, ownerUser, request.OwnerDepartmentId, cancellationToken))
                {
                    throw Validation(nameof(request.OwnerUserIds), "Secilen kullanicilar sahip mudurlukte calismali.");
                }
            }

            if (!isSystemAdmin && actor.RoleCode is RoleCode.Staff or RoleCode.CitizenRequestManager && ownerUsers.Any(u => u.UserId != actor.UserId))
            {
                throw Validation(nameof(request.OwnerUserIds), "Talep icin yalnizca kendiniz gorev sahibi secebilirsiniz.");
            }
        }

        var sourceType = Enum.TryParse<JobSourceType>(request.SourceType, true, out var st) ? st : JobSourceType.Manual;
        // Vatandaş talepleri operatörün kendi birimine de yönlendirilebilir; bu yüzden sahip birim
        // hedeften ayıklanmaz. Birim içi/dışı taleplerde sahip=hedef anlamsızdır, ayıklanır.
        var isCitizenSource = string.Equals(request.RequestType, JobRequestType.Citizen.ToString(), StringComparison.OrdinalIgnoreCase)
            || sourceType is JobSourceType.SocialMessage or JobSourceType.CitizenRequest or JobSourceType.EDevlet;
        var targets = request.TargetDepartmentIds?
            .Where(id => isCitizenSource || id != request.OwnerDepartmentId)
            .Distinct()
            .ToArray() ?? [];

        if (string.Equals(request.RequestType, JobRequestType.ExternalUnit.ToString(), StringComparison.OrdinalIgnoreCase)
            && targets.Length == 0)
        {
            throw Validation(nameof(request.TargetDepartmentIds), "Birim dışı talep için sahip birimden farklı bir hedef birim seçilmelidir.");
        }

        if (targets.Length > 1)
        {
            throw Validation(nameof(request.TargetDepartmentIds), "Talep icin yalnizca bir hedef birim secilebilir.");
        }

        if (ownerUserIds.Length > 1)
        {
            throw Validation(nameof(request.OwnerUserIds), "Talep icin yalnizca bir gorev sahibi secilebilir.");
        }

        var requestType = Enum.TryParse<JobRequestType>(request.RequestType, true, out var rt)
            ? rt
            : sourceType is JobSourceType.SocialMessage or JobSourceType.CitizenRequest or JobSourceType.EDevlet
                ? JobRequestType.Citizen
                : targets.Length > 0
                    ? JobRequestType.ExternalUnit
                    : JobRequestType.InternalUnit;
        var isCitizenRequest = requestType == JobRequestType.Citizen
            || sourceType is JobSourceType.SocialMessage or JobSourceType.CitizenRequest or JobSourceType.EDevlet;
        var requiresOwnerApproval = actor.RoleCode is RoleCode.Staff or RoleCode.CitizenRequestManager
            || (actor.RoleCode == RoleCode.Operator && !isCitizenRequest);

        if (actor.RoleCode == RoleCode.Operator && isCitizenRequest && targets.Length > 0)
        {
            var targetDepartments = await _dbContext.Departments
                .AsNoTracking()
                .Where(department => department.TenantId == tenantId && targets.Contains(department.DepartmentId))
                .Select(department => new { department.Name, department.DepartmentType })
                .ToListAsync(cancellationToken);

            if (targetDepartments.Any(department => IsPresidencyLevelDepartment(department.Name, department.DepartmentType)))
            {
                throw Validation(nameof(request.TargetDepartmentIds), "Baskanlik seviyesi birimlere vatandas talebi olusturulamaz.");
            }
        }
        var ownerTaskNotes = JobOwnerTaskProvisioning.CreateOwnerTaskNotes(ownerUserIds);
        var dueDateUtc = request.DueDateUtc;
        if (!requiresOwnerApproval && dueDateUtc is null)
        {
            var settings = await _dbContext.TenantSettings
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.TenantId == tenantId, cancellationToken);
            if (settings is not null && settings.DefaultSlaHours > 0)
            {
                dueDateUtc = await _slaCalculator.CalculateDueDateAsync(
                    utcNow, settings.DefaultSlaHours, tenantId, request.OwnerDepartmentId, cancellationToken);
            }
        }

        var isCoordinatedExternal = requestType == JobRequestType.ExternalUnit && targets.Length > 1;
        var initialJobStatus = requiresOwnerApproval
            ? JobStatus.PendingOwnerApproval
            : isCoordinatedExternal
                ? JobStatus.PendingExternalApproval
                : JobStatus.Active;

        var job = new Job
        {
            JobId = Guid.NewGuid(),
            TenantId = tenantId,
            Title = request.Title.Trim(),
            Description = request.Description.Trim(),
            OwnerDepartmentId = request.OwnerDepartmentId,
            Status = initialJobStatus,
            Priority = request.Priority.Trim(),
            RequestType = requestType,
            IsProject = request.IsProject,
            CitizenName = string.IsNullOrWhiteSpace(request.CitizenName) ? null : request.CitizenName.Trim(),
            CitizenPhone = string.IsNullOrWhiteSpace(request.CitizenPhone) ? null : request.CitizenPhone.Trim(),
            StartDateUtc = request.StartDateUtc,
            DueDateUtc = dueDateUtc,
            SourceType = sourceType,
            SourceRefId = request.SourceRefId,
            Latitude = request.Latitude,
            Longitude = request.Longitude,
            Neighborhood = string.IsNullOrWhiteSpace(request.Neighborhood) ? null : request.Neighborhood.Trim(),
            Street = string.IsNullOrWhiteSpace(request.Street) ? null : request.Street.Trim(),
            OpenAddress = string.IsNullOrWhiteSpace(request.OpenAddress) ? null : request.OpenAddress.Trim(),
            IsCoordinated = isCoordinatedExternal,
            CreatedByUserId = context.UserId
        };

        // Onay gerektirmeyen (yönetici/yönetim kaynaklı) talepler oluşturulurken numara alır;
        // çünkü oluşturan zaten onaycıdır ve talep doğrudan onaylanmış sayılır.
        if (!requiresOwnerApproval)
        {
            job.JobNumberYear = utcNow.Year;
            job.JobNumber = await SequenceNumberHelper.NextJobNumberAsync(_dbContext, tenantId, utcNow.Year, cancellationToken);
        }

        _dbContext.Jobs.Add(job);

        _dbContext.JobDepartments.Add(new JobDepartment
        {
            JobDepartmentId = Guid.NewGuid(),
            TenantId = tenantId,
            JobId = job.JobId,
            DepartmentId = request.OwnerDepartmentId,
            Role = JobDepartmentRole.Owner,
            ApprovalStatus = requiresOwnerApproval ? JobApprovalStatus.Pending : JobApprovalStatus.Approved,
            RequestedByUserId = actor.UserId,
            RequestedAtUtc = utcNow,
            ApprovedByUserId = requiresOwnerApproval ? null : actor.UserId,
            DecidedAtUtc = requiresOwnerApproval ? null : utcNow,
            Notes = ownerTaskNotes,
            CreatedByUserId = context.UserId
        });

        foreach (var targetDeptId in targets)
        {
            var targetApprovalStatus = isCoordinatedExternal
                ? JobApprovalStatus.Pending
                : isCitizenRequest
                    ? JobApprovalStatus.Pending
                : requiresOwnerApproval
                    ? JobApprovalStatus.NotRequired
                    : JobApprovalStatus.Approved;
            var autoApproveTarget = targetApprovalStatus == JobApprovalStatus.Approved;

            _dbContext.JobDepartments.Add(new JobDepartment
            {
                JobDepartmentId = Guid.NewGuid(),
                TenantId = tenantId,
                JobId = job.JobId,
                DepartmentId = targetDeptId,
                Role = JobDepartmentRole.Target,
                ApprovalStatus = targetApprovalStatus,
                RequestedByUserId = actor.UserId,
                RequestedAtUtc = utcNow,
                ApprovedByUserId = autoApproveTarget ? actor.UserId : null,
                DecidedAtUtc = autoApproveTarget ? utcNow : null,
                CreatedByUserId = context.UserId
            });
        }

        if (!requiresOwnerApproval)
        {
            var taskYear = utcNow.Year;
            foreach (var ownerUser in ownerUsers)
            {
                var taskNumber = await SequenceNumberHelper.NextTaskNumberAsync(_dbContext, tenantId, taskYear, cancellationToken);
                var task = new WorkTask
                {
                    TaskId = Guid.NewGuid(),
                    TenantId = tenantId,
                    JobId = job.JobId,
                    Title = job.Title,
                    Description = job.Description,
                    AssignedDepartmentId = request.OwnerDepartmentId,
                    AssignedUserId = ownerUser.UserId,
                    AssignedAtUtc = utcNow,   // card 589
                    AssigningManagerId = actor.RoleCode == RoleCode.Manager ? actor.UserId : null,
                    OwnerUserId = ownerUser.UserId,
                    CurrentStatus = CityCommunicationCenter.Domain.Enums.TaskStatus.Assigned,
                    Priority = job.Priority,
                    StartDateUtc = job.StartDateUtc,
                    DueDateUtc = job.DueDateUtc,
                    CreatedByUserId = context.UserId,
                    TaskNumber = taskNumber,
                    TaskNumberYear = taskYear
                };

                _dbContext.Tasks.Add(task);
                _dbContext.AuditLogs.Add(new AuditLog
                {
                    AuditLogId = Guid.NewGuid(),
                    TenantId = tenantId,
                    EntityType = nameof(WorkTask),
                    EntityId = task.TaskId.ToString(),
                    Action = "TaskCreated",
                    ActorUserId = context.UserId,
                    ActorDisplayName = actor.DisplayName,
                    StatusAtEvent = CityCommunicationCenter.Domain.Enums.TaskStatus.Assigned.ToString(),
                    Notes = $"Assigned to: {ownerUser.DisplayName}",
                    Details = $"Created from job owner user selection. AssignedUser={ownerUser.UserId}"
                });
            }
        }

        _dbContext.AuditLogs.Add(new AuditLog
        {
            AuditLogId = Guid.NewGuid(),
            TenantId = tenantId,
            EntityType = nameof(Job),
            EntityId = job.JobId.ToString(),
            Action = "JobCreated",
            ActorUserId = context.UserId,
            ActorDisplayName = actor.DisplayName,
            StatusAtEvent = job.Status.ToString(),
            Notes = $"Targets={targets.Length}, OwnerUsers={ownerUsers.Length}",
            Details = $"Status={job.Status}, Targets={targets.Length}, OwnerUsers={ownerUsers.Length}"
        });

        await _dbContext.SaveChangesAsync(cancellationToken);

        return await JobSummaryResponseFactory.CreateAsync(_dbContext, job, cancellationToken);
    }

    private static ValidationException Validation(string p, string m) =>
        new([new FluentValidation.Results.ValidationFailure(p, m)]);

    private static bool IsPresidencyLevelDepartment(string name, string departmentType) =>
        string.Equals(name, "Başkanlık", StringComparison.OrdinalIgnoreCase)
        || string.Equals(departmentType, "Daire", StringComparison.OrdinalIgnoreCase);
}

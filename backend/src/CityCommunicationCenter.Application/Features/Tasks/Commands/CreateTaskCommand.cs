using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Application.Features.Jobs;
using CityCommunicationCenter.Application.Features.Users;
using CityCommunicationCenter.Domain.Enums;
using WorkflowTaskStatus = CityCommunicationCenter.Domain.Enums.TaskStatus;

namespace CityCommunicationCenter.Application.Features.Tasks;

public sealed record CreateTaskCommand(
    Guid? ActorUserId,
    Guid JobId,
    string Title,
    string Description,
    string Priority,
    DateTimeOffset? StartDateUtc,
    DateTimeOffset? DueDateUtc,
    decimal? EstimatedHours,
    string? Notes,
    Guid? AssignedDepartmentId,
    Guid? AssignedUserId) : ICommand<TaskSummaryResponse>;

public sealed class CreateTaskCommandValidator : AbstractValidator<CreateTaskCommand>
{
    public CreateTaskCommandValidator()
    {
        RuleFor(c => c.JobId).NotEmpty().WithMessage("Gorev icin is (Job) zorunludur.");
        RuleFor(c => c.Title).NotEmpty().WithMessage("Gorev basligi zorunludur.");
        RuleFor(c => c.Description).NotEmpty().WithMessage("Gorev aciklamasi zorunludur.");
        RuleFor(c => c.Priority).NotEmpty().WithMessage("Oncelik alani zorunludur.");
    }
}

public sealed class CreateTaskCommandHandler : ICommandHandler<CreateTaskCommand, TaskSummaryResponse>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;
    private readonly ISlaCalculatorService _slaCalculator;

    public CreateTaskCommandHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor,
        ISlaCalculatorService slaCalculator)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
        _slaCalculator = slaCalculator;
    }

    public async ValueTask<TaskSummaryResponse> Handle(CreateTaskCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();

        var job = await _dbContext.Jobs.FirstOrDefaultAsync(
                entity => entity.JobId == request.JobId && entity.TenantId == tenantId,
                cancellationToken)
            ?? throw Validation(nameof(request.JobId), "Is bulunamadi.");

        if (job.Status != Domain.Enums.JobStatus.Active)
        {
            throw Validation(nameof(request.JobId), "Sadece aktif islere gorev eklenebilir.");
        }

        var actor = await TaskWorkflowAuthorization.RequireActiveActorAsync(_dbContext, request.ActorUserId, tenantId, cancellationToken);
        var isSystemAdmin = TaskWorkflowAuthorization.IsSystemAdmin(actor);

        var actorDepartmentId = await UserDepartmentAccess.GetDefaultDepartmentIdAsync(
            _dbContext,
            tenantId,
            actor,
            context.ActiveDepartmentId,
            cancellationToken);
        var actorDept = await _dbContext.Departments.FirstOrDefaultAsync(d => d.TenantId == tenantId && d.DepartmentId == actorDepartmentId, cancellationToken);
        var ownerUserId = actorDept?.ManagerUserId;

        var assignedUserId = request.AssignedUserId;
        var assignedDepartmentId = request.AssignedDepartmentId;
        Guid? assigningManagerId = null;

        if (!isSystemAdmin)
        {
            if (UserRoleAccess.IsCitizenRequestManager(actor))
            {
                if (!JobCitizenRequestHelper.IsCitizenRequest(job))
                {
                    throw new ForbiddenAccessException("Vatandas talep yoneticisi yalnizca vatandas taleplerine gorev atayabilir.");
                }

                var managerDept = assignedDepartmentId ?? context.ActiveDepartmentId ?? actorDepartmentId;

                var canManage = await UserRoleAccess.CanManageCitizenRequestInTargetDepartmentAsync(
                    _dbContext,
                    tenantId,
                    actor,
                    job,
                    managerDept,
                    cancellationToken);
                if (!canManage)
                {
                    throw new ForbiddenAccessException("Bu vatandas talebi icin gorev atama yetkiniz yok.");
                }

                assignedDepartmentId = managerDept;
                assigningManagerId = actor.UserId;
            }
            else if (actor.RoleCode == RoleCode.Staff)
            {
                if (assignedUserId.HasValue && assignedUserId.Value != actor.UserId)
                {
                    throw Validation(nameof(request.AssignedUserId), "Personel sadece kendisine gorev atayabilir.");
                }

                assignedUserId = actor.UserId;
                assignedDepartmentId ??= actorDepartmentId;
            }
            else if (actor.RoleCode == RoleCode.Manager)
            {
                var managerDept = assignedDepartmentId ?? context.ActiveDepartmentId;
                if (!managerDept.HasValue)
                {
                    managerDept = await ResolveManagerAssignmentDepartmentAsync(_dbContext, job, actor, cancellationToken);
                }

                managerDept ??= job.OwnerDepartmentId;
                var isManagerDept = await TaskWorkflowAuthorization.IsManagerOfAsync(_dbContext, actor, managerDept.Value, cancellationToken);
                if (!isManagerDept)
                {
                    throw new ForbiddenAccessException("Bu departman icin gorev olusturma yetkiniz yok.");
                }

                assignedDepartmentId = managerDept;
                assigningManagerId = actor.UserId;
            }
            else
            {
                throw new ForbiddenAccessException("Bu rol gorev olusturamaz.");
            }
        }

        // Atama denetim kaydında atanan kişinin adı saklanır; bildirimde "Bir personele atandı" yerine
        // ismi gösterilir (card 639).
        string? assignedUserDisplayName = null;
        if (assignedUserId.HasValue)
        {
            var target = await _dbContext.Users.FirstOrDefaultAsync(
                u => u.UserId == assignedUserId.Value && u.TenantId == tenantId,
                cancellationToken);
            if (target is null || !target.IsActive)
            {
                throw Validation(nameof(request.AssignedUserId), "Secilen kullanici bulunamadi veya aktif degil.");
            }
            assignedUserDisplayName = target.DisplayName;
            if (assignedDepartmentId.HasValue &&
                !await UserDepartmentAccess.CanWorkInDepartmentAsync(_dbContext, tenantId, target, assignedDepartmentId.Value, cancellationToken))
            {
                throw Validation(nameof(request.AssignedUserId), "Secilen kullanici atanan mudurlukte calismiyor.");
            }

            assignedDepartmentId ??= await UserDepartmentAccess.GetDefaultDepartmentIdAsync(
                _dbContext,
                tenantId,
                target,
                context.ActiveDepartmentId,
                cancellationToken);
            ownerUserId = target.UserId;
        }

        var initialStatus = assignedUserId.HasValue ? WorkflowTaskStatus.Assigned : WorkflowTaskStatus.Waiting;
        var utcNow = DateTimeOffset.UtcNow;
        var dueDateUtc = request.DueDateUtc;
        if (initialStatus == WorkflowTaskStatus.Assigned && dueDateUtc is null)
        {
            var settings = await _dbContext.TenantSettings
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.TenantId == tenantId, cancellationToken);
            if (settings is not null && settings.DefaultSlaHours > 0)
            {
                dueDateUtc = await _slaCalculator.CalculateDueDateAsync(
                    utcNow, settings.DefaultSlaHours, tenantId, assignedDepartmentId, cancellationToken);
            }
        }

        var taskYear = utcNow.Year;
        var taskNumber = await SequenceNumberHelper.NextTaskNumberAsync(_dbContext, tenantId, taskYear, cancellationToken);

        var task = new WorkTask
        {
            TaskId = Guid.NewGuid(),
            TenantId = tenantId,
            JobId = request.JobId,
            Title = request.Title.Trim(),
            Description = request.Description.Trim(),
            AssignedDepartmentId = assignedDepartmentId,
            AssignedUserId = assignedUserId,
            AssignedAtUtc = assignedUserId.HasValue ? utcNow : null,   // card 589
            AssigningManagerId = assigningManagerId,
            OwnerUserId = ownerUserId,
            CurrentStatus = initialStatus,
            Priority = request.Priority.Trim(),
            StartDateUtc = request.StartDateUtc,
            DueDateUtc = dueDateUtc,
            EstimatedHours = request.EstimatedHours,
            Notes = request.Notes,
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
            StatusAtEvent = initialStatus.ToString(),
            Notes = request.Notes,
            Details = assignedUserId.HasValue ? $"Assigned to: {assignedUserDisplayName}" : "Unassigned (pool)"
        });

        // Görevin ilk ataması da Atama Geçmişi'nde görünsün; yönlendirme sonrası ilk atanan
        // kullanıcı/tarih de listede yer alır (card #720).
        if (assignedUserId.HasValue || assignedDepartmentId.HasValue)
        {
            _dbContext.AssignmentHistories.Add(new AssignmentHistory
            {
                AssignmentId = Guid.NewGuid(),
                TenantId = tenantId,
                TaskId = task.TaskId,
                FromDepartmentId = null,
                ToDepartmentId = assignedDepartmentId,
                FromUserId = null,
                ToUserId = assignedUserId,
                ActionType = "Assign",
                ActionDateUtc = utcNow,
                CreatedByUserId = context.UserId
            });
        }

        await CitizenJobTargetApproval.TryRecordTargetApprovalAsync(
            _dbContext,
            job,
            assignedDepartmentId,
            actor.UserId,
            utcNow,
            cancellationToken);

        await _dbContext.SaveChangesAsync(cancellationToken);

        return await TaskSummaryResponseFactory.CreateAsync(_dbContext, task, cancellationToken);
    }

    private static async Task<Guid?> ResolveManagerAssignmentDepartmentAsync(
        IApplicationDbContext dbContext,
        Job job,
        ApplicationUser actor,
        CancellationToken cancellationToken)
    {
        var targetDeptIds = await dbContext.JobDepartments
            .AsNoTracking()
            .Where(entity => entity.JobId == job.JobId && entity.Role == JobDepartmentRole.Target)
            .Select(entity => entity.DepartmentId)
            .ToListAsync(cancellationToken);

        foreach (var deptId in targetDeptIds)
        {
            if (await TaskWorkflowAuthorization.IsManagerOfAsync(dbContext, actor, deptId, cancellationToken))
            {
                return deptId;
            }
        }

        var ownerDeptIds = await dbContext.JobDepartments
            .AsNoTracking()
            .Where(entity => entity.JobId == job.JobId && entity.Role == JobDepartmentRole.Owner)
            .Select(entity => entity.DepartmentId)
            .ToListAsync(cancellationToken);

        foreach (var deptId in ownerDeptIds)
        {
            if (await TaskWorkflowAuthorization.IsManagerOfAsync(dbContext, actor, deptId, cancellationToken))
            {
                return deptId;
            }
        }

        return null;
    }

    private static ValidationException Validation(string property, string message) =>
        new([new FluentValidation.Results.ValidationFailure(property, message)]);
}

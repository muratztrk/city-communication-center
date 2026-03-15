using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Domain.Entities;
using CityCommunicationCenter.Domain.Enums;
using CityCommunicationCenter.Infrastructure.Persistence;
using CityCommunicationCenter.Shared.Contracts;
using Microsoft.AspNetCore.Mvc;
using WorkflowTaskStatus = CityCommunicationCenter.Domain.Enums.TaskStatus;

namespace CityCommunicationCenter.Api.Controllers.V1;

[Route("api/v1/tasks")]
public sealed class TasksController : ApiControllerBase
{
    private readonly CityCommunicationCenterDbContext _dbContext;

    public TasksController(
        CityCommunicationCenterDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor)
        : base(tenantContextAccessor)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
    [ProducesResponseType<IEnumerable<TaskSummaryResponse>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<TaskSummaryResponse>>> GetAll(CancellationToken cancellationToken)
    {
        if (!TryGetTenantId(out var tenantId, out var error))
        {
            return error;
        }

        var tasks = await _dbContext.Tasks
            .WhereTenant(tenantId.Value)
            .ToListAsync(cancellationToken);

        var response = tasks
            .OrderByDescending(x => x.CreatedAtUtc)
            .Select(x => new TaskSummaryResponse(
                x.TaskId,
                x.TenantId,
                x.Title,
                x.TaskType.ToString(),
                x.Priority,
                x.CurrentStatus.ToString(),
                x.TargetDepartmentId,
                x.AssignedUserId,
                x.DueDateUtc))
            .ToList();

        return Ok(response);
    }

    [HttpGet("{taskId:guid}", Name = nameof(GetById))]
    [ProducesResponseType<TaskDetailResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<TaskDetailResponse>> GetById(Guid taskId, CancellationToken cancellationToken)
    {
        if (!TryGetTenantId(out var tenantId, out var error))
        {
            return error;
        }

        var task = await _dbContext.Tasks
            .WhereTenant(tenantId.Value)
            .WhereId("TaskId", taskId)
            .FirstOrDefaultAsync(cancellationToken);

        if (task is null)
        {
            return NotFound();
        }

        var approvals = await _dbContext.GetApprovalsForTaskAsync(tenantId.Value, taskId, cancellationToken);
        var assignmentHistory = await _dbContext.GetAssignmentHistoryForTaskAsync(tenantId.Value, taskId, cancellationToken);

        return Ok(ToDetailResponse(task, approvals, assignmentHistory));
    }

    [HttpPost]
    [ProducesResponseType<TaskSummaryResponse>(StatusCodes.Status201Created)]
    public async Task<ActionResult<TaskSummaryResponse>> Create(
        [FromBody] CreateTaskRequest request,
        CancellationToken cancellationToken)
    {
        if (!TryGetTenantId(out var tenantId, out var error))
        {
            return error;
        }

        // Get current user to find their manager
        Guid? assignedUserId = null;
        Guid? assignedDepartmentId = null;
        var initialStatus = WorkflowTaskStatus.Draft;

        if (CurrentContext.UserId.HasValue)
        {
            var currentUser = await _dbContext.Users
                .WhereTenant(tenantId.Value)
                .WhereId("UserId", CurrentContext.UserId.Value)
                .FirstOrDefaultAsync(cancellationToken);

            if (currentUser?.ManagerUserId != null)
            {
                // Auto-assign to manager
                assignedUserId = currentUser.ManagerUserId;
                assignedDepartmentId = currentUser.DepartmentId;
                initialStatus = WorkflowTaskStatus.PendingApproval;
            }
        }

        var task = new WorkTask
        {
            TaskId = Guid.NewGuid(),
            TenantId = tenantId.Value,
            Title = request.Title,
            Description = request.Description,
            TaskType = Enum.Parse<TaskType>(request.TaskType, true),
            SourceType = Enum.Parse<SourceType>(request.SourceType, true),
            SourceRefId = request.SourceRefId,
            TargetDepartmentId = request.TargetDepartmentId ?? assignedDepartmentId,
            AssignedDepartmentId = assignedDepartmentId,
            AssignedUserId = assignedUserId,
            CurrentStatus = initialStatus,
            Priority = request.Priority,
            DueDateUtc = request.DueDateUtc,
            CreatedByUserId = CurrentContext.UserId
        };

        await _dbContext.InsertTaskAsync(task, cancellationToken);
        
        var auditDetails = assignedUserId.HasValue 
            ? $"Auto-assigned to manager: {assignedUserId}" 
            : null;
        await _dbContext.InsertAuditLogAsync(CreateAuditLog(tenantId.Value, nameof(WorkTask), task.TaskId, "TaskCreated", auditDetails), cancellationToken);

        var response = new TaskSummaryResponse(
            task.TaskId,
            task.TenantId,
            task.Title,
            task.TaskType.ToString(),
            task.Priority,
            task.CurrentStatus.ToString(),
            task.TargetDepartmentId,
            task.AssignedUserId,
            task.DueDateUtc);

        return CreatedAtRoute(nameof(GetById), new { taskId = task.TaskId }, response);
    }

    [HttpPost("{taskId:guid}/submit")]
    public async Task<IActionResult> Submit(Guid taskId, [FromBody] SubmitTaskRequest request, CancellationToken cancellationToken)
    {
        if (!TryGetTenantId(out var tenantId, out var error))
        {
            return error;
        }

        var exists = await _dbContext.Tasks.WhereTenant(tenantId.Value).WhereId("TaskId", taskId).AnyAsync(cancellationToken);
        if (!exists) return NotFound();

        await _dbContext.UpdateTaskStatusAsync(taskId, WorkflowTaskStatus.PendingApproval, CurrentContext.UserId, cancellationToken);
        await _dbContext.InsertAuditLogAsync(CreateAuditLog(tenantId.Value, nameof(WorkTask), taskId, "TaskSubmitted", request.Note), cancellationToken);
        return NoContent();
    }

    [HttpPost("{taskId:guid}/approve")]
    public async Task<IActionResult> Approve(
        Guid taskId,
        [FromBody] ApprovalActionRequest request,
        CancellationToken cancellationToken)
    {
        if (!TryGetTenantId(out var tenantId, out var error))
        {
            return error;
        }

        var task = await _dbContext.Tasks.WhereTenant(tenantId.Value).WhereId("TaskId", taskId).FirstOrDefaultAsync(cancellationToken);
        if (task is null) return NotFound();

        await _dbContext.UpdateTaskStatusAsync(taskId, WorkflowTaskStatus.Assigned, CurrentContext.UserId, cancellationToken);

        var stepOrder = await _dbContext.GetApprovalCountForTaskAsync(taskId, cancellationToken) + 1;
        await _dbContext.InsertApprovalAsync(new Approval
        {
            ApprovalId = Guid.NewGuid(),
            TenantId = tenantId.Value,
            TaskId = task.TaskId,
            ApproverUserId = CurrentContext.UserId ?? Guid.Empty,
            StepOrder = stepOrder,
            Decision = ApprovalDecision.Approved,
            Comment = request.Comment,
            DecisionDateUtc = DateTimeOffset.UtcNow,
            CreatedByUserId = CurrentContext.UserId
        }, cancellationToken);

        await _dbContext.InsertAuditLogAsync(CreateAuditLog(tenantId.Value, nameof(WorkTask), task.TaskId, "TaskApproved"), cancellationToken);
        return NoContent();
    }

    [HttpPost("{taskId:guid}/reject")]
    public async Task<IActionResult> Reject(
        Guid taskId,
        [FromBody] ApprovalActionRequest request,
        CancellationToken cancellationToken)
    {
        if (!TryGetTenantId(out var tenantId, out var error))
        {
            return error;
        }

        var task = await _dbContext.Tasks.WhereTenant(tenantId.Value).WhereId("TaskId", taskId).FirstOrDefaultAsync(cancellationToken);
        if (task is null) return NotFound();

        await _dbContext.UpdateTaskStatusAsync(taskId, WorkflowTaskStatus.Rejected, CurrentContext.UserId, cancellationToken);

        var stepOrder = await _dbContext.GetApprovalCountForTaskAsync(taskId, cancellationToken) + 1;
        await _dbContext.InsertApprovalAsync(new Approval
        {
            ApprovalId = Guid.NewGuid(),
            TenantId = tenantId.Value,
            TaskId = task.TaskId,
            ApproverUserId = CurrentContext.UserId ?? Guid.Empty,
            StepOrder = stepOrder,
            Decision = ApprovalDecision.Rejected,
            Comment = request.Comment,
            DecisionDateUtc = DateTimeOffset.UtcNow,
            CreatedByUserId = CurrentContext.UserId
        }, cancellationToken);

        await _dbContext.InsertAuditLogAsync(CreateAuditLog(tenantId.Value, nameof(WorkTask), task.TaskId, "TaskRejected"), cancellationToken);
        return NoContent();
    }

    [HttpPost("{taskId:guid}/assign")]
    public async Task<IActionResult> Assign(
        Guid taskId,
        [FromBody] AssignTaskRequest request,
        CancellationToken cancellationToken)
    {
        if (!TryGetTenantId(out var tenantId, out var error))
        {
            return error;
        }

        var task = await _dbContext.Tasks.WhereTenant(tenantId.Value).WhereId("TaskId", taskId).FirstOrDefaultAsync(cancellationToken);
        if (task is null) return NotFound();

        await _dbContext.UpdateTaskAssignmentAsync(taskId, request.DepartmentId, request.UserId, CurrentContext.UserId, cancellationToken);
        await _dbContext.InsertAssignmentHistoryAsync(new AssignmentHistory
        {
            AssignmentId = Guid.NewGuid(),
            TenantId = tenantId.Value,
            TaskId = task.TaskId,
            FromDepartmentId = task.TargetDepartmentId,
            ToDepartmentId = request.DepartmentId,
            FromUserId = CurrentContext.UserId,
            ToUserId = request.UserId,
            ActionType = request.ActionType,
            CreatedByUserId = CurrentContext.UserId
        }, cancellationToken);

        await _dbContext.InsertAuditLogAsync(CreateAuditLog(tenantId.Value, nameof(WorkTask), task.TaskId, "TaskAssigned"), cancellationToken);
        return NoContent();
    }

    [HttpPost("{taskId:guid}/complete")]
    public async Task<IActionResult> Complete(
        Guid taskId,
        [FromBody] CompleteTaskRequest request,
        CancellationToken cancellationToken)
    {
        if (!TryGetTenantId(out var tenantId, out var error))
        {
            return error;
        }

        var exists = await _dbContext.Tasks.WhereTenant(tenantId.Value).WhereId("TaskId", taskId).AnyAsync(cancellationToken);
        if (!exists) return NotFound();

        await _dbContext.UpdateTaskCompletedAsync(taskId, CurrentContext.UserId, cancellationToken);
        await _dbContext.InsertAuditLogAsync(CreateAuditLog(tenantId.Value, nameof(WorkTask), taskId, "TaskCompleted", request.ResultNote), cancellationToken);
        return NoContent();
    }

    [HttpPost("{taskId:guid}/close")]
    public async Task<IActionResult> Close(
        Guid taskId,
        [FromBody] CloseTaskRequest request,
        CancellationToken cancellationToken)
    {
        if (!TryGetTenantId(out var tenantId, out var error))
        {
            return error;
        }

        var exists = await _dbContext.Tasks.WhereTenant(tenantId.Value).WhereId("TaskId", taskId).AnyAsync(cancellationToken);
        if (!exists) return NotFound();

        await _dbContext.UpdateTaskClosedAsync(taskId, CurrentContext.UserId, cancellationToken);
        await _dbContext.InsertAuditLogAsync(CreateAuditLog(tenantId.Value, nameof(WorkTask), taskId, "TaskClosed", request.ClosureNote), cancellationToken);
        return NoContent();
    }

    private Domain.Entities.AuditLog CreateAuditLog(
        Guid tenantId,
        string entityType,
        Guid entityId,
        string action,
        string? details = null)
    {
        return new Domain.Entities.AuditLog
        {
            AuditLogId = Guid.NewGuid(),
            TenantId = tenantId,
            EntityType = entityType,
            EntityId = entityId.ToString(),
            Action = action,
            ActorUserId = CurrentContext.UserId,
            Details = details
        };
    }

    private static TaskDetailResponse ToDetailResponse(WorkTask task, List<Approval> approvals, List<AssignmentHistory> assignmentHistory)
    {
        return new TaskDetailResponse(
            task.TaskId,
            task.TenantId,
            task.Title,
            task.Description,
            task.TaskType.ToString(),
            task.SourceType.ToString(),
            task.Priority,
            task.CurrentStatus.ToString(),
            task.SourceRefId,
            task.TargetDepartmentId,
            task.AssignedDepartmentId,
            task.AssignedUserId,
            task.DueDateUtc,
            approvals
                .OrderBy(x => x.StepOrder)
                .Select(x => new ApprovalStepResponse(
                    x.ApprovalId,
                    x.ApproverUserId,
                    x.StepOrder,
                    x.Decision.ToString(),
                    x.DecisionDateUtc,
                    x.Comment))
                .ToArray(),
            assignmentHistory
                .OrderByDescending(x => x.ActionDateUtc)
                .Select(x => new AssignmentHistoryResponse(
                    x.AssignmentId,
                    x.FromDepartmentId,
                    x.ToDepartmentId,
                    x.FromUserId,
                    x.ToUserId,
                    x.ActionType,
                    x.ActionDateUtc))
                .ToArray());
    }
}

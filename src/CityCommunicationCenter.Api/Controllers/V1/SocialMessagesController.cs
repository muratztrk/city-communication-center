using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Domain.Entities;
using CityCommunicationCenter.Domain.Enums;
using CityCommunicationCenter.Infrastructure.Persistence;
using CityCommunicationCenter.Shared.Contracts;
using Microsoft.AspNetCore.Mvc;
using WorkflowTaskStatus = CityCommunicationCenter.Domain.Enums.TaskStatus;

namespace CityCommunicationCenter.Api.Controllers.V1;

[Route("api/v1/social/messages")]
public sealed class SocialMessagesController : ApiControllerBase
{
    private readonly CityCommunicationCenterDbContext _dbContext;

    public SocialMessagesController(
        CityCommunicationCenterDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor)
        : base(tenantContextAccessor)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
    [ProducesResponseType<IEnumerable<SocialMessageSummaryResponse>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<SocialMessageSummaryResponse>>> GetAll(CancellationToken cancellationToken)
    {
        if (!TryGetTenantId(out var tenantId, out var error))
        {
            return error;
        }

        var messages = await _dbContext.SocialMessages
            .WhereTenant(tenantId.Value)
            .ToListAsync(cancellationToken);

        var response = messages
            .OrderByDescending(x => x.ReceivedAtUtc)
            .Select(x => new SocialMessageSummaryResponse(
                x.SocialMessageId,
                x.Channel.ToString(),
                x.CitizenHandle,
                x.Category,
                x.Status.ToString(),
                x.AssignedDepartmentId,
                x.TaskId,
                x.ReceivedAtUtc))
            .ToList();

        return Ok(response);
    }

    [HttpGet("{messageId:guid}")]
    [ProducesResponseType<SocialMessageDetailResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<SocialMessageDetailResponse>> GetById(Guid messageId, CancellationToken cancellationToken)
    {
        if (!TryGetTenantId(out var tenantId, out var error))
        {
            return error;
        }

        var message = await _dbContext.SocialMessages
            .WhereTenant(tenantId.Value)
            .WhereId("SocialMessageId", messageId)
            .FirstOrDefaultAsync(cancellationToken);

        if (message is null) return NotFound();

        var response = new SocialMessageDetailResponse(
            message.SocialMessageId,
            message.TenantId,
            message.Channel.ToString(),
            message.ExternalMessageId,
            message.CitizenHandle,
            message.Content,
            message.Category,
            message.Status.ToString(),
            message.AssignedDepartmentId,
            message.TaskId,
            message.ReceivedAtUtc,
            string.IsNullOrWhiteSpace(message.Tags)
                ? Array.Empty<string>()
                : message.Tags.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));

        return Ok(response);
    }

    [HttpPost("{messageId:guid}/categorize")]
    public async Task<IActionResult> Categorize(
        Guid messageId,
        [FromBody] CategorizeSocialMessageRequest request,
        CancellationToken cancellationToken)
    {
        if (!TryGetTenantId(out var tenantId, out var error))
        {
            return error;
        }

        var exists = await _dbContext.SocialMessages
            .WhereTenant(tenantId.Value)
            .WhereId("SocialMessageId", messageId)
            .AnyAsync(cancellationToken);
        if (!exists) return NotFound();

        await _dbContext.UpdateSocialMessageCategoryAsync(messageId, request.Category, string.Join(';', request.Tags), CurrentContext.UserId, cancellationToken);
        return NoContent();
    }

    [HttpPost("{messageId:guid}/route")]
    public async Task<IActionResult> Route(
        Guid messageId,
        [FromBody] RouteSocialMessageRequest request,
        CancellationToken cancellationToken)
    {
        if (!TryGetTenantId(out var tenantId, out var error))
        {
            return error;
        }

        var exists = await _dbContext.SocialMessages
            .WhereTenant(tenantId.Value)
            .WhereId("SocialMessageId", messageId)
            .AnyAsync(cancellationToken);
        if (!exists) return NotFound();

        await _dbContext.UpdateSocialMessageRouteAsync(messageId, request.DepartmentId, CurrentContext.UserId, cancellationToken);
        return NoContent();
    }

    [HttpPost("{messageId:guid}/convert-to-task")]
    [ProducesResponseType<TaskSummaryResponse>(StatusCodes.Status201Created)]
    public async Task<ActionResult<TaskSummaryResponse>> ConvertToTask(
        Guid messageId,
        [FromBody] ConvertSocialMessageToTaskRequest request,
        CancellationToken cancellationToken)
    {
        if (!TryGetTenantId(out var tenantId, out var error))
        {
            return error;
        }

        var message = await _dbContext.SocialMessages
            .WhereTenant(tenantId.Value)
            .WhereId("SocialMessageId", messageId)
            .FirstOrDefaultAsync(cancellationToken);
        if (message is null) return NotFound();

        var task = new WorkTask
        {
            TaskId = Guid.NewGuid(),
            TenantId = tenantId.Value,
            Title = request.Title,
            Description = request.Description,
            TaskType = TaskType.CitizenRequest,
            SourceType = SourceType.SocialMessage,
            SourceRefId = message.SocialMessageId,
            TargetDepartmentId = message.AssignedDepartmentId,
            AssignedDepartmentId = message.AssignedDepartmentId,
            Priority = request.Priority,
            DueDateUtc = request.DueDateUtc,
            CurrentStatus = WorkflowTaskStatus.Draft,
            CreatedByUserId = CurrentContext.UserId
        };

        await _dbContext.InsertTaskAsync(task, cancellationToken);
        await _dbContext.UpdateSocialMessageConvertedAsync(messageId, task.TaskId, cancellationToken);

        return CreatedAtAction(
            nameof(TasksController.GetById),
            "Tasks",
            new { taskId = task.TaskId },
            new TaskSummaryResponse(
                task.TaskId,
                task.TenantId,
                task.Title,
                task.TaskType.ToString(),
                task.Priority,
                task.CurrentStatus.ToString(),
                task.TargetDepartmentId,
                task.AssignedUserId,
                task.DueDateUtc));
    }
}

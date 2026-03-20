
namespace CityCommunicationCenter.Application.Features.Tasks;

public sealed record GetTasksQuery() : IQuery<IReadOnlyList<TaskSummaryResponse>>;

public sealed class GetTasksQueryHandler : IRequestHandler<GetTasksQuery, IReadOnlyList<TaskSummaryResponse>>
{
    private readonly IApplicationDbContext _dbContext;

    public GetTasksQueryHandler(IApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<IReadOnlyList<TaskSummaryResponse>> Handle(GetTasksQuery request, CancellationToken cancellationToken)
    {
        return await _dbContext.Tasks
            .OrderByDescending(entity => entity.CreatedAtUtc)
            .Select(entity => new TaskSummaryResponse(
                entity.TaskId,
                entity.TenantId,
                entity.Title,
                entity.TaskType.ToString(),
                entity.Priority,
                entity.CurrentStatus.ToString(),
                entity.TargetDepartmentId,
                entity.AssignedUserId,
                entity.DueDateUtc))
            .ToListAsync(cancellationToken);
    }
}
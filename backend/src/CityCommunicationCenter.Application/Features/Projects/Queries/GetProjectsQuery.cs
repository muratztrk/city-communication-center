namespace CityCommunicationCenter.Application.Features.Projects;

public sealed record GetProjectsQuery(string? ProjectType) : IQuery<IReadOnlyList<ProjectSummaryResponse>>;

public sealed class GetProjectsQueryHandler : IRequestHandler<GetProjectsQuery, IReadOnlyList<ProjectSummaryResponse>>
{
    private readonly IApplicationDbContext _dbContext;

    public GetProjectsQueryHandler(IApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<IReadOnlyList<ProjectSummaryResponse>> Handle(GetProjectsQuery request, CancellationToken cancellationToken)
    {
        IQueryable<Project> query = _dbContext.Projects.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(request.ProjectType) &&
            Enum.TryParse<ProjectType>(request.ProjectType, true, out var projectType))
        {
            query = query.Where(entity => entity.ProjectType == projectType);
        }

        var projects = await query
            .OrderByDescending(entity => entity.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        var results = new List<ProjectSummaryResponse>(projects.Count);
        foreach (var project in projects)
        {
            results.Add(await ProjectSummaryResponseFactory.CreateAsync(_dbContext, project, cancellationToken));
        }

        return results;
    }
}

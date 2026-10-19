using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Application.Features.Social;
using CityCommunicationCenter.Domain.Enums;

namespace CityCommunicationCenter.Application.Features.Jobs;

public sealed record PlanJobCommand(Guid JobId, Guid? ActorUserId) : ICommand<bool>;

public sealed class PlanJobCommandHandler : ICommandHandler<PlanJobCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;
    private readonly ICitizenJobStatusNotifier? _citizenJobStatusNotifier;

    public PlanJobCommandHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor,
        ICitizenJobStatusNotifier? citizenJobStatusNotifier = null)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
        _citizenJobStatusNotifier = citizenJobStatusNotifier;
    }

    public async ValueTask<bool> Handle(PlanJobCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        var job = await _dbContext.Jobs.FirstOrDefaultAsync(
            entity => entity.JobId == request.JobId && entity.TenantId == tenantId,
            cancellationToken);
        if (job is null)
        {
            return false;
        }

        var actor = await JobWorkflowAuthorization.RequireActorAsync(
            _dbContext, request.ActorUserId, tenantId, cancellationToken);
        await EnsureCanPlanAsync(actor, job, cancellationToken);

        if (job.Status is JobStatus.Completed or JobStatus.Cancelled or JobStatus.Rejected or JobStatus.RevisionRequested)
        {
            throw Validation("Tamamlanan veya iptal edilen talep plana alınamaz.");
        }

        if (job.PlannedAtUtc.HasValue)
        {
            throw Validation("Talep zaten plana alındı.");
        }

        var openTaskCount = await _dbContext.Tasks.CountAsync(
            task => task.JobId == job.JobId
                && task.CurrentStatus != Domain.Enums.TaskStatus.Completed
                && task.CurrentStatus != Domain.Enums.TaskStatus.Cancelled
                && task.CurrentStatus != Domain.Enums.TaskStatus.Rejected,
            cancellationToken);
        if (job.Status == JobStatus.Active && openTaskCount > 0)
        {
            throw Validation("Personel atanmış talep plana alınamaz.");
        }

        var utcNow = DateTimeOffset.UtcNow;
        var previousDisplayStatus = CitizenJobStatusLabelHelper.GetDisplayStatus(job, openTaskCount, utcNow);
        job.PlannedAtUtc = utcNow;
        job.PlanRecordedAtUtc = utcNow;
        job.PlannedByDisplayName = actor.DisplayName;
        job.UpdatedAtUtc = utcNow;
        job.UpdatedByUserId = actor.UserId;
        await _dbContext.SaveChangesAsync(cancellationToken);

        if (_citizenJobStatusNotifier is not null)
        {
            await _citizenJobStatusNotifier.NotifyStatusChangedAsync(
                tenantId, job.JobId, previousDisplayStatus, cancellationToken);
        }

        return true;
    }

    private async Task EnsureCanPlanAsync(Domain.Entities.ApplicationUser actor, Domain.Entities.Job job, CancellationToken cancellationToken)
    {
        if (JobWorkflowAuthorization.IsSystemAdmin(actor))
        {
            return;
        }

        if (await JobWorkflowAuthorization.ManagesDepartmentAsync(_dbContext, actor, job.OwnerDepartmentId, cancellationToken))
        {
            return;
        }

        var targetDepartmentIds = await _dbContext.JobDepartments
            .AsNoTracking()
            .Where(link => link.JobId == job.JobId && link.Role == JobDepartmentRole.Target)
            .Select(link => link.DepartmentId)
            .ToListAsync(cancellationToken);
        foreach (var departmentId in targetDepartmentIds)
        {
            if (await JobWorkflowAuthorization.ManagesDepartmentAsync(_dbContext, actor, departmentId, cancellationToken))
            {
                return;
            }
        }

        throw new ForbiddenAccessException("Bu talebi plana alma yetkiniz yok.");
    }

    private static ValidationException Validation(string message) =>
        new([new FluentValidation.Results.ValidationFailure(nameof(PlanJobCommand.JobId), message)]);
}

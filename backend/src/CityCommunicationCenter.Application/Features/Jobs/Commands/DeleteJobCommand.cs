using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace CityCommunicationCenter.Application.Features.Jobs;

public sealed record DeleteJobCommand(Guid JobId, Guid? ActorUserId) : ICommand<bool>;

public sealed class DeleteJobCommandHandler : IRequestHandler<DeleteJobCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;

    public DeleteJobCommandHandler(IApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<bool> Handle(DeleteJobCommand request, CancellationToken cancellationToken)
    {
        var job = await _dbContext.Jobs
            .FirstOrDefaultAsync(j => j.JobId == request.JobId, cancellationToken);

        if (job is null) return false;

        var actor = await JobWorkflowAuthorization.RequireActorAsync(_dbContext, request.ActorUserId, cancellationToken);

        // Only SystemAdmin or the owner-department manager can delete
        if (actor.RoleCode is not Domain.Enums.RoleCode.SystemAdmin)
        {
            await JobWorkflowAuthorization.EnsureManagesDepartmentAsync(
                _dbContext, actor, job.OwnerDepartmentId, "Bu isi silme yetkiniz yok.", cancellationToken);
        }

        // Remove related records that have Restrict FKs
        await _dbContext.JobDepartments
            .Where(jd => jd.JobId == job.JobId)
            .ExecuteDeleteAsync(cancellationToken);

        await _dbContext.Tasks
            .Where(t => t.JobId == job.JobId)
            .ExecuteDeleteAsync(cancellationToken);

        await _dbContext.Approvals
            .Where(a => a.SubjectType == Domain.Enums.ApprovalSubjectType.Job && a.SubjectId == job.JobId)
            .ExecuteDeleteAsync(cancellationToken);

        // Unlink social messages that referenced this job
        await _dbContext.SocialMessages
            .Where(m => m.JobId == job.JobId)
            .ExecuteUpdateAsync(s => s.SetProperty(m => m.JobId, (Guid?)null), cancellationToken);

        _dbContext.AuditLogs.Add(new AuditLog
        {
            AuditLogId = Guid.NewGuid(),
            TenantId = job.TenantId,
            EntityType = nameof(Job),
            EntityId = job.JobId.ToString(),
            Action = "JobDeleted",
            ActorUserId = actor.UserId,
            Details = $"Job '{job.Title}' deleted."
        });

        _dbContext.Jobs.Remove(job);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }
}

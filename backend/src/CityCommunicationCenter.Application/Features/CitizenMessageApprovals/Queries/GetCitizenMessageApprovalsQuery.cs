using CityCommunicationCenter.Application.Features.Social;
using CityCommunicationCenter.Application.Features.Users;
using CityCommunicationCenter.Domain.Entities;

namespace CityCommunicationCenter.Application.Features.CitizenMessageApprovals.Queries;

/// <summary>
/// Vatandaşa Gönderilecek Mesaj Onayı listesi: scope `to-send` | `sent` | `all` (card #2039).
/// </summary>
public sealed record GetCitizenMessageApprovalsQuery(string? Scope) : IQuery<IReadOnlyList<CitizenMessageApprovalResponse>>;

public sealed class GetCitizenMessageApprovalsQueryHandler
    : IQueryHandler<GetCitizenMessageApprovalsQuery, IReadOnlyList<CitizenMessageApprovalResponse>>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public GetCitizenMessageApprovalsQueryHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<IReadOnlyList<CitizenMessageApprovalResponse>> Handle(
        GetCitizenMessageApprovalsQuery request,
        CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        var userId = context.UserId;

        var actor = userId.HasValue
            ? await _dbContext.Users.AsNoTracking().FirstOrDefaultAsync(u => u.UserId == userId.Value, cancellationToken)
            : null;
        if (actor is null || !CitizenMessageApprovalAccess.CanAccessPage(actor))
        {
            return [];
        }

        IQueryable<Job> q = _dbContext.Jobs
            .AsNoTracking()
            .Where(j => j.TenantId == tenantId
                && (j.Status == JobStatus.Completed || j.Status == JobStatus.Cancelled)
                // VT + WA/Çağrı: JobId veya SourceRefId ile bağlı SocialMessage (card #2036).
                && _dbContext.SocialMessages.Any(m => m.TenantId == tenantId
                    && m.CitizenRequestNumber != null
                    && (m.Channel == SocialChannel.WhatsApp || m.Channel == SocialChannel.Phone)
                    && (m.JobId == j.JobId
                        || (j.SourceRefId.HasValue && m.SocialMessageId == j.SourceRefId.Value))));

        var scope = (request.Scope ?? "to-send").Trim().ToLowerInvariant();
        q = scope switch
        {
            "sent" => q.Where(j => j.CitizenTerminalMessageReleasedAtUtc != null),
            "all" => q,
            _ => q.Where(j => j.CitizenTerminalMessageReleasedAtUtc == null),
        };

        if (actor.RoleCode == RoleCode.Manager)
        {
            var visibleDepartmentIds = await UserDepartmentAccess.GetScopedDepartmentIdsAsync(
                _dbContext, tenantId, actor, context.ActiveDepartmentId, cancellationToken);
            q = q.Where(j =>
                visibleDepartmentIds.Contains(j.OwnerDepartmentId) ||
                _dbContext.JobDepartments.Any(jd => jd.JobId == j.JobId && visibleDepartmentIds.Contains(jd.DepartmentId)));
        }
        else if (UserRoleAccess.IsCitizenRequestManager(actor))
        {
            var accessibleDepartmentIds = await UserDepartmentAccess.GetScopedDepartmentIdsAsync(
                _dbContext, tenantId, actor, context.ActiveDepartmentId, cancellationToken);
            q = q.Where(j => _dbContext.JobDepartments.Any(jd => jd.JobId == j.JobId
                && jd.Role == JobDepartmentRole.Target
                && accessibleDepartmentIds.Contains(jd.DepartmentId)));
        }
        // SystemAdmin: no additional scoping.

        var jobs = await q.OrderByDescending(j => j.CreatedAtUtc).ToListAsync(cancellationToken);
        if (jobs.Count == 0)
        {
            return [];
        }

        var jobIds = jobs.Select(j => j.JobId).ToArray();
        var sourceRefIds = jobs
            .Where(j => j.SourceRefId.HasValue)
            .Select(j => j.SourceRefId!.Value)
            .Distinct()
            .ToArray();
        var messages = await _dbContext.SocialMessages
            .AsNoTracking()
            .Where(m => m.TenantId == tenantId
                && ((m.JobId.HasValue && jobIds.Contains(m.JobId.Value))
                    || sourceRefIds.Contains(m.SocialMessageId)))
            .OrderByDescending(m => m.ReceivedAtUtc)
            .ToListAsync(cancellationToken);
        var messageByJobId = new Dictionary<Guid, SocialMessage>();
        foreach (var job in jobs)
        {
            var linked = messages.FirstOrDefault(m => m.JobId == job.JobId)
                ?? (job.SourceRefId.HasValue
                    ? messages.FirstOrDefault(m => m.SocialMessageId == job.SourceRefId.Value)
                    : null);
            if (linked is not null)
            {
                messageByJobId[job.JobId] = linked;
            }
        }

        var ownerNames = await _dbContext.Departments
            .AsNoTracking()
            .Where(d => d.TenantId == tenantId)
            .Select(d => new { d.DepartmentId, d.Name })
            .ToDictionaryAsync(d => d.DepartmentId, d => d.Name, cancellationToken);

        var results = new List<CitizenMessageApprovalResponse>(jobs.Count);
        foreach (var job in jobs)
        {
            if (!messageByJobId.TryGetValue(job.JobId, out var message))
            {
                continue;
            }

            var note = await CitizenMessageApprovalNoteResolver.ResolveAsync(_dbContext, tenantId, job, cancellationToken);
            results.Add(new CitizenMessageApprovalResponse(
                job.JobId,
                message.SocialMessageId,
                message.Channel.ToString(),
                message.CitizenRequestNumber,
                message.CitizenRequestNumberYear,
                message.ReceivedAtUtc,
                job.CitizenName,
                job.CitizenPhone,
                job.Title,
                job.DueDateUtc,
                job.Status.ToString(),
                note,
                job.OwnerDepartmentId,
                ownerNames.GetValueOrDefault(job.OwnerDepartmentId),
                job.CitizenTerminalMessageReleasedAtUtc,
                job.CompletedAtUtc,
                job.UpdatedAtUtc));
        }

        return results;
    }
}

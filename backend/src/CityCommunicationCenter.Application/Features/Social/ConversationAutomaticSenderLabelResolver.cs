using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Domain.Enums;

namespace CityCommunicationCenter.Application.Features.Social;

public static class ConversationAutomaticSenderLabelResolver
{
    public static async Task<IReadOnlyDictionary<Guid, string>> ResolveTargetDepartmentNamesByMessageIdAsync(
        IApplicationDbContext dbContext,
        Guid tenantId,
        IReadOnlyCollection<Guid> messageIds,
        CancellationToken cancellationToken)
    {
        if (messageIds.Count == 0)
        {
            return new Dictionary<Guid, string>();
        }

        var messages = await dbContext.SocialMessages
            .AsNoTracking()
            .Where(message => message.TenantId == tenantId && messageIds.Contains(message.SocialMessageId))
            .Select(message => new
            {
                message.SocialMessageId,
                message.JobId,
                AssignedName = message.AssignedDepartment != null ? message.AssignedDepartment.Name : null,
            })
            .ToListAsync(cancellationToken);

        var jobIds = messages
            .Where(message => message.JobId.HasValue)
            .Select(message => message.JobId!.Value)
            .Distinct()
            .ToList();

        var namesByJobId = new Dictionary<Guid, string>();
        if (jobIds.Count > 0)
        {
            var rows = await dbContext.JobDepartments
                .AsNoTracking()
                .Where(link => link.TenantId == tenantId
                    && jobIds.Contains(link.JobId)
                    && link.Role == JobDepartmentRole.Target
                    && link.ApprovalStatus != JobApprovalStatus.Rejected)
                .Select(link => new { link.JobId, link.Department.Name })
                .ToListAsync(cancellationToken);

            namesByJobId = rows
                .GroupBy(row => row.JobId)
                .ToDictionary(
                    group => group.Key,
                    group => string.Join(", ", group.Select(row => row.Name).Distinct().OrderBy(name => name)));
        }

        var result = new Dictionary<Guid, string>();
        foreach (var message in messages)
        {
            if (message.JobId is Guid jobId
                && namesByJobId.TryGetValue(jobId, out var jobNames)
                && !string.IsNullOrWhiteSpace(jobNames))
            {
                result[message.SocialMessageId] = jobNames;
                continue;
            }

            if (!string.IsNullOrWhiteSpace(message.AssignedName))
            {
                result[message.SocialMessageId] = message.AssignedName;
            }
        }

        return result;
    }
}

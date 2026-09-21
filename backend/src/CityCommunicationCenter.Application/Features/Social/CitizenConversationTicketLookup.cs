using CityCommunicationCenter.Domain.Enums;

namespace CityCommunicationCenter.Application.Features.Social;

internal static class CitizenConversationTicketLookup
{
    internal sealed record TicketRow(
        Guid SocialMessageId,
        DateTimeOffset ReceivedAtUtc,
        Guid? JobId,
        Guid? DepartmentId);

    public static async Task<IReadOnlyList<TicketRow>> GetTicketsForConversationAsync(
        IApplicationDbContext dbContext,
        Guid tenantId,
        Guid citizenConversationId,
        CancellationToken cancellationToken)
    {
        var conversation = await dbContext.CitizenConversations
            .AsNoTracking()
            .Where(c => c.CitizenConversationId == citizenConversationId && c.TenantId == tenantId)
            .Select(c => new { c.CitizenPhone })
            .FirstOrDefaultAsync(cancellationToken);

        if (conversation is null)
        {
            return [];
        }

        var phoneVariants = CitizenConversationPhoneNormalizer.Variants(conversation.CitizenPhone).ToList();
        var relatedConversationIds = phoneVariants.Count == 0
            ? [citizenConversationId]
            : await dbContext.CitizenConversations
                .AsNoTracking()
                .Where(c => c.TenantId == tenantId && phoneVariants.Contains(c.CitizenPhone))
                .Select(c => c.CitizenConversationId)
                .ToListAsync(cancellationToken);
        if (relatedConversationIds.Count == 0)
        {
            relatedConversationIds = [citizenConversationId];
        }

        var linkedMessageIds = await dbContext.SocialMessages
            .AsNoTracking()
            .Where(m => m.TenantId == tenantId
                && m.CitizenRequestNumber != null
                && m.CitizenConversationId != null
                && relatedConversationIds.Contains(m.CitizenConversationId.Value))
            .Select(m => m.SocialMessageId)
            .ToListAsync(cancellationToken);

        var unlinkedCandidates = await dbContext.SocialMessages
            .AsNoTracking()
            .Where(m => m.TenantId == tenantId
                && m.CitizenRequestNumber != null
                && (m.CitizenConversationId == null
                    || !relatedConversationIds.Contains(m.CitizenConversationId.Value)))
            .Select(m => new
            {
                m.SocialMessageId,
                m.CitizenHandle,
                JobPhone = m.Job != null ? m.Job.CitizenPhone : null,
            })
            .ToListAsync(cancellationToken);

        var ticketMessageIds = linkedMessageIds
            .Concat(unlinkedCandidates
                .Where(m => CitizenConversationPhoneNormalizer.MatchesConversationPhone(m.JobPhone, conversation.CitizenPhone)
                    || CitizenConversationPhoneNormalizer.MatchesConversationPhone(m.CitizenHandle, conversation.CitizenPhone))
                .Select(m => m.SocialMessageId))
            .Distinct()
            .ToList();

        if (ticketMessageIds.Count == 0)
        {
            return [];
        }

        return await dbContext.SocialMessages
            .AsNoTracking()
            .Where(m => ticketMessageIds.Contains(m.SocialMessageId))
            .Select(m => new TicketRow(
                m.SocialMessageId,
                m.ReceivedAtUtc,
                m.JobId,
                m.Job != null
                    ? m.Job.Departments
                        .Where(d => d.Role == JobDepartmentRole.Target)
                        .OrderBy(d => d.RequestedAtUtc)
                        .Select(d => (Guid?)d.DepartmentId)
                        .FirstOrDefault()
                    : m.AssignedDepartmentId))
            .ToListAsync(cancellationToken);
    }

    public static TicketRow? ResolveLatestTicketForDepartment(
        IReadOnlyList<TicketRow> tickets,
        Guid departmentId) =>
        tickets
            .Where(ticket => ticket.DepartmentId == departmentId && ticket.JobId.HasValue)
            .OrderByDescending(ticket => ticket.ReceivedAtUtc)
            .FirstOrDefault();
}

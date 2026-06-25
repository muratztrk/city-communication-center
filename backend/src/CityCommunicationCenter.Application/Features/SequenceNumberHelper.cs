namespace CityCommunicationCenter.Application.Features;

internal static class SequenceNumberHelper
{
    public static async Task<int> NextJobNumberAsync(
        IApplicationDbContext dbContext,
        Guid tenantId,
        int year,
        CancellationToken cancellationToken)
    {
        var max = await dbContext.Jobs
            .Where(j => j.TenantId == tenantId && j.JobNumberYear == year)
            .MaxAsync(j => (int?)j.JobNumber, cancellationToken) ?? 0;
        return max + 1;
    }

    public static async Task<int> NextTaskNumberAsync(
        IApplicationDbContext dbContext,
        Guid tenantId,
        int year,
        CancellationToken cancellationToken)
    {
        var max = await dbContext.Tasks
            .Where(t => t.TenantId == tenantId && t.TaskNumberYear == year)
            .MaxAsync(t => (int?)t.TaskNumber, cancellationToken) ?? 0;
        return max + 1;
    }

    public static async Task<int> NextCitizenRequestNumberAsync(
        IApplicationDbContext dbContext,
        Guid tenantId,
        int year,
        CancellationToken cancellationToken)
    {
        var max = await dbContext.SocialMessages
            .Where(m => m.TenantId == tenantId && m.CitizenRequestNumberYear == year)
            .MaxAsync(m => (int?)m.CitizenRequestNumber, cancellationToken) ?? 0;
        return max + 1;
    }
}

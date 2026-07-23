namespace CityCommunicationCenter.Application.Features.Reports;

/// <summary>
/// Vatandaş kontrol paneli (dashboard) grafiklerinin VT (Vatandaş Talebi) filtrelemesi
/// (cards #1845/#1849). Bir Job yalnızca bağlı bir <see cref="SocialMessage"/> üzerinde
/// <c>CitizenRequestNumber</c> doluysa VT sayılır; <c>RequestType=Citizen</c> tek başına
/// yeterli değildir (manuel/rutin oluşturulan Citizen job'lar VT numarası taşımayabilir).
/// </summary>
internal static class CitizenVtJobFilter
{
    public static IQueryable<Job> WhereHasCitizenRequestNumber(this IQueryable<Job> jobs, IApplicationDbContext dbContext) =>
        jobs.Where(job => dbContext.SocialMessages.Any(message =>
            message.JobId == job.JobId && message.CitizenRequestNumber != null));
}

namespace CityCommunicationCenter.Application.Features.Reports;

/// <summary>
/// Vatandaş kontrol paneli (dashboard) grafiklerinin VT (Vatandaş Talebi) filtrelemesi
/// (cards #1845/#1849/#2570). Bir Job yalnızca bağlı bir <see cref="SocialMessage"/> üzerinde
/// <c>CitizenRequestNumber</c> doluysa VT sayılır; <c>RequestType=Citizen</c> tek başına
/// yeterli değildir (manuel/rutin oluşturulan Citizen job'lar VT numarası taşımayabilir).
/// Birimler pie'ları tersini kullanır: RequestType, kaynak tipi ve VT numarası birlikte dışlanır.
/// </summary>
internal static class CitizenVtJobFilter
{
    public static IQueryable<Job> WhereHasCitizenRequestNumber(this IQueryable<Job> jobs, IApplicationDbContext dbContext) =>
        jobs.Where(job => dbContext.SocialMessages.Any(message =>
            message.JobId == job.JobId && message.CitizenRequestNumber != null));

    /// <summary>
    /// Anasayfa-Birimler pie/drilldown: vatandaş talebi verisi taşıyan job'ları dışlar (#2570).
    /// <c>RequestType != Citizen</c> yetmez — VT numaralı veya WA/çağrı/e-Devlet kaynaklı
    /// InternalUnit/ExternalUnit job'lar da vatandaş verisidir.
    /// </summary>
    public static IQueryable<Job> WhereIsNotCitizenSourced(this IQueryable<Job> jobs, IApplicationDbContext dbContext) =>
        jobs.Where(job =>
            job.RequestType != JobRequestType.Citizen
            && job.SourceType != JobSourceType.SocialMessage
            && job.SourceType != JobSourceType.CitizenRequest
            && job.SourceType != JobSourceType.EDevlet
            && !dbContext.SocialMessages.Any(message =>
                message.JobId == job.JobId && message.CitizenRequestNumber != null));

    public static IQueryable<JobDepartment> WhereJobIsNotCitizenSourced(
        this IQueryable<JobDepartment> links,
        IApplicationDbContext dbContext) =>
        links.Where(link =>
            link.Job.RequestType != JobRequestType.Citizen
            && link.Job.SourceType != JobSourceType.SocialMessage
            && link.Job.SourceType != JobSourceType.CitizenRequest
            && link.Job.SourceType != JobSourceType.EDevlet
            && !dbContext.SocialMessages.Any(message =>
                message.JobId == link.Job.JobId && message.CitizenRequestNumber != null));
}

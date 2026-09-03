using CityCommunicationCenter.Domain.Entities;
using CityCommunicationCenter.Shared.FileStorage;

namespace CityCommunicationCenter.Application.Features.Attachments;

internal static class AttachmentNasPathResolver
{
    public static bool SupportsNasReplication(string entityType) =>
        entityType is "Job" or "Task";

    public static async Task<string?> TryBuildRelativePathAsync(
        IApplicationDbContext dbContext,
        Guid tenantId,
        string entityType,
        Guid entityId,
        string originalFileName,
        CancellationToken cancellationToken)
    {
        if (!SupportsNasReplication(entityType))
        {
            return null;
        }

        var job = await ResolveJobAsync(dbContext, tenantId, entityType, entityId, cancellationToken);
        if (job is null)
        {
            return null;
        }

        var citizenNumbers = await dbContext.SocialMessages
            .AsNoTracking()
            .Where(message => message.JobId == job.JobId && message.CitizenRequestNumber != null)
            .OrderByDescending(message => message.CitizenRequestNumberYear)
            .ThenByDescending(message => message.CitizenRequestNumber)
            .Select(message => new { message.CitizenRequestNumber, message.CitizenRequestNumberYear })
            .FirstOrDefaultAsync(cancellationToken);

        var requestFolder = JobRequestNumberFormatter.Format(
            job.RequestType,
            job.SourceType,
            job.JobNumber,
            job.JobNumberYear,
            citizenNumbers?.CitizenRequestNumber,
            citizenNumbers?.CitizenRequestNumberYear,
            job.CreatedAtUtc);

        var existingNames = await GetExistingNasFileNamesForJobAsync(
            dbContext,
            tenantId,
            job.JobId,
            cancellationToken);
        var fileName = AttachmentNasPath.AllocateUniqueFileName(originalFileName, existingNames);
        return AttachmentNasPath.BuildRelativePath(requestFolder, fileName);
    }

    public static string ResolveDeleteRelativePath(Attachment attachment)
    {
        if (!string.IsNullOrWhiteSpace(attachment.NasRelativePath))
        {
            return attachment.NasRelativePath;
        }

        return AttachmentNasPath.BuildLegacyRelativePath(
            attachment.TenantId,
            attachment.EntityType,
            attachment.EntityId,
            attachment.StoredFileName);
    }

    private static async Task<Job?> ResolveJobAsync(
        IApplicationDbContext dbContext,
        Guid tenantId,
        string entityType,
        Guid entityId,
        CancellationToken cancellationToken)
    {
        if (entityType == "Job")
        {
            return await dbContext.Jobs
                .AsNoTracking()
                .FirstOrDefaultAsync(job => job.TenantId == tenantId && job.JobId == entityId, cancellationToken);
        }

        if (entityType == "Task")
        {
            return await (
                from task in dbContext.Tasks.AsNoTracking()
                join job in dbContext.Jobs.AsNoTracking() on task.JobId equals job.JobId
                where task.TenantId == tenantId && task.TaskId == entityId
                select job).FirstOrDefaultAsync(cancellationToken);
        }

        return null;
    }

    private static async Task<HashSet<string>> GetExistingNasFileNamesForJobAsync(
        IApplicationDbContext dbContext,
        Guid tenantId,
        Guid jobId,
        CancellationToken cancellationToken)
    {
        var taskIds = await dbContext.Tasks
            .AsNoTracking()
            .Where(task => task.TenantId == tenantId && task.JobId == jobId)
            .Select(task => task.TaskId)
            .ToListAsync(cancellationToken);

        var attachments = await dbContext.Attachments
            .AsNoTracking()
            .Where(attachment =>
                attachment.TenantId == tenantId
                && (
                    (attachment.EntityType == "Job" && attachment.EntityId == jobId)
                    || (attachment.EntityType == "Task" && taskIds.Contains(attachment.EntityId))))
            .Select(attachment => new { attachment.NasRelativePath, attachment.FileName })
            .ToListAsync(cancellationToken);

        var names = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var attachment in attachments)
        {
            if (!string.IsNullOrWhiteSpace(attachment.NasRelativePath))
            {
                names.Add(Path.GetFileName(attachment.NasRelativePath.Replace('\\', '/')));
                continue;
            }

            names.Add(AttachmentNasPath.SanitizeFileName(attachment.FileName));
        }

        return names;
    }
}

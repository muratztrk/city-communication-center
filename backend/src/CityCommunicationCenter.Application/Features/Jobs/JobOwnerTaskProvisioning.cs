using System.Text.Json;
using CityCommunicationCenter.Application.Features.Users;

namespace CityCommunicationCenter.Application.Features.Jobs;

internal static class JobOwnerTaskProvisioning
{
    private const string OwnerTaskNotesPrefix = "ccc:owner-task-request:v1:";

    private sealed record OwnerTaskRequest(Guid[] OwnerUserIds);

    public static string? CreateOwnerTaskNotes(IReadOnlyCollection<Guid> ownerUserIds)
    {
        var ids = ownerUserIds
            .Where(id => id != Guid.Empty)
            .Distinct()
            .ToArray();

        return ids.Length == 0
            ? null
            : OwnerTaskNotesPrefix + JsonSerializer.Serialize(new OwnerTaskRequest(ids));
    }

    public static async Task<int> EnsureOwnerTasksAsync(
        IApplicationDbContext dbContext,
        Guid tenantId,
        Job job,
        Guid assigningManagerId,
        DateTimeOffset utcNow,
        CancellationToken cancellationToken)
    {
        var ownerUserIds = await GetRequestedOwnerUserIdsAsync(dbContext, job.JobId, cancellationToken);
        if (ownerUserIds.Length == 0) return 0;

        var ownerUsers = await dbContext.Users
            .Where(u => u.TenantId == tenantId && ownerUserIds.Contains(u.UserId))
            .ToArrayAsync(cancellationToken);

        if (ownerUsers.Length != ownerUserIds.Length || ownerUsers.Any(u => !u.IsActive))
        {
            throw new ValidationException([
                new FluentValidation.Results.ValidationFailure(nameof(JobDepartment.Notes), "Secilen gorev sahibi kullanicilardan biri bulunamadi veya aktif degil.")
            ]);
        }

        foreach (var ownerUser in ownerUsers)
        {
            if (!await UserDepartmentAccess.CanWorkInDepartmentAsync(dbContext, tenantId, ownerUser, job.OwnerDepartmentId, cancellationToken))
            {
                throw new ValidationException([
                    new FluentValidation.Results.ValidationFailure(nameof(JobDepartment.Notes), "Secilen gorev sahibi kullanicilar sahip mudurlukte calismali.")
                ]);
            }
        }

        var existingOwnerUserIds = await dbContext.Tasks
            .Where(task => task.TenantId == tenantId
                && task.JobId == job.JobId
                && task.OwnerUserId.HasValue
                && ownerUserIds.Contains(task.OwnerUserId.Value))
            .Select(task => task.OwnerUserId!.Value)
            .ToListAsync(cancellationToken);

        var existingOwnerUserIdSet = existingOwnerUserIds.ToHashSet();
        var createdCount = 0;

        var taskYear = utcNow.Year;
        foreach (var ownerUser in ownerUsers.Where(user => !existingOwnerUserIdSet.Contains(user.UserId)))
        {
            var taskNumber = await SequenceNumberHelper.NextTaskNumberAsync(dbContext, tenantId, taskYear, cancellationToken);
            var task = new WorkTask
            {
                TaskId = Guid.NewGuid(),
                TenantId = tenantId,
                JobId = job.JobId,
                Title = job.Title,
                Description = job.Description,
                AssignedDepartmentId = job.OwnerDepartmentId,
                AssignedUserId = ownerUser.UserId,
                AssigningManagerId = assigningManagerId,
                OwnerUserId = ownerUser.UserId,
                CurrentStatus = CityCommunicationCenter.Domain.Enums.TaskStatus.Assigned,
                Priority = job.Priority,
                StartDateUtc = job.StartDateUtc,
                DueDateUtc = job.DueDateUtc,
                CreatedByUserId = job.CreatedByUserId,
                TaskNumber = taskNumber,
                TaskNumberYear = taskYear
            };

            dbContext.Tasks.Add(task);
            dbContext.AuditLogs.Add(new AuditLog
            {
                AuditLogId = Guid.NewGuid(),
                TenantId = tenantId,
                EntityType = nameof(WorkTask),
                EntityId = task.TaskId.ToString(),
                Action = "TaskCreated",
                ActorUserId = assigningManagerId,
                Details = $"Created after job owner approval. AssignedUser={ownerUser.UserId}",
                EventTimeUtc = utcNow,
                CreatedAtUtc = utcNow
            });
            createdCount++;
        }

        return createdCount;
    }

    private static async Task<Guid[]> GetRequestedOwnerUserIdsAsync(
        IApplicationDbContext dbContext,
        Guid jobId,
        CancellationToken cancellationToken)
    {
        var notes = await dbContext.JobDepartments
            .AsNoTracking()
            .Where(department => department.JobId == jobId && department.Role == JobDepartmentRole.Owner)
            .Select(department => department.Notes)
            .FirstOrDefaultAsync(cancellationToken);

        if (string.IsNullOrWhiteSpace(notes) || !notes.StartsWith(OwnerTaskNotesPrefix, StringComparison.Ordinal))
        {
            return [];
        }

        try
        {
            var payload = notes[OwnerTaskNotesPrefix.Length..];
            return JsonSerializer.Deserialize<OwnerTaskRequest>(payload)?.OwnerUserIds
                .Where(id => id != Guid.Empty)
                .Distinct()
                .ToArray() ?? [];
        }
        catch (JsonException)
        {
            throw new ValidationException([
                new FluentValidation.Results.ValidationFailure(nameof(JobDepartment.Notes), "Gorev sahibi bilgisi okunamadi.")
            ]);
        }
    }
}

namespace CityCommunicationCenter.Application.Abstractions;

public interface ISlaCalculatorService
{
    /// <summary>
    /// Calculates the SLA due date from <paramref name="startUtc"/>, advancing <paramref name="slaHours"/> hours
    /// while optionally skipping Saturdays and Sundays based on tenant settings.
    /// If <paramref name="departmentId"/> is in the exempt list, weekends are counted normally.
    /// </summary>
    Task<DateTimeOffset> CalculateDueDateAsync(
        DateTimeOffset startUtc,
        int slaHours,
        Guid tenantId,
        Guid? departmentId = null,
        CancellationToken cancellationToken = default);
}

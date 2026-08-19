using CityCommunicationCenter.Domain.Enums;

namespace CityCommunicationCenter.Application.Features.Reports;

/// <summary>
/// Vatandaş talebi dashboard sınıflandırması — pie grafik, WA konuşma sayıları ve FE ile aynı kurallar.
/// </summary>
internal static class CitizenVtDashboardClassification
{
    internal enum DisplayStatus
    {
        ProcessingReceived,
        InProgress,
        Overdue,
        Completed,
        Cancelled,
    }

    internal sealed record JobSlice(JobStatus Status, DateTimeOffset? DueDateUtc, int OpenTaskCount);

    internal static bool IsPastDue(DateTimeOffset? dueDateUtc, DateTimeOffset now) =>
        dueDateUtc.HasValue && dueDateUtc.Value < now;

    internal static DisplayStatus Classify(JobSlice job, DateTimeOffset now)
    {
        if (job.Status == JobStatus.Completed)
        {
            return DisplayStatus.Completed;
        }

        if (job.Status is JobStatus.Cancelled or JobStatus.Rejected or JobStatus.RevisionRequested)
        {
            return DisplayStatus.Cancelled;
        }

        if (job.Status == JobStatus.Active && job.OpenTaskCount > 0)
        {
            if (IsPastDue(job.DueDateUtc, now))
            {
                return DisplayStatus.Overdue;
            }

            return DisplayStatus.InProgress;
        }

        // Onaylanmadı / açık görev yok — gecikmiş olsa da İşleme Alındı (#2805 / #2812 / #2860).
        return DisplayStatus.ProcessingReceived;
    }

    internal static bool IsProcessingReceived(JobSlice job, DateTimeOffset now) =>
        Classify(job, now) == DisplayStatus.ProcessingReceived;

    internal static bool IsInProgressBucket(JobSlice job, DateTimeOffset now) =>
        Classify(job, now) is DisplayStatus.InProgress or DisplayStatus.Overdue;

    /// <summary>
    /// Vatandaş Talepleri pie + drilldown: Geciken = tüm açık taleplerde son tarih geçmiş
    /// (İşleme Alındı geciken dahil). İşleme Alındı dilimi gecikenleri içermez (#2888/#2889).
    /// WA konuşma sayıları <see cref="Classify"/> kullanmaya devam eder.
    /// </summary>
    internal static DisplayStatus ClassifyCitizenRequestsPie(JobSlice job, DateTimeOffset now)
    {
        var display = Classify(job, now);
        if (display is DisplayStatus.Completed or DisplayStatus.Cancelled)
        {
            return display;
        }

        if (IsPastDue(job.DueDateUtc, now))
        {
            return DisplayStatus.Overdue;
        }

        return display;
    }
}

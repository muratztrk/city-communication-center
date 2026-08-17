using CityCommunicationCenter.Domain.Enums;

namespace CityCommunicationCenter.Application.Features.Reports;

/// <summary>
/// Vatandaş talebi dashboard sınıflandırması — pie grafik ve üst metrik kartı ile aynı kurallar.
/// </summary>
internal static class CitizenVtDashboardClassification
{
    internal sealed record JobSlice(JobStatus Status, DateTimeOffset? DueDateUtc, int OpenTaskCount);

    internal static bool IsProcessingReceived(JobSlice job, DateTimeOffset now)
    {
        if (job.Status == JobStatus.Completed)
        {
            return false;
        }

        if (job.Status is JobStatus.Cancelled or JobStatus.Rejected or JobStatus.RevisionRequested)
        {
            return false;
        }

        if (job.Status == JobStatus.Active && job.OpenTaskCount > 0)
        {
            return false;
        }

        // Onaylanmadı / açık görev yok — gecikmiş olsa da İşleme Alındı (#2805 / #2812).
        return true;
    }
}

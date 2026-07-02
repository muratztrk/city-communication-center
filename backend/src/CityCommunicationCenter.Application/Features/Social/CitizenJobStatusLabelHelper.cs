using CityCommunicationCenter.Domain.Entities;
using CityCommunicationCenter.Domain.Enums;

namespace CityCommunicationCenter.Application.Features.Social;

public static class CitizenJobStatusLabelHelper
{
    public static string GetDisplayStatus(Job job, int taskCount, DateTimeOffset utcNow)
    {
        if (job.Status == JobStatus.Completed) return "Tamamlanmış";
        if (job.Status == JobStatus.Cancelled) return "İptal";
        if (job.Status == JobStatus.Rejected) return "Reddedildi";
        if (job.Status == JobStatus.RevisionRequested) return "İade Edildi";
        if (job.DueDateUtc.HasValue && job.DueDateUtc.Value < utcNow) return "Son Tarihi Geçmiş";
        if (job.Status == JobStatus.Active && taskCount > 0) return "Yapılmakta";

        return "İşleme Alındı";
    }

    public static string BuildStatusMessage(SocialMessage message, Job job, int taskCount, DateTimeOffset utcNow)
    {
        return BuildStatusMessage(message, job, taskCount, utcNow, null);
    }

    public static string BuildStatusMessage(SocialMessage message, Job job, int taskCount, DateTimeOffset utcNow, string? template)
    {
        var requestNumber = ConversationEntrySenderLabelHelper.FormatCitizenRequestNumber(
            message.CitizenRequestNumber,
            message.CitizenRequestNumberYear,
            message.ReceivedAtUtc);
        var statusLabel = GetDisplayStatus(job, taskCount, utcNow);
        var title = string.IsNullOrWhiteSpace(job.Title) ? "talebiniz" : job.Title.Trim();
        var messageTemplate = string.IsNullOrWhiteSpace(template)
            ? "{VatandaşTalepNo} no'lu {VatandaşTalepBaşlığı} talebinizin durumu {VatandaşTalepDurumu}."
            : template;

        return messageTemplate
            .Replace("{VatandaşTalepNo}", requestNumber, StringComparison.Ordinal)
            .Replace("{Vatandaş Talep No}", requestNumber, StringComparison.Ordinal)
            .Replace("{VatandaşTalepBaşlığı}", title, StringComparison.Ordinal)
            .Replace("{Vatandaş Talep Başlığı}", title, StringComparison.Ordinal)
            .Replace("{VatandaşTalepDurumu}", statusLabel, StringComparison.Ordinal)
            .Replace("{Vatandaş Talep Durumu}", statusLabel, StringComparison.Ordinal);
    }
}

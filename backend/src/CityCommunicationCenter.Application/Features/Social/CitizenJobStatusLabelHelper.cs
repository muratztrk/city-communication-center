using CityCommunicationCenter.Domain.Entities;
using CityCommunicationCenter.Domain.Enums;

namespace CityCommunicationCenter.Application.Features.Social;

public static class CitizenJobStatusLabelHelper
{
    public static string GetDisplayStatus(Job job, int taskCount, DateTimeOffset utcNow)
    {
        return GetDisplayStatus(job.Status, job.DueDateUtc, taskCount, utcNow);
    }

    public static string GetDisplayStatus(JobStatus status, DateTimeOffset? dueDateUtc, int taskCount, DateTimeOffset utcNow)
    {
        if (status == JobStatus.Completed) return "Tamamlanmış";
        if (status == JobStatus.Cancelled) return "İptal";
        if (status == JobStatus.Rejected) return "Reddedildi";
        if (status == JobStatus.RevisionRequested) return "İade Edildi";
        if (dueDateUtc.HasValue && dueDateUtc.Value < utcNow) return "Son Tarihi Geçmiş";
        if (status == JobStatus.Active && taskCount > 0) return "Yapılmakta";

        return "İşleme Alındı";
    }

    public static string BuildStatusMessage(SocialMessage message, Job job, int taskCount, DateTimeOffset utcNow)
    {
        return BuildStatusMessage(message, job, taskCount, utcNow, null);
    }

    public static string BuildStatusMessage(
        SocialMessage message,
        Job job,
        int taskCount,
        DateTimeOffset utcNow,
        string? template,
        string? targetDepartmentNames = null)
    {
        var requestNumber = ConversationEntrySenderLabelHelper.FormatCitizenRequestNumber(
            message.CitizenRequestNumber,
            message.CitizenRequestNumberYear,
            message.ReceivedAtUtc);
        var statusLabel = GetDisplayStatus(job, taskCount, utcNow);
        var title = string.IsNullOrWhiteSpace(job.Title) ? "talebiniz" : job.Title.Trim();
        var targetDepartments = string.IsNullOrWhiteSpace(targetDepartmentNames)
            ? "İlgili birim"
            : targetDepartmentNames.Trim();
        var messageTemplate = string.IsNullOrWhiteSpace(template)
            ? "{VatandaşTalepNo} no'lu {VatandaşTalepBaşlığı} talebinizin durumu {VatandaşTalepDurumu}. {GönderilenBirim}"
            : template;

        var content = messageTemplate
            .Replace("{VatandaşTalepNo}", requestNumber, StringComparison.Ordinal)
            .Replace("{Vatandaş Talep No}", requestNumber, StringComparison.Ordinal)
            .Replace("{VatandaşTalepBaşlığı}", title, StringComparison.Ordinal)
            .Replace("{Vatandaş Talep Başlığı}", title, StringComparison.Ordinal)
            .Replace("{VatandaşTalepDurumu}", statusLabel, StringComparison.Ordinal)
            .Replace("{Vatandaş Talep Durumu}", statusLabel, StringComparison.Ordinal);

        return ReplaceTargetDepartmentToken(content, targetDepartments).Trim();
    }

    private static string ReplaceTargetDepartmentToken(string template, string targetDepartments)
    {
        // Token sonrasına otomatik ayraç EKLENMEZ; şablon metni ne ise o korunur —
        // "…{GönderilenBirim}'ne iletilmiştir." bitişik kalmalıdır (card #1598 2. reopen).
        return template
            .Replace("{GönderilenBirim}", targetDepartments, StringComparison.Ordinal)
            .Replace("{Gönderilen Birim}", targetDepartments, StringComparison.Ordinal);
    }
}

namespace CityCommunicationCenter.Application.Features.Jobs;

/// <summary>
/// Mesai dışı yönetici/personel SMS şablonları — Teknomart aynı gövdeyi reddeder (#3751).
/// </summary>
public static class AfterHoursSmsTemplateRenderer
{
    public static string Render(
        string template,
        string requestNumber,
        string? jobTitle,
        string? taskNumber = null,
        string? taskTitle = null)
    {
        var title = jobTitle?.Trim() ?? string.Empty;
        var resolvedTaskNumber = string.IsNullOrWhiteSpace(taskNumber) ? requestNumber : taskNumber.Trim();
        var resolvedTaskTitle = string.IsNullOrWhiteSpace(taskTitle) ? title : taskTitle.Trim();
        var body = template
            .Replace("{VatandaşTalepNo}", requestNumber, StringComparison.Ordinal)
            .Replace("{VatandaşTalepBaşlığı}", title, StringComparison.Ordinal)
            .Replace("{GörevNo}", resolvedTaskNumber, StringComparison.Ordinal)
            .Replace("{GörevBaşlığı}", resolvedTaskTitle, StringComparison.Ordinal);

        var hasIdentity = body.Contains(requestNumber, StringComparison.Ordinal)
            || body.Contains(resolvedTaskNumber, StringComparison.Ordinal);
        if (!hasIdentity)
        {
            body = string.IsNullOrWhiteSpace(title)
                ? $"{body.TrimEnd()}\n\nTalep: {requestNumber}"
                : $"{body.TrimEnd()}\n\nTalep: {requestNumber} — {title}";
        }

        return body;
    }
}

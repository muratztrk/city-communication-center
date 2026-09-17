namespace CityCommunicationCenter.Application.Features.Jobs;

/// <summary>
/// Mesai dışı yönetici/personel SMS şablonları — Teknomart aynı gövdeyi reddeder (#3751).
/// </summary>
public static class AfterHoursSmsTemplateRenderer
{
    public static string Render(string template, string requestNumber, string? jobTitle)
    {
        var title = jobTitle?.Trim() ?? string.Empty;
        var body = template
            .Replace("{VatandaşTalepNo}", requestNumber, StringComparison.Ordinal)
            .Replace("{VatandaşTalepBaşlığı}", title, StringComparison.Ordinal);

        if (!body.Contains(requestNumber, StringComparison.Ordinal))
        {
            body = string.IsNullOrWhiteSpace(title)
                ? $"{body.TrimEnd()}\n\nTalep: {requestNumber}"
                : $"{body.TrimEnd()}\n\nTalep: {requestNumber} — {title}";
        }

        return body;
    }
}

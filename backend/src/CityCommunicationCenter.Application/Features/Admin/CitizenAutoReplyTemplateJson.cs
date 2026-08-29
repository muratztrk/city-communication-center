using System.Text.Json;
using CityCommunicationCenter.Application.Common;
using CityCommunicationCenter.Application.Features.Social;

namespace CityCommunicationCenter.Application.Features.Admin;

/// <summary>
/// Durum bazlı hitap satırları. Boş bırakılan durum, tenant genel hitabına düşer — eski
/// kayıtlarda yalnız <see cref="CitizenAutoReplyTemplateModel.Greeting"/> vardır.
/// </summary>
public sealed record CitizenAutoReplyGreetings(
    string? ProcessingReceived = null,
    string? InProgress = null,
    string? Completed = null,
    string? Cancelled = null);

public sealed record CitizenAutoReplyTemplateModel(
    string ProcessingReceived,
    string InProgress,
    string Completed,
    string Cancelled,
    string? Greeting = null,
    string? AfterHoursManagerSms = null,
    CitizenAutoReplyGreetings? Greetings = null)
{
    /// <summary>
    /// Vatandaşa gidecek durum mesajının hitabı: durumun kendi hitabı → tenant genel hitabı →
    /// varsayılan satır. Durum etiketleri <c>CitizenJobStatusLabelHelper.GetDisplayStatus</c> çıktısıyla aynı.
    /// </summary>
    public string GreetingFor(string statusLabel)
    {
        var perStatus = statusLabel switch
        {
            "İşleme Alındı" => Greetings?.ProcessingReceived,
            "Yapılmakta" => Greetings?.InProgress,
            "Tamamlanmış" or "Tamamlandı" => Greetings?.Completed,
            "İptal" => Greetings?.Cancelled,
            _ => null,
        };

        return CitizenOutboundGreeting.NormalizeLine(
            string.IsNullOrWhiteSpace(perStatus) ? Greeting : perStatus);
    }
}

public static class CitizenAutoReplyTemplateJson
{
    public static CitizenAutoReplyTemplateModel Defaults() => new(
        CitizenAutoReplyTemplateDefaults.ProcessingReceived,
        CitizenAutoReplyTemplateDefaults.InProgress,
        CitizenAutoReplyTemplateDefaults.Completed,
        CitizenAutoReplyTemplateDefaults.Cancelled);

    public static CitizenAutoReplyTemplateModel ParseOrDefault(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return Defaults();
        }

        try
        {
            var parsed = JsonSerializer.Deserialize<CitizenAutoReplyTemplateModel>(json);
            if (parsed is null)
            {
                return Defaults();
            }

            var defaults = Defaults();
            return new CitizenAutoReplyTemplateModel(
                EnsureQuotedCitizenStatuses(EnsureTargetDepartmentToken(string.IsNullOrWhiteSpace(parsed.ProcessingReceived) ? defaults.ProcessingReceived : parsed.ProcessingReceived)),
                EnsureQuotedCitizenStatuses(EnsureTargetDepartmentToken(string.IsNullOrWhiteSpace(parsed.InProgress) ? defaults.InProgress : parsed.InProgress)),
                EnsureQuotedCitizenStatuses(EnsureTargetDepartmentToken(string.IsNullOrWhiteSpace(parsed.Completed) ? defaults.Completed : parsed.Completed)),
                EnsureQuotedCitizenStatuses(EnsureTargetDepartmentToken(string.IsNullOrWhiteSpace(parsed.Cancelled) ? defaults.Cancelled : parsed.Cancelled)),
                CitizenOutboundGreeting.NormalizeLine(parsed.Greeting),
                parsed.AfterHoursManagerSms,
                NormalizeGreetings(parsed.Greetings));
        }
        catch (JsonException)
        {
            return Defaults();
        }
    }

    public static string Serialize(CitizenAutoReplyTemplateModel model) =>
        JsonSerializer.Serialize(new CitizenAutoReplyTemplateModel(
            EnsureQuotedCitizenStatuses(EnsureTargetDepartmentToken(model.ProcessingReceived)),
            EnsureQuotedCitizenStatuses(EnsureTargetDepartmentToken(model.InProgress)),
            EnsureQuotedCitizenStatuses(EnsureTargetDepartmentToken(model.Completed)),
            EnsureQuotedCitizenStatuses(EnsureTargetDepartmentToken(model.Cancelled)),
            CitizenOutboundGreeting.NormalizeLine(model.Greeting),
            model.AfterHoursManagerSms,
            NormalizeGreetings(model.Greetings)));

    /// <summary>Boş durum hitabı <c>null</c> saklanır; okuma tarafında genel hitaba düşsün.</summary>
    private static CitizenAutoReplyGreetings? NormalizeGreetings(CitizenAutoReplyGreetings? greetings)
    {
        if (greetings is null)
        {
            return null;
        }

        var normalized = new CitizenAutoReplyGreetings(
            TrimmedOrNull(greetings.ProcessingReceived),
            TrimmedOrNull(greetings.InProgress),
            TrimmedOrNull(greetings.Completed),
            TrimmedOrNull(greetings.Cancelled));
        return normalized == new CitizenAutoReplyGreetings() ? null : normalized;
    }

    private static string? TrimmedOrNull(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string EnsureQuotedCitizenStatuses(string template) =>
        CitizenJobStatusLabelHelper.EnsureQuotedCitizenStatuses(template);

    private static string EnsureTargetDepartmentToken(string template)
    {
        foreach (var token in new[] { "{GönderilenBirim}", "{Gönderilen Birim}" })
        {
            var tokenIndex = template.IndexOf(token, StringComparison.Ordinal);
            if (tokenIndex < 0)
            {
                continue;
            }

            // Token adı kanonikleştirilir; token sonrası metin OLDUĞU GİBİ korunur — otomatik
            // boşluk eklenmez, "…{GönderilenBirim}'ne iletilmiştir." bitişik kalır (card #1598 2. reopen).
            var beforeToken = template[..tokenIndex];
            var afterToken = template[(tokenIndex + token.Length)..];
            return $"{beforeToken}{{GönderilenBirim}}{afterToken}";
        }

        return $"{template.TrimEnd()} {{GönderilenBirim}}";
    }
}

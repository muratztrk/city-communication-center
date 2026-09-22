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
    string? Cancelled = null,
    string? SmsProcessingReceived = null);

public sealed record CitizenAutoReplyTemplateModel(
    string ProcessingReceived,
    string InProgress,
    string Completed,
    string Cancelled,
    string? Greeting = null,
    string? AfterHoursManagerSms = null,
    CitizenAutoReplyGreetings? Greetings = null,
    string? AfterHoursStaffSms = null,
    bool? AfterHoursManagerSmsEnabled = null,
    bool? AfterHoursStaffSmsEnabled = null,
    string? SmsProcessingReceived = null,
    bool? SmsProcessingReceivedEnabled = null,
    string? OverdueManagerSms = null,
    bool? OverdueManagerSmsEnabled = null,
    string? OverdueStaffSms = null,
    bool? OverdueStaffSmsEnabled = null,
    bool? InProgressEnabled = null)
{
    public bool ManagerSmsIsEnabled => AfterHoursManagerSmsEnabled ?? true;

    public bool StaffSmsIsEnabled => AfterHoursStaffSmsEnabled ?? false;

    public bool SmsProcessingReceivedIsEnabled => SmsProcessingReceivedEnabled ?? true;

    public bool InProgressIsEnabled => InProgressEnabled ?? true;

    public bool OverdueManagerSmsIsEnabled => OverdueManagerSmsEnabled ?? true;

    public bool OverdueStaffSmsIsEnabled => OverdueStaffSmsEnabled ?? false;

    public string ResolveProcessingReceivedTemplate(Domain.Enums.SocialChannel? channel)
    {
        if (channel == Domain.Enums.SocialChannel.Phone)
        {
            var smsTemplate = string.IsNullOrWhiteSpace(SmsProcessingReceived) ? null : SmsProcessingReceived;
            return smsTemplate ?? ProcessingReceived;
        }

        return ProcessingReceived;
    }

    /// <summary>
    /// Vatandaşa gidecek durum mesajının hitabı: durumun kendi hitabı → tenant genel hitabı →
    /// varsayılan satır. Durum etiketleri <c>CitizenJobStatusLabelHelper.GetDisplayStatus</c> çıktısıyla aynı.
    /// </summary>
    public string GreetingFor(string statusLabel, Domain.Enums.SocialChannel? channel = null)
    {
        if (channel == Domain.Enums.SocialChannel.Phone && statusLabel == "İşleme Alındı")
        {
            var smsGreeting = Greetings?.SmsProcessingReceived;
            if (!string.IsNullOrWhiteSpace(smsGreeting))
            {
                return CitizenOutboundGreeting.NormalizeLine(smsGreeting);
            }
        }

        var perStatus = statusLabel switch
        {
            "İşleme Alındı" => Greetings?.ProcessingReceived,
            "Yapılmakta" => Greetings?.InProgress,
            "Tamamlanmış" or "Tamamlandı" => Greetings?.Completed,
            "İptal" or "İptal Edildi" => Greetings?.Cancelled,
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
                EnsureProcessingReceivedSuffixSeparator(EnsureQuotedCitizenStatuses(StripTargetDepartmentToken(string.IsNullOrWhiteSpace(parsed.ProcessingReceived) ? defaults.ProcessingReceived : parsed.ProcessingReceived))),
                EnsureQuotedCitizenStatuses(EnsureTargetDepartmentToken(string.IsNullOrWhiteSpace(parsed.InProgress) ? defaults.InProgress : parsed.InProgress)),
                EnsureQuotedCitizenStatuses(EnsureCompletionNoteToken(EnsureTargetDepartmentToken(string.IsNullOrWhiteSpace(parsed.Completed) ? defaults.Completed : parsed.Completed))),
                EnsureQuotedCitizenStatuses(EnsureCancelNoteToken(EnsureTargetDepartmentToken(string.IsNullOrWhiteSpace(parsed.Cancelled) ? defaults.Cancelled : parsed.Cancelled))),
                CitizenOutboundGreeting.NormalizeLine(parsed.Greeting),
                parsed.AfterHoursManagerSms,
                NormalizeGreetings(parsed.Greetings),
                parsed.AfterHoursStaffSms,
                parsed.AfterHoursManagerSmsEnabled,
                parsed.AfterHoursStaffSmsEnabled,
                string.IsNullOrWhiteSpace(parsed.SmsProcessingReceived)
                    ? null
                    : EnsureProcessingReceivedSuffixSeparator(EnsureQuotedCitizenStatuses(StripTargetDepartmentToken(parsed.SmsProcessingReceived))),
                parsed.SmsProcessingReceivedEnabled,
                parsed.OverdueManagerSms,
                parsed.OverdueManagerSmsEnabled,
                parsed.OverdueStaffSms,
                parsed.OverdueStaffSmsEnabled,
                parsed.InProgressEnabled);
        }
        catch (JsonException)
        {
            return Defaults();
        }
    }

    public static string Serialize(CitizenAutoReplyTemplateModel model) =>
        JsonSerializer.Serialize(new CitizenAutoReplyTemplateModel(
            EnsureProcessingReceivedSuffixSeparator(EnsureQuotedCitizenStatuses(StripTargetDepartmentToken(model.ProcessingReceived))),
            EnsureQuotedCitizenStatuses(EnsureTargetDepartmentToken(model.InProgress)),
            EnsureQuotedCitizenStatuses(EnsureCompletionNoteToken(EnsureTargetDepartmentToken(model.Completed))),
            EnsureQuotedCitizenStatuses(EnsureCancelNoteToken(EnsureTargetDepartmentToken(model.Cancelled))),
            CitizenOutboundGreeting.NormalizeLine(model.Greeting),
            model.AfterHoursManagerSms,
            NormalizeGreetings(model.Greetings),
            model.AfterHoursStaffSms,
            model.AfterHoursManagerSmsEnabled,
            model.AfterHoursStaffSmsEnabled,
            string.IsNullOrWhiteSpace(model.SmsProcessingReceived)
                ? null
                : EnsureProcessingReceivedSuffixSeparator(EnsureQuotedCitizenStatuses(StripTargetDepartmentToken(model.SmsProcessingReceived))),
            model.SmsProcessingReceivedEnabled,
            model.OverdueManagerSms,
            model.OverdueManagerSmsEnabled,
            model.OverdueStaffSms,
            model.OverdueStaffSmsEnabled,
            model.InProgressEnabled));

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
            TrimmedOrNull(greetings.Cancelled),
            TrimmedOrNull(greetings.SmsProcessingReceived));
        return normalized == new CitizenAutoReplyGreetings() ? null : normalized;
    }

    private static string? TrimmedOrNull(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string EnsureQuotedCitizenStatuses(string template) =>
        CitizenJobStatusLabelHelper.EnsureQuotedCitizenStatuses(template);

    /// <summary>İşleme Alındı durum cümlesinden sonra gönderilen mesajda boş satır (#3701).</summary>
    private static string EnsureProcessingReceivedSuffixSeparator(string template)
    {
        if (string.IsNullOrWhiteSpace(template))
        {
            return template;
        }

        if (!template.Contains("talebinizin durumu", StringComparison.OrdinalIgnoreCase)
            && !template.Contains("\"İşleme Alındı\".", StringComparison.Ordinal))
        {
            return template;
        }

        var statusEnd = FindProcessingReceivedStatusEnd(template);
        if (statusEnd is null)
        {
            return template;
        }

        var headEnd = statusEnd.Value;
        var tail = template[headEnd..];
        if (tail.StartsWith("\n\n", StringComparison.Ordinal))
        {
            return template;
        }

        if (string.IsNullOrWhiteSpace(tail))
        {
            return template[..headEnd] + "\n\n";
        }

        return template[..headEnd] + "\n\n" + tail.TrimStart('\r', '\n', ' ', '\t');
    }

    private static int? FindProcessingReceivedStatusEnd(string template)
    {
        foreach (var statusEnd in new[] { "\"İşleme Alındı\".", "İşleme Alındı." })
        {
            var markerIndex = template.IndexOf(statusEnd, StringComparison.Ordinal);
            if (markerIndex >= 0)
            {
                return markerIndex + statusEnd.Length;
            }
        }

        return null;
    }

    /// <summary>
    /// İşleme Alındı şablonlarında birim token'ı kullanılmaz; eski kayıtlardan token ve sonrası temizlenir (card #3686).
    /// </summary>
    private static string StripTargetDepartmentToken(string template)
    {
        foreach (var token in new[] { "{GönderilenBirim}", "{Gönderilen Birim}" })
        {
            var tokenIndex = template.IndexOf(token, StringComparison.Ordinal);
            if (tokenIndex < 0)
            {
                continue;
            }

            var beforeToken = template[..tokenIndex].TrimEnd();
            var afterToken = template[(tokenIndex + token.Length)..];
            return $"{beforeToken}{afterToken}";
        }

        return template.TrimEnd();
    }

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

    private static string EnsureCompletionNoteToken(string template) =>
        EnsureTerminalNoteToken(template, "{Tamamlama Notu}", "{TamamlamaNotu}");

    private static string EnsureCancelNoteToken(string template) =>
        EnsureTerminalNoteToken(template, "{İptal Notu}", "{İptalNotu}");

    private static string EnsureTerminalNoteToken(string template, string canonical, string compact)
    {
        foreach (var token in new[] { canonical, compact })
        {
            var tokenIndex = template.IndexOf(token, StringComparison.Ordinal);
            if (tokenIndex < 0)
            {
                continue;
            }

            var beforeToken = template[..tokenIndex].TrimEnd('\r', '\n');
            if (beforeToken.Length > 0 && !char.IsWhiteSpace(beforeToken[^1]))
            {
                beforeToken += " ";
            }

            var afterToken = template[(tokenIndex + token.Length)..];
            return $"{beforeToken}{canonical}{afterToken}";
        }

        return $"{template.TrimEnd()} {canonical}";
    }
}

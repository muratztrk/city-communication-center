using System.Text.Json;
using CityCommunicationCenter.Application.Common;
using CityCommunicationCenter.Application.Features.Social;

namespace CityCommunicationCenter.Application.Features.Admin;

public sealed record CitizenAutoReplyTemplateModel(
    string ProcessingReceived,
    string InProgress,
    string Completed,
    string Cancelled,
    string? Greeting = null,
    string? AfterHoursManagerSms = null);

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
                parsed.AfterHoursManagerSms);
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
            model.AfterHoursManagerSms));

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

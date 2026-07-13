using System.Text.Json;

namespace CityCommunicationCenter.Application.Features.Admin;

public sealed record CitizenAutoReplyTemplateModel(
    string ProcessingReceived,
    string InProgress,
    string Completed,
    string Cancelled);

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
                EnsureTargetDepartmentToken(string.IsNullOrWhiteSpace(parsed.ProcessingReceived) ? defaults.ProcessingReceived : parsed.ProcessingReceived),
                EnsureTargetDepartmentToken(string.IsNullOrWhiteSpace(parsed.InProgress) ? defaults.InProgress : parsed.InProgress),
                EnsureTargetDepartmentToken(string.IsNullOrWhiteSpace(parsed.Completed) ? defaults.Completed : parsed.Completed),
                EnsureTargetDepartmentToken(string.IsNullOrWhiteSpace(parsed.Cancelled) ? defaults.Cancelled : parsed.Cancelled));
        }
        catch (JsonException)
        {
            return Defaults();
        }
    }

    public static string Serialize(CitizenAutoReplyTemplateModel model) =>
        JsonSerializer.Serialize(new CitizenAutoReplyTemplateModel(
            EnsureTargetDepartmentToken(model.ProcessingReceived),
            EnsureTargetDepartmentToken(model.InProgress),
            EnsureTargetDepartmentToken(model.Completed),
            EnsureTargetDepartmentToken(model.Cancelled)));

    private static string EnsureTargetDepartmentToken(string template) =>
        template.Contains("{GönderilenBirim}", StringComparison.Ordinal)
            || template.Contains("{Gönderilen Birim}", StringComparison.Ordinal)
            ? template
            : $"{template.TrimEnd()} {{GönderilenBirim}}";
}

using System.Text.Json;

namespace CityCommunicationCenter.Application.Features.Admin;

public sealed record CitizenAutoReplyTemplateModel(
    string ProcessingReceived,
    string InProgress,
    string Completed);

public static class CitizenAutoReplyTemplateJson
{
    public static CitizenAutoReplyTemplateModel Defaults() => new(
        CitizenAutoReplyTemplateDefaults.ProcessingReceived,
        CitizenAutoReplyTemplateDefaults.InProgress,
        CitizenAutoReplyTemplateDefaults.Completed);

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
                string.IsNullOrWhiteSpace(parsed.ProcessingReceived) ? defaults.ProcessingReceived : parsed.ProcessingReceived,
                string.IsNullOrWhiteSpace(parsed.InProgress) ? defaults.InProgress : parsed.InProgress,
                string.IsNullOrWhiteSpace(parsed.Completed) ? defaults.Completed : parsed.Completed);
        }
        catch (JsonException)
        {
            return Defaults();
        }
    }

    public static string Serialize(CitizenAutoReplyTemplateModel model) =>
        JsonSerializer.Serialize(model);
}

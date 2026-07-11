using System.Text.RegularExpressions;
using FluentValidation;
using FluentValidation.Results;

namespace CityCommunicationCenter.Application.Features.Social;

internal static class WhatsAppMetaTemplateConstants
{
    public const string Channel = "WhatsApp Meta";
}

internal static partial class WhatsAppMetaTemplateGuard
{
    [GeneratedRegex(@"\{\{\d+\}\}", RegexOptions.CultureInvariant)]
    private static partial Regex BodyVariableRegex();

    public static bool HasBodyVariables(string? content) =>
        !string.IsNullOrWhiteSpace(content) && BodyVariableRegex().IsMatch(content);

    public static void EnsureNoBodyVariables(string? content, string propertyName = "Content")
    {
        if (!HasBodyVariables(content))
        {
            return;
        }

        throw new ValidationException([
            new ValidationFailure(
                propertyName,
                "Değişken içeren Meta şablonları (ör. {{1}}) henüz gönderilemez. Değişkensiz onaylı bir şablon seçin.")
        ]);
    }
}

namespace CityCommunicationCenter.Application.Common;

/// <summary>
/// Vatandaşa giden SMS ve serbest metin WhatsApp mesajlarının başına hitap + boş satır ekler.
/// Meta şablon gövdesine uygulanmaz (şablon Meta'da kilitlidir).
/// </summary>
public static class CitizenOutboundGreeting
{
    public const string Line = "Değerli vatandaşımız,";

    public static string NormalizeLine(string? greetingLine)
    {
        var line = greetingLine?.Trim();
        return string.IsNullOrWhiteSpace(line) ? Line : line;
    }

    public static string Ensure(string text, string? greetingLine = null)
    {
        var body = text.Trim();
        if (body.Length == 0)
        {
            return body;
        }

        var line = NormalizeLine(greetingLine);
        if (body.StartsWith(line, StringComparison.Ordinal)
            || body.StartsWith(Line, StringComparison.Ordinal))
        {
            return body;
        }

        return line + "\n\n" + body;
    }

    public static string? EnsureOptional(string? text, string? greetingLine = null)
        => string.IsNullOrWhiteSpace(text) ? text : Ensure(text, greetingLine);
}

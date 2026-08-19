namespace CityCommunicationCenter.Application.Common;

/// <summary>
/// Vatandaşa giden SMS ve serbest metin WhatsApp mesajlarının başına hitap + boş satır ekler.
/// Meta şablon gövdesine uygulanmaz (şablon Meta'da kilitlidir).
/// </summary>
public static class CitizenOutboundGreeting
{
    public const string Line = "Değerli vatandaşımız,";

    public static string Ensure(string text)
    {
        var body = text.Trim();
        if (body.Length == 0)
        {
            return body;
        }

        if (body.StartsWith(Line, StringComparison.Ordinal))
        {
            return body;
        }

        return Line + "\n\n" + body;
    }

    public static string? EnsureOptional(string? text)
        => string.IsNullOrWhiteSpace(text) ? text : Ensure(text);
}

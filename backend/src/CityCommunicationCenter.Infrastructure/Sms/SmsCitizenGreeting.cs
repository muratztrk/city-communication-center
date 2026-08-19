namespace CityCommunicationCenter.Infrastructure.Sms;

/// <summary>
/// Vatandaşa giden her SMS'in başına hitap + boş satır ekler (sağlayıcıya çıkmadan önce).
/// </summary>
internal static class SmsCitizenGreeting
{
    public const string Line = "Değerli vatandaşımız,";

    public static string Ensure(string text)
    {
        var body = text.Trim();
        if (body.StartsWith(Line, StringComparison.Ordinal))
        {
            return body;
        }

        return Line + "\n\n" + body;
    }
}

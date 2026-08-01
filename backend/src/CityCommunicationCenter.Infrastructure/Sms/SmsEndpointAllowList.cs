using CityCommunicationCenter.Application.Abstractions;

namespace CityCommunicationCenter.Infrastructure.Sms;

/// <summary>
/// Kayıtlı SMS parolası "yaz-only" bir sırdır: API yanıtlarında asla dönmez, yalnız gönderim
/// sırasında sağlayıcıya gider. ApiUrl serbest bırakılırsa bir yönetici bunu kendi sunucusuna
/// çevirip Test SMS ile parolayı dışarı sızdırabilir. Bu yüzden ApiUrl yalnız sağlayıcının
/// bilinen host'larına işaret edebilir; başka host verilirse varsayılana düşülür.
/// </summary>
internal static class SmsEndpointAllowList
{
    private static readonly Dictionary<SmsProvider, string[]> AllowedHosts = new()
    {
        [SmsProvider.JettMesaj] = ["api.jettmesaj.com", "jettmesaj.com", "www.jettmesaj.com"],
        [SmsProvider.Asistel] = ["92.42.35.50", "asistsms.com", "www.asistsms.com", "api.asistsms.com"],
    };

    /// <summary>
    /// Yapılandırılmış ApiUrl güvenliyse onu, değilse <paramref name="defaultEndpoint"/> döner.
    /// </summary>
    public static string Resolve(SmsProvider provider, string? configuredApiUrl, string defaultEndpoint)
    {
        if (string.IsNullOrWhiteSpace(configuredApiUrl))
        {
            return defaultEndpoint;
        }

        if (!Uri.TryCreate(configuredApiUrl.Trim(), UriKind.Absolute, out var uri))
        {
            return defaultEndpoint;
        }

        if (uri.Scheme is not ("http" or "https"))
        {
            return defaultEndpoint;
        }

        return AllowedHosts.TryGetValue(provider, out var hosts)
            && hosts.Contains(uri.Host, StringComparer.OrdinalIgnoreCase)
                ? configuredApiUrl.Trim()
                : defaultEndpoint;
    }

    public static bool IsAllowed(SmsProvider provider, string? configuredApiUrl)
    {
        if (string.IsNullOrWhiteSpace(configuredApiUrl))
        {
            return true;
        }

        return Uri.TryCreate(configuredApiUrl.Trim(), UriKind.Absolute, out var uri)
            && uri.Scheme is "http" or "https"
            && AllowedHosts.TryGetValue(provider, out var hosts)
            && hosts.Contains(uri.Host, StringComparer.OrdinalIgnoreCase);
    }

    public static string DescribeAllowed(SmsProvider provider) =>
        AllowedHosts.TryGetValue(provider, out var hosts) ? string.Join(", ", hosts) : string.Empty;
}

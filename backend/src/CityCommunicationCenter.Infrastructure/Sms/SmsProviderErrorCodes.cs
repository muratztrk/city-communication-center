namespace CityCommunicationCenter.Infrastructure.Sms;

/// <summary>
/// Asistel (EK-A) ve jeTTMesaj (EK-A) aynı hata kodu tablosunu kullanıyor.
/// Kod eşleşmezse ham kod Türkçe mesajın içinde gösterilir — sessizce yutulmaz.
/// </summary>
internal static class SmsProviderErrorCodes
{
    private static readonly Dictionary<string, string> Messages = new(StringComparer.OrdinalIgnoreCase)
    {
        ["100"] = "SMS başarıyla gönderildi.",
        ["OK"] = "SMS başarıyla gönderildi.",
        ["101"] = "SMSC arızası.",
        ["102"] = "SMS Gateway arızası.",
        ["103"] = "SMS gönderim kotası aşılmış.",
        ["104"] = "Kullanıcı adı veya parola yanlış.",
        ["105"] = "Firma kodu aktif değil.",
        ["106"] = "Alıcı numara veya mesaj metni boş olamaz.",
        ["107"] = "SMS metni 1 karakterden uzun olmalı.",
        ["108"] = "Tarih formatı yanlış.",
        ["109"] = "Alfanumerik başlık hatalı veya onaysız. Ayarlar'daki Gönderici Adı'nı kontrol edin.",
        ["110"] = "Sağlayıcıda bilinmeyen hata.",
        ["120"] = "Sağlayıcı sunucusu meşgul.",
        ["121"] = "Geçersiz GSM listesi formatı — numara 90XXXXXXXXXX (12 hane) olmalı.",
        ["122"] = "Geçersiz format — numara 90XXXXXXXXXX olmalı.",
    };

    /// <summary>
    /// Asistel bazen <c>100</c>, bazen <c>100:transactionId</c> döner (#6a60a552).
    /// İki-nokta öncesi durum kodu alınır.
    /// </summary>
    public static string NormalizeStatusCode(string? code)
    {
        if (string.IsNullOrWhiteSpace(code))
        {
            return string.Empty;
        }

        var trimmed = code.Trim();
        var colon = trimmed.IndexOf(':');
        return colon > 0 ? trimmed[..colon].Trim() : trimmed;
    }

    public static bool IsSuccess(string? code)
    {
        var status = NormalizeStatusCode(code);
        return string.Equals(status, "OK", StringComparison.OrdinalIgnoreCase)
            || string.Equals(status, "100", StringComparison.Ordinal);
    }

    public static bool IsKnownErrorCode(string? code)
    {
        var status = NormalizeStatusCode(code);
        return !string.IsNullOrEmpty(status)
            && Messages.ContainsKey(status)
            && !IsSuccess(status);
    }

    public static string Describe(string? code)
    {
        if (string.IsNullOrWhiteSpace(code))
        {
            return "Sağlayıcıdan boş yanıt alındı.";
        }

        var trimmed = code.Trim();
        var status = NormalizeStatusCode(trimmed);
        if (Messages.TryGetValue(status, out var message))
        {
            return message;
        }

        return $"Sağlayıcı beklenmeyen yanıt döndürdü: {trimmed}";
    }
}

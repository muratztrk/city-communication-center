namespace CityCommunicationCenter.Infrastructure.Sms;

/// <summary>
/// Asistel (EK-A) ve jeTTMesaj (EK-A) aynı hata kodu tablosunu kullanıyor.
/// Kod eşleşmezse ham kod Türkçe mesajın içinde gösterilir — sessizce yutulmaz.
/// </summary>
internal static class SmsProviderErrorCodes
{
    private static readonly Dictionary<string, string> Messages = new(StringComparer.OrdinalIgnoreCase)
    {
        ["100"] = "SMS sunucuya başarıyla yüklendi.",
        ["OK"] = "SMS sunucuya başarıyla yüklendi.",
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

    public static bool IsSuccess(string? code) =>
        !string.IsNullOrWhiteSpace(code)
        && (string.Equals(code.Trim(), "OK", StringComparison.OrdinalIgnoreCase)
            || string.Equals(code.Trim(), "100", StringComparison.Ordinal));

    public static bool IsKnownErrorCode(string? code) =>
        !string.IsNullOrWhiteSpace(code)
        && Messages.ContainsKey(code.Trim())
        && !IsSuccess(code);

    public static string Describe(string? code)
    {
        if (string.IsNullOrWhiteSpace(code))
        {
            return "Sağlayıcıdan boş yanıt alındı.";
        }

        var trimmed = code.Trim();
        return Messages.TryGetValue(trimmed, out var message)
            ? message
            : $"Sağlayıcı beklenmeyen yanıt döndürdü: {trimmed}";
    }
}

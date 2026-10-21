using System.Globalization;
using System.Text;
using System.Text.Json;

namespace CityCommunicationCenter.Infrastructure.BelediyeSoap;

/// <summary>
/// "TalepOneriOzellestirmeParametreleri" ayarOku degeri (Belediye V3 SDD 3.1.3, AyarOku kilavuzu).
/// Bos / hatali JSON'da kilavuzdaki varsayilanlar gecerlidir: dosya yukleme, tekrar acma ve not ekleme kapali.
/// </summary>
public sealed record TalepOneriOptions(
    int BasvuruDosyaSayisi,
    string DosyaUzanti,
    int DosyaBoyutKb,
    bool BasvuruTekrarAcilabilir,
    string BasvuruKapaliDurumlar,
    bool NotEklenebilir,
    string CevapTuru)
{
    public const string AyarAdi = "TalepOneriOzellestirmeParametreleri";

    public const int MaxDosyaSayisi = 5;
    public const int MaxDosyaBoyutKb = 1024;

    // Kilavuzdaki varsayilanlar (kilavuzdaki "XLXS" yazim hatasi XLSX olarak duzeltildi). Kapali durumlar, BelediyeBasvuruStatusMapper'in urettigi sonuclanmis durumlardir.
    public static TalepOneriOptions Default { get; } = new(
        BasvuruDosyaSayisi: 0,
        DosyaUzanti: "JPG,XLS,XLSX,DOC,DOCX,PDF,PNG",
        DosyaBoyutKb: 512,
        BasvuruTekrarAcilabilir: false,
        BasvuruKapaliDurumlar: "TAMAMLANDI,IPTAL EDILDI,REDDEDILDI",
        NotEklenebilir: false,
        CevapTuru: "EPOSTA,YAZILI,SMS,TELEFON,FAX");

    public static TalepOneriOptions Parse(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return Default;
        }

        try
        {
            using var document = JsonDocument.Parse(json);
            if (document.RootElement.ValueKind != JsonValueKind.Object)
            {
                return Default;
            }

            var root = document.RootElement;
            var defaults = Default;
            return new TalepOneriOptions(
                Math.Clamp(ReadInt(root, "basvuruDosyaSayisi", defaults.BasvuruDosyaSayisi), 0, MaxDosyaSayisi),
                ReadCsv(root, "dosyaUzanti", defaults.DosyaUzanti),
                Math.Clamp(ReadInt(root, "dosyaBoyut", defaults.DosyaBoyutKb), 1, MaxDosyaBoyutKb),
                ReadInt(root, "basvuruTekrarAcilabilirmi", 0) == 1,
                ReadCsv(root, "basvuruKapaliDurumlar", defaults.BasvuruKapaliDurumlar),
                ReadInt(root, "notEklenebilirmi", 0) == 1,
                ReadCsv(root, "cevapTuru", defaults.CevapTuru));
        }
        catch (JsonException)
        {
            return Default;
        }
    }

    /// <summary>Kilavuzdaki ornek bicimde (sayilar sayi olarak) JSON uretir.</summary>
    public string ToJson()
        => JsonSerializer.Serialize(new Dictionary<string, object>
        {
            ["basvuruDosyaSayisi"] = BasvuruDosyaSayisi,
            ["dosyaUzanti"] = DosyaUzanti,
            ["dosyaBoyut"] = DosyaBoyutKb,
            ["basvuruTekrarAcilabilirmi"] = BasvuruTekrarAcilabilir ? 1 : 0,
            ["basvuruKapaliDurumlar"] = BasvuruKapaliDurumlar,
            ["notEklenebilirmi"] = NotEklenebilir ? 1 : 0,
            ["cevapTuru"] = CevapTuru,
        });

    public bool IsExtensionAllowed(string extension)
        => Split(DosyaUzanti).Contains(NormalizeKey(extension.Trim('.')), StringComparer.Ordinal);

    public bool IsCevapTuruAllowed(string value)
        => Split(CevapTuru).Contains(NormalizeKey(value), StringComparer.Ordinal);

    public bool IsClosedStatus(string status)
        => Split(BasvuruKapaliDurumlar).Contains(NormalizeKey(status), StringComparer.Ordinal);

    /// <summary>Buyuk harf, Turkce karakter ve bosluk/ayirici farklarini yok sayan karsilastirma anahtari.</summary>
    public static string NormalizeKey(string value)
    {
        var upper = value.Trim().ToUpper(new CultureInfo("tr-TR"));
        var builder = new StringBuilder(upper.Length);
        foreach (var ch in upper)
        {
            var mapped = ch switch
            {
                'İ' => 'I',
                'Ç' => 'C',
                'Ğ' => 'G',
                'Ö' => 'O',
                'Ş' => 'S',
                'Ü' => 'U',
                _ => ch,
            };
            if (char.IsLetterOrDigit(mapped))
            {
                builder.Append(mapped);
            }
        }

        return builder.ToString();
    }

    private static HashSet<string> Split(string csv)
        => csv.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(NormalizeKey)
            .Where(item => item.Length > 0)
            .ToHashSet(StringComparer.Ordinal);

    private static int ReadInt(JsonElement root, string name, int fallback)
    {
        if (!root.TryGetProperty(name, out var element))
        {
            return fallback;
        }

        return element.ValueKind switch
        {
            JsonValueKind.Number when element.TryGetInt32(out var number) => number,
            JsonValueKind.String when int.TryParse(element.GetString(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var number) => number,
            _ => fallback,
        };
    }

    private static string ReadCsv(JsonElement root, string name, string fallback)
        => root.TryGetProperty(name, out var element)
            && element.ValueKind == JsonValueKind.String
            && !string.IsNullOrWhiteSpace(element.GetString())
            ? element.GetString()!.Trim()
            : fallback;
}

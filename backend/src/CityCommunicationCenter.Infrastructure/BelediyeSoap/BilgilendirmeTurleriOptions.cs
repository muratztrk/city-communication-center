using System.Text.Json;

namespace CityCommunicationCenter.Infrastructure.BelediyeSoap;

public sealed record BilgilendirmeTur(string Kod, string Ad, string Aciklama);

/// <summary>
/// e-Devlet bilgilendirme isteginde vatandasin secebilecegi SMS ve e-posta kategorileri.
/// Tenant ayari bos ya da hatali ise varsayilan kategoriler kullanilir.
/// </summary>
public sealed record BilgilendirmeTurleriOptions(
    IReadOnlyList<BilgilendirmeTur> Sms,
    IReadOnlyList<BilgilendirmeTur> Eposta)
{
    private const int MaxAdLength = 40;

    public static BilgilendirmeTurleriOptions Default { get; } = new(
        [
            new("DUYURU", "Duyurular", "Belediyeden genel duyurular"),
            new("ETKINLIK", "Etkinlikler", "Kultur, sanat ve spor etkinlikleri"),
            new("KESINTI", "Kesinti ve Ariza", "Planli kesinti ve ariza bilgilendirmeleri"),
        ],
        [
            new("DUYURU", "Duyurular", "Belediyeden genel duyurular"),
            new("ETKINLIK", "Etkinlikler", "Kultur, sanat ve spor etkinlikleri"),
            new("KESINTI", "Kesinti ve Ariza", "Planli kesinti ve ariza bilgilendirmeleri"),
            new("MECLIS", "Meclis ve Encumen", "Meclis ve encumen gundem ve kararlari"),
        ]);

    public static BilgilendirmeTurleriOptions Parse(string? json)
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
            var sms = ReadList(root, "sms");
            var eposta = ReadList(root, "eposta");
            return new BilgilendirmeTurleriOptions(sms ?? Default.Sms, eposta ?? Default.Eposta);
        }
        catch (JsonException)
        {
            return Default;
        }
    }

    public BilgilendirmeTur? FindSms(string kod) => Find(Sms, kod);

    public BilgilendirmeTur? FindEposta(string kod) => Find(Eposta, kod);

    private static BilgilendirmeTur? Find(IReadOnlyList<BilgilendirmeTur> list, string kod)
        => list.FirstOrDefault(item => string.Equals(item.Kod, kod.Trim(), StringComparison.OrdinalIgnoreCase));

    // Anahtar yoksa null (varsayilan kullanilir); anahtar varsa, bos liste de gecerlidir.
    private static List<BilgilendirmeTur>? ReadList(JsonElement root, string name)
    {
        if (!root.TryGetProperty(name, out var element) || element.ValueKind != JsonValueKind.Array)
        {
            return null;
        }

        var result = new List<BilgilendirmeTur>();
        foreach (var item in element.EnumerateArray())
        {
            if (item.ValueKind != JsonValueKind.Object)
            {
                continue;
            }

            var kod = ReadString(item, "kod");
            var ad = ReadString(item, "ad");
            if (kod.Length == 0 || ad.Length == 0 || result.Any(existing => string.Equals(existing.Kod, kod, StringComparison.OrdinalIgnoreCase)))
            {
                continue;
            }

            result.Add(new BilgilendirmeTur(kod, ad.Length > MaxAdLength ? ad[..MaxAdLength] : ad, ReadString(item, "aciklama")));
        }

        return result;
    }

    private static string ReadString(JsonElement item, string name)
        => item.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString()!.Trim()
            : string.Empty;
}

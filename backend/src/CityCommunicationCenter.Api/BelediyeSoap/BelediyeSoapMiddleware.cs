using System.Globalization;
using System.Text;
using System.Xml.Linq;
using CityCommunicationCenter.Application.Abstractions.BelediyeSoap;

namespace CityCommunicationCenter.Api.BelediyeSoap;

public sealed class BelediyeSoapMiddleware
{
    private static readonly XNamespace SoapEnv = "http://schemas.xmlsoap.org/soap/envelope/";
    private static readonly XNamespace Tns = "http://belediye.turkiye.gov.tr/v3";
    private static readonly XNamespace Xsi = "http://www.w3.org/2001/XMLSchema-instance";

    private readonly RequestDelegate _next;

    public BelediyeSoapMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext context, IBelediyeSoapOperations operations)
    {
        if (!HttpMethods.IsPost(context.Request.Method)
            || !context.Request.Path.StartsWithSegments("/service", StringComparison.OrdinalIgnoreCase))
        {
            await _next(context);
            return;
        }

        context.Request.EnableBuffering();
        using var reader = new StreamReader(context.Request.Body, Encoding.UTF8, detectEncodingFromByteOrderMarks: true, leaveOpen: true);
        var body = await reader.ReadToEndAsync(context.RequestAborted);
        context.Request.Body.Position = 0;

        if (string.IsNullOrWhiteSpace(body))
        {
            context.Response.StatusCode = StatusCodes.Status400BadRequest;
            return;
        }

        XDocument document;
        try
        {
            document = XDocument.Parse(body);
        }
        catch (Exception)
        {
            context.Response.StatusCode = StatusCodes.Status400BadRequest;
            return;
        }

        var payload = document.Descendants().FirstOrDefault(element => element.Name.Namespace == Tns);
        if (payload is null)
        {
            context.Response.StatusCode = StatusCodes.Status400BadRequest;
            return;
        }

        var soapAction = context.Request.Headers["SOAPAction"].ToString().Trim('"');
        var operation = ResolveOperation(soapAction, payload.Name.LocalName);
        var auth = await operations.AuthenticateAsync(
            GetValue(payload, "belediyeKodu"),
            GetValue(payload, "kullaniciAdi"),
            GetValue(payload, "sifre"),
            context.RequestAborted);

        XElement responseElement = operation switch
        {
            "servisKontrol" => BuildIslemSonuc("echoC", auth.BelediyeKodu ?? GetValue(payload, "belediyeKodu"), auth.SonucKodu, auth.SonucAciklamasi),
            _ when !auth.IsSuccess || auth.TenantId is null =>
                BuildOperationFailure(operation, auth.BelediyeKodu ?? GetValue(payload, "belediyeKodu"), auth.SonucKodu, auth.SonucAciklamasi),
            "gunlukFaaliyetSorgula" => await BuildGunlukFaaliyetResponseAsync(operations, auth.TenantId.Value, auth.BelediyeKodu!, context.RequestAborted),
            "basvuruTipiSorgula" => await BuildBasvuruTipiResponseAsync(operations, auth.TenantId.Value, auth.BelediyeKodu!, context.RequestAborted),
            "basvuruYap" => await BuildBasvuruYapResponseAsync(operations, auth.TenantId.Value, auth.BelediyeKodu!, payload, context.RequestAborted),
            "basvuruDurumSorgula" => await BuildBasvuruDurumResponseAsync(operations, auth.TenantId.Value, auth.BelediyeKodu!, GetValue(payload, "tcKimlikNo"), context.RequestAborted),
            "basvuruDetaySorgula" => await BuildBasvuruDetayResponseAsync(
                operations,
                auth.TenantId.Value,
                auth.BelediyeKodu!,
                GetValue(payload, "tcKimlikNo"),
                GetValue(payload, "basvuruNumarasi"),
                context.RequestAborted),
            "ayarOku" => await BuildAyarOkuResponseAsync(operations, auth.TenantId.Value, auth.BelediyeKodu!, GetValue(payload, "ayar"), context.RequestAborted),
            "ayarOkuListe" => await BuildAyarOkuListeResponseAsync(operations, auth.TenantId.Value, auth.BelediyeKodu!, GetValue(payload, "ayar"), context.RequestAborted),
            "ilceSorgula" => await BuildIlceResponseAsync(operations, auth.TenantId.Value, auth.BelediyeKodu!, context.RequestAborted),
            "mahalleSorgula" => await BuildMahalleResponseAsync(operations, auth.TenantId.Value, auth.BelediyeKodu!, GetValue(payload, "ilceKodu"), context.RequestAborted),
            "sokakCaddeSorgula" => await BuildSokakCaddeResponseAsync(
                operations,
                auth.TenantId.Value,
                auth.BelediyeKodu!,
                GetValue(payload, "ilceKodu"),
                GetValue(payload, "mahalleKodu"),
                context.RequestAborted),
            _ => BuildIslemSonuc("echoC", auth.BelediyeKodu!, "9999", "DESTEKLENMEYEN ISLEM"),
        };

        var envelope = new XDocument(
            new XElement(SoapEnv + "Envelope",
                new XAttribute(XNamespace.Xmlns + "soapenv", SoapEnv),
                new XElement(SoapEnv + "Body", responseElement)));

        context.Response.ContentType = "text/xml; charset=utf-8";
        context.Response.StatusCode = StatusCodes.Status200OK;
        await context.Response.WriteAsync(envelope.ToString(SaveOptions.DisableFormatting), context.RequestAborted);
    }

    private static string ResolveOperation(string soapAction, string rootLocalName)
        => soapAction switch
        {
            var action when action.Contains("servisKontrol", StringComparison.OrdinalIgnoreCase) => "servisKontrol",
            var action when action.Contains("gunlukFaaliyetSorgula", StringComparison.OrdinalIgnoreCase) => "gunlukFaaliyetSorgula",
            var action when action.Contains("basvuruTipiSorgula", StringComparison.OrdinalIgnoreCase) => "basvuruTipiSorgula",
            var action when action.Contains("basvuruYap", StringComparison.OrdinalIgnoreCase) => "basvuruYap",
            var action when action.Contains("basvuruDurumSorgula", StringComparison.OrdinalIgnoreCase) => "basvuruDurumSorgula",
            var action when action.Contains("basvuruDetaySorgula", StringComparison.OrdinalIgnoreCase) => "basvuruDetaySorgula",
            var action when action.Contains("ayarOkuListe", StringComparison.OrdinalIgnoreCase) => "ayarOkuListe",
            var action when action.Contains("ayarOku", StringComparison.OrdinalIgnoreCase) => "ayarOku",
            var action when action.Contains("ilceSorgula", StringComparison.OrdinalIgnoreCase) => "ilceSorgula",
            var action when action.Contains("mahalleSorgula", StringComparison.OrdinalIgnoreCase) => "mahalleSorgula",
            var action when action.Contains("sokakCaddeSorgula", StringComparison.OrdinalIgnoreCase) || action.Contains("sokakCaddeSorgulama", StringComparison.OrdinalIgnoreCase) => "sokakCaddeSorgula",
            _ => rootLocalName switch
            {
                "echoG" => "servisKontrol",
                "gunlukFaaliyetSorgulamaG" => "gunlukFaaliyetSorgula",
                "basvuruTipiBilgisiSorgulamaG" => "basvuruTipiSorgula",
                "basvuruYapG" => "basvuruYap",
                "basvuruDurumSorgulamaG" => "basvuruDurumSorgula",
                "basvuruDetaySorgulamaG" => "basvuruDetaySorgula",
                "ayarOkuG" or "ayarOkuListeG" => rootLocalName.StartsWith("ayarOkuListe", StringComparison.Ordinal) ? "ayarOkuListe" : "ayarOku",
                "ilceSorgulamaG" => "ilceSorgula",
                "mahalleSorgulaG" => "mahalleSorgula",
                "sokakCaddeSorgulamaG" => "sokakCaddeSorgula",
                _ => rootLocalName,
            },
        };

    private static async Task<XElement> BuildGunlukFaaliyetResponseAsync(
        IBelediyeSoapOperations operations,
        Guid tenantId,
        string belediyeKodu,
        CancellationToken cancellationToken)
    {
        var result = await operations.GunlukFaaliyetSorgulaAsync(tenantId, cancellationToken);
        if (!result.IsSuccess || result.Data is null)
        {
            return BuildIslemSonuc("gunlukFaaliyetSorgulamaC", belediyeKodu, result.SonucKodu, result.SonucAciklamasi);
        }

        var faaliyetListesi = new XElement(Tns + "faaliyetListesi");
        foreach (var item in result.Data.FaaliyetListesi)
        {
            faaliyetListesi.Add(new XElement(Tns + "faaliyetBilgisi",
                new XElement(Tns + "faaliyetTipi", item.FaaliyetTipi),
                new XElement(Tns + "ilce", item.Ilce),
                new XElement(Tns + "mahalle", item.Mahalle),
                new XElement(Tns + "sokakCadde", item.SokakCadde),
                new XElement(Tns + "aciklama", item.Aciklama)));
        }

        return new XElement(Tns + "gunlukFaaliyetSorgulamaC",
            BuildIslemSonucChildren(belediyeKodu, BelediyeSoapResultCodes.Success, BelediyeSoapResultCodes.SuccessMessage),
            faaliyetListesi);
    }

    private static async Task<XElement> BuildBasvuruTipiResponseAsync(
        IBelediyeSoapOperations operations,
        Guid tenantId,
        string belediyeKodu,
        CancellationToken cancellationToken)
    {
        var result = await operations.BasvuruTipiSorgulaAsync(tenantId, cancellationToken);
        if (!result.IsSuccess || result.Data is null)
        {
            return BuildIslemSonuc("basvuruTipiBilgisiSorgulamaC", belediyeKodu, result.SonucKodu, result.SonucAciklamasi);
        }

        var list = new XElement(Tns + "basvuruTipiListesi");
        foreach (var item in result.Data.BasvuruTipiListesi)
        {
            list.Add(new XElement(Tns + "basvuruTipi",
                new XElement(Tns + "kod", item.Kod),
                new XElement(Tns + "adi", item.Adi),
                new XElement(Tns + "aciklama", item.Aciklama)));
        }

        return new XElement(Tns + "basvuruTipiBilgisiSorgulamaC",
            BuildIslemSonucChildren(belediyeKodu, BelediyeSoapResultCodes.Success, BelediyeSoapResultCodes.SuccessMessage),
            list);
    }

    private static async Task<XElement> BuildBasvuruYapResponseAsync(
        IBelediyeSoapOperations operations,
        Guid tenantId,
        string belediyeKodu,
        XElement payload,
        CancellationToken cancellationToken)
    {
        var basvuruBilgileri = payload.Element(Tns + "basvuruBilgileri");
        if (basvuruBilgileri is null)
        {
            return BuildIslemSonuc("basvuruYapC", belediyeKodu, BelediyeSoapResultCodes.ValidationFailed, "BASVURU BILGILERI ZORUNLUDUR");
        }

        var request = new BelediyeSoapBasvuruYapRequest(
            GetValue(payload, "tcKimlikNo"),
            GetValue(basvuruBilgileri, "adi"),
            GetValue(basvuruBilgileri, "soyadi"),
            GetValue(basvuruBilgileri, "basvuruTipi"),
            GetValue(basvuruBilgileri, "basvuruDetay"),
            GetValue(basvuruBilgileri, "eposta"),
            ParseTelefonListesi(basvuruBilgileri),
            GetValue(basvuruBilgileri, "ilceKodu"),
            GetValue(basvuruBilgileri, "mahalleKodu"),
            GetValue(basvuruBilgileri, "sokakCaddeKodu"),
            GetValue(basvuruBilgileri, "disKapiNo"),
            GetValue(basvuruBilgileri, "icKapiNo"),
            GetValue(basvuruBilgileri, "basvuranAcikAdres"),
            GetValue(basvuruBilgileri, "basvuranNVIAdresNo"),
            GetValue(basvuruBilgileri.Element(Tns + "koordinat"), "enlem"),
            GetValue(basvuruBilgileri.Element(Tns + "koordinat"), "boylam"),
            GetValue(basvuruBilgileri, "cevapSekli"),
            ParseDosyaListesi(basvuruBilgileri));

        var result = await operations.BasvuruYapAsync(tenantId, request, cancellationToken);
        if (!result.IsSuccess || result.Data is null)
        {
            return BuildIslemSonuc("basvuruYapC", belediyeKodu, result.SonucKodu, result.SonucAciklamasi);
        }

        return new XElement(Tns + "basvuruYapC",
            BuildIslemSonucChildren(belediyeKodu, BelediyeSoapResultCodes.Success, BelediyeSoapResultCodes.SuccessMessage),
            new XElement(Tns + "basvuruTakipNo", result.Data.BasvuruTakipNo));
    }

    private static async Task<XElement> BuildBasvuruDurumResponseAsync(
        IBelediyeSoapOperations operations,
        Guid tenantId,
        string belediyeKodu,
        string tcKimlikNo,
        CancellationToken cancellationToken)
    {
        var result = await operations.BasvuruDurumSorgulaAsync(tenantId, tcKimlikNo, cancellationToken);
        if (!result.IsSuccess || result.Data is null)
        {
            return BuildIslemSonuc("basvuruDurumSorgulamaC", belediyeKodu, result.SonucKodu, result.SonucAciklamasi);
        }

        var list = new XElement(Tns + "basvuruDurumListesi");
        foreach (var item in result.Data.BasvuruDurumListesi)
        {
            list.Add(new XElement(Tns + "basvuruDurum",
                new XElement(Tns + "basvuruTarihi", item.BasvuruTarihi.ToString("o", CultureInfo.InvariantCulture)),
                new XElement(Tns + "basvuruNumarasi", item.BasvuruNumarasi),
                new XElement(Tns + "basvuruPlatform", item.BasvuruPlatform),
                new XElement(Tns + "basvuruDurumu", item.BasvuruDurumu),
                new XElement(Tns + "basvuruMetni", item.BasvuruMetni),
                new XElement(Tns + "basvuruTipi", item.BasvuruTipi)));
        }

        return new XElement(Tns + "basvuruDurumSorgulamaC",
            BuildIslemSonucChildren(belediyeKodu, BelediyeSoapResultCodes.Success, BelediyeSoapResultCodes.SuccessMessage),
            list);
    }

    private static async Task<XElement> BuildBasvuruDetayResponseAsync(
        IBelediyeSoapOperations operations,
        Guid tenantId,
        string belediyeKodu,
        string tcKimlikNo,
        string basvuruNumarasi,
        CancellationToken cancellationToken)
    {
        var result = await operations.BasvuruDetaySorgulaAsync(tenantId, tcKimlikNo, basvuruNumarasi, cancellationToken);
        if (!result.IsSuccess || result.Data is null)
        {
            return BuildIslemSonuc("basvuruDetaySorgulamaC", belediyeKodu, result.SonucKodu, result.SonucAciklamasi);
        }

        var data = result.Data;
        var telefonListesi = new XElement(Tns + "telefonListesi");
        foreach (var phone in data.TelefonListesi)
        {
            telefonListesi.Add(new XElement(Tns + "telefonBilgisi",
                new XElement(Tns + "telefonTipi", phone.TelefonTipi),
                new XElement(Tns + "telefonNumarasi", phone.TelefonNumarasi)));
        }

        var surecListesi = new XElement(Tns + "basvuruSurecListesi");
        foreach (var surec in data.BasvuruSurecListesi)
        {
            surecListesi.Add(new XElement(Tns + "surecBilgisi",
                new XElement(Tns + "atananBirim", surec.AtananBirim),
                new XElement(Tns + "atanmaTarihi", surec.AtanmaTarihi.ToString("o", CultureInfo.InvariantCulture)),
                surec.BirimCevapTarihi is null
                    ? new XElement(Tns + "birimcevapTarihi", new XAttribute(Xsi + "nil", "true"))
                    : new XElement(Tns + "birimcevapTarihi", surec.BirimCevapTarihi.Value.ToString("o", CultureInfo.InvariantCulture)),
                new XElement(Tns + "durumu", surec.Durumu),
                new XElement(Tns + "aciklama", surec.Aciklama)));
        }

        var notListesi = new XElement(Tns + "basvuruNotListesi");
        foreach (var note in data.BasvuruNotListesi)
        {
            notListesi.Add(new XElement(Tns + "basvuruNot",
                new XElement(Tns + "notSiraNumarasi", note.NotSiraNumarasi),
                new XElement(Tns + "notTarihi", note.NotTarihi.ToString("o", CultureInfo.InvariantCulture)),
                new XElement(Tns + "notMetin", note.NotMetin)));
        }

        return new XElement(Tns + "basvuruDetaySorgulamaC",
            BuildIslemSonucChildren(belediyeKodu, BelediyeSoapResultCodes.Success, BelediyeSoapResultCodes.SuccessMessage),
            new XElement(Tns + "basvuruNumarasi", data.BasvuruNumarasi),
            new XElement(Tns + "basvuruTarihi", data.BasvuruTarihi.ToString("o", CultureInfo.InvariantCulture)),
            new XElement(Tns + "aboneNo", data.AboneNo),
            new XElement(Tns + "basvuruTipi", data.BasvuruTipi),
            new XElement(Tns + "ilceAdi", data.IlceAdi),
            new XElement(Tns + "mahalleAdi", data.MahalleAdi),
            new XElement(Tns + "sokakCaddeAdi", data.SokakCaddeAdi),
            new XElement(Tns + "disKapiNo", data.DisKapiNo),
            new XElement(Tns + "icKapiNo", data.IcKapiNo),
            new XElement(Tns + "basvuranAcikAdres", data.BasvuranAcikAdres),
            new XElement(Tns + "eposta", data.Eposta),
            telefonListesi,
            new XElement(Tns + "basvuruIstek", data.BasvuruIstek),
            new XElement(Tns + "cevapSekli", data.CevapSekli),
            surecListesi,
            new XElement(Tns + "basvuruDurumu", data.BasvuruDurumu),
            data.BasvuruCevapTarihi is null
                ? new XElement(Tns + "basvuruCevapTarihi", new XAttribute(Xsi + "nil", "true"))
                : new XElement(Tns + "basvuruCevapTarihi", data.BasvuruCevapTarihi.Value.ToString("o", CultureInfo.InvariantCulture)),
            new XElement(Tns + "basvuruCevapMetin", data.BasvuruCevapMetin),
            notListesi,
            new XElement(Tns + "detayListesi"));
    }

    private static async Task<XElement> BuildAyarOkuResponseAsync(
        IBelediyeSoapOperations operations,
        Guid tenantId,
        string belediyeKodu,
        string ayar,
        CancellationToken cancellationToken)
    {
        var result = await operations.AyarOkuAsync(tenantId, ayar, cancellationToken);
        if (!result.IsSuccess)
        {
            return BuildIslemSonuc("ayarOkuC", belediyeKodu, result.SonucKodu, result.SonucAciklamasi);
        }

        return new XElement(Tns + "ayarOkuC",
            BuildIslemSonucChildren(belediyeKodu, BelediyeSoapResultCodes.Success, BelediyeSoapResultCodes.SuccessMessage),
            new XElement(Tns + "deger", result.Data ?? string.Empty));
    }

    private static async Task<XElement> BuildAyarOkuListeResponseAsync(
        IBelediyeSoapOperations operations,
        Guid tenantId,
        string belediyeKodu,
        string ayar,
        CancellationToken cancellationToken)
    {
        var result = await operations.AyarOkuListeAsync(tenantId, ayar, cancellationToken);
        if (!result.IsSuccess || result.Data is null)
        {
            return BuildIslemSonuc("ayarOkuListeC", belediyeKodu, result.SonucKodu, result.SonucAciklamasi);
        }

        var detayListesi = new XElement(Tns + "detayListesi");
        foreach (var item in result.Data)
        {
            detayListesi.Add(new XElement(Tns + "detay",
                new XElement(Tns + "anahtar", item.Anahtar),
                new XElement(Tns + "deger", item.Deger)));
        }

        return new XElement(Tns + "ayarOkuListeC",
            BuildIslemSonucChildren(belediyeKodu, BelediyeSoapResultCodes.Success, BelediyeSoapResultCodes.SuccessMessage),
            detayListesi);
    }

    private static async Task<XElement> BuildIlceResponseAsync(
        IBelediyeSoapOperations operations,
        Guid tenantId,
        string belediyeKodu,
        CancellationToken cancellationToken)
    {
        var result = await operations.IlceSorgulaAsync(tenantId, cancellationToken);
        if (!result.IsSuccess || result.Data is null)
        {
            return BuildIslemSonuc("ilceSorgulamaC", belediyeKodu, result.SonucKodu, result.SonucAciklamasi);
        }

        var list = new XElement(Tns + "ilceListesi");
        foreach (var item in result.Data.IlceListesi)
        {
            list.Add(new XElement(Tns + "ilceBilgisi",
                new XElement(Tns + "ilceKodu", item.IlceKodu),
                new XElement(Tns + "ilceAdi", item.IlceAdi)));
        }

        return new XElement(Tns + "ilceSorgulamaC",
            BuildIslemSonucChildren(belediyeKodu, BelediyeSoapResultCodes.Success, BelediyeSoapResultCodes.SuccessMessage),
            list);
    }

    private static async Task<XElement> BuildMahalleResponseAsync(
        IBelediyeSoapOperations operations,
        Guid tenantId,
        string belediyeKodu,
        string ilceKodu,
        CancellationToken cancellationToken)
    {
        var result = await operations.MahalleSorgulaAsync(tenantId, ilceKodu, cancellationToken);
        if (!result.IsSuccess || result.Data is null)
        {
            return BuildIslemSonuc("mahalleSorgulamaC", belediyeKodu, result.SonucKodu, result.SonucAciklamasi);
        }

        var list = new XElement(Tns + "mahalleListesi");
        foreach (var item in result.Data.MahalleListesi)
        {
            list.Add(new XElement(Tns + "mahalleBilgisi",
                new XElement(Tns + "mahalleKodu", item.MahalleKodu),
                new XElement(Tns + "mahalleAdi", item.MahalleAdi)));
        }

        return new XElement(Tns + "mahalleSorgulamaC",
            BuildIslemSonucChildren(belediyeKodu, BelediyeSoapResultCodes.Success, BelediyeSoapResultCodes.SuccessMessage),
            list);
    }

    private static async Task<XElement> BuildSokakCaddeResponseAsync(
        IBelediyeSoapOperations operations,
        Guid tenantId,
        string belediyeKodu,
        string ilceKodu,
        string mahalleKodu,
        CancellationToken cancellationToken)
    {
        var result = await operations.SokakCaddeSorgulaAsync(tenantId, ilceKodu, mahalleKodu, cancellationToken);
        if (!result.IsSuccess || result.Data is null)
        {
            return BuildIslemSonuc("sokakCaddeSorgulamaC", belediyeKodu, result.SonucKodu, result.SonucAciklamasi);
        }

        var list = new XElement(Tns + "sokakCaddeListesi");
        foreach (var item in result.Data.SokakCaddeListesi)
        {
            list.Add(new XElement(Tns + "sokakCaddeBilgisi",
                new XElement(Tns + "sokakCaddeKodu", item.SokakCaddeKodu),
                new XElement(Tns + "sokakCaddeAdi", item.SokakCaddeAdi)));
        }

        return new XElement(Tns + "sokakCaddeSorgulamaC",
            BuildIslemSonucChildren(belediyeKodu, BelediyeSoapResultCodes.Success, BelediyeSoapResultCodes.SuccessMessage),
            list);
    }

    private static XElement BuildOperationFailure(string operation, string belediyeKodu, string sonucKodu, string sonucAciklamasi)
        => operation switch
        {
            "gunlukFaaliyetSorgula" => BuildIslemSonuc("gunlukFaaliyetSorgulamaC", belediyeKodu, sonucKodu, sonucAciklamasi),
            "basvuruTipiSorgula" => BuildIslemSonuc("basvuruTipiBilgisiSorgulamaC", belediyeKodu, sonucKodu, sonucAciklamasi),
            "basvuruYap" => BuildIslemSonuc("basvuruYapC", belediyeKodu, sonucKodu, sonucAciklamasi),
            "basvuruDurumSorgula" => BuildIslemSonuc("basvuruDurumSorgulamaC", belediyeKodu, sonucKodu, sonucAciklamasi),
            "basvuruDetaySorgula" => BuildIslemSonuc("basvuruDetaySorgulamaC", belediyeKodu, sonucKodu, sonucAciklamasi),
            "ayarOku" => BuildIslemSonuc("ayarOkuC", belediyeKodu, sonucKodu, sonucAciklamasi),
            "ayarOkuListe" => BuildIslemSonuc("ayarOkuListeC", belediyeKodu, sonucKodu, sonucAciklamasi),
            "ilceSorgula" => BuildIslemSonuc("ilceSorgulamaC", belediyeKodu, sonucKodu, sonucAciklamasi),
            "mahalleSorgula" => BuildIslemSonuc("mahalleSorgulamaC", belediyeKodu, sonucKodu, sonucAciklamasi),
            "sokakCaddeSorgula" => BuildIslemSonuc("sokakCaddeSorgulamaC", belediyeKodu, sonucKodu, sonucAciklamasi),
            _ => BuildIslemSonuc("echoC", belediyeKodu, sonucKodu, sonucAciklamasi),
        };

    private static XElement BuildIslemSonuc(string elementName, string belediyeKodu, string sonucKodu, string sonucAciklamasi)
        => new(Tns + elementName, BuildIslemSonucChildren(belediyeKodu, sonucKodu, sonucAciklamasi));

    private static object[] BuildIslemSonucChildren(string belediyeKodu, string sonucKodu, string sonucAciklamasi)
        =>
        [
            new XElement(Tns + "belediyeKodu", belediyeKodu),
            new XElement(Tns + "sonucKodu", sonucKodu),
            new XElement(Tns + "sonucAciklamasi", sonucAciklamasi),
        ];

    private static string GetValue(XElement? element, string name)
        => element?.Element(Tns + name)?.Value?.Trim() ?? string.Empty;

    private static IReadOnlyList<string> ParseTelefonListesi(XElement basvuruBilgileri)
    {
        var list = basvuruBilgileri.Element(Tns + "telefonListesi");
        if (list is null)
        {
            return Array.Empty<string>();
        }

        return list.Elements(Tns + "telefonBilgisi")
            .Select(element => GetValue(element, "telefonNumarasi"))
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .ToList();
    }

    private static IReadOnlyList<BelediyeSoapBasvuruDosyaItem> ParseDosyaListesi(XElement basvuruBilgileri)
    {
        var list = basvuruBilgileri.Element(Tns + "dosyaListesi");
        if (list is null)
        {
            return Array.Empty<BelediyeSoapBasvuruDosyaItem>();
        }

        return list.Elements(Tns + "dosyaBilgisi")
            .Select(element =>
            {
                var raw = element.Element(Tns + "dosya")?.Value ?? string.Empty;
                byte[] bytes;
                try
                {
                    bytes = string.IsNullOrWhiteSpace(raw) ? Array.Empty<byte>() : Convert.FromBase64String(raw);
                }
                catch (FormatException)
                {
                    bytes = Array.Empty<byte>();
                }

                return new BelediyeSoapBasvuruDosyaItem(
                    GetValue(element, "dosyaCesidi"),
                    GetValue(element, "dosyauzanti"),
                    GetValue(element, "belgeTarihi"),
                    GetValue(element, "belgeSayisi"),
                    bytes);
            })
            .Where(item => item.Dosya.Length > 0)
            .ToList();
    }
}

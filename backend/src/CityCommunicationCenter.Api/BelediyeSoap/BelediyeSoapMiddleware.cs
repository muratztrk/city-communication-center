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

    private const string AuthLockedOutMessage = "COK FAZLA HATALI GIRIS DENEMESI, DAHA SONRA TEKRAR DENEYINIZ";

    private readonly RequestDelegate _next;
    private readonly BelediyeSoapAuthThrottle _authThrottle;

    public BelediyeSoapMiddleware(RequestDelegate next, BelediyeSoapAuthThrottle? authThrottle = null)
    {
        _next = next;
        _authThrottle = authThrottle ?? new BelediyeSoapAuthThrottle(new BelediyeSoapAuthThrottleOptions());
    }

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
        var auth = await AuthenticateAsync(context, operations, payload);

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
            "bilgilendirmeIstegiYap" => await BuildBilgilendirmeIstegiYapResponseAsync(operations, auth.TenantId.Value, auth.BelediyeKodu!, payload, context.RequestAborted),
            "bilgilendirmeIstegiSorgula" => await BuildBilgilendirmeIstegiSorgulaResponseAsync(operations, auth.TenantId.Value, auth.BelediyeKodu!, GetValue(payload, "tcKimlikNo"), context.RequestAborted),
            "bilgilendirmeIstegiIptal" => await BuildBilgilendirmeIstegiIptalResponseAsync(operations, auth.TenantId.Value, auth.BelediyeKodu!, GetValue(payload, "tcKimlikNo"), context.RequestAborted),
            "smsBilgilendirmeTurleriSorgula" => await BuildBilgilendirmeTurleriResponseAsync(operations, auth.TenantId.Value, auth.BelediyeKodu!, sms: true, context.RequestAborted),
            "epostaBilgilendirmeTurleriSorgula" => await BuildBilgilendirmeTurleriResponseAsync(operations, auth.TenantId.Value, auth.BelediyeKodu!, sms: false, context.RequestAborted),
            "basvuruNotEkle" => await BuildBasvuruNotEkleResponseAsync(operations, auth.TenantId.Value, auth.BelediyeKodu!, payload, context.RequestAborted),
            "basvuruyuTekrarAc" => await BuildBasvuruyuTekrarAcResponseAsync(operations, auth.TenantId.Value, auth.BelediyeKodu!, payload, context.RequestAborted),
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
            var action when action.Contains("bilgilendirmeIstegiYap", StringComparison.OrdinalIgnoreCase) => "bilgilendirmeIstegiYap",
            var action when action.Contains("bilgilendirmeIstegiSorgula", StringComparison.OrdinalIgnoreCase) => "bilgilendirmeIstegiSorgula",
            var action when action.Contains("bilgilendirmeIstegiIptal", StringComparison.OrdinalIgnoreCase) => "bilgilendirmeIstegiIptal",
            var action when action.Contains("smsBilgilendirmeTurleriSorgula", StringComparison.OrdinalIgnoreCase) => "smsBilgilendirmeTurleriSorgula",
            var action when action.Contains("epostaBilgilendirmeTurleriSorgula", StringComparison.OrdinalIgnoreCase) => "epostaBilgilendirmeTurleriSorgula",
            var action when action.Contains("basvuruNotEkle", StringComparison.OrdinalIgnoreCase) => "basvuruNotEkle",
            var action when action.Contains("basvuruyuTekrarAc", StringComparison.OrdinalIgnoreCase) => "basvuruyuTekrarAc",
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
                "bilgilendirmeIstegiYapG" => "bilgilendirmeIstegiYap",
                "bilgilendirmeIstegiSorgulaG" => "bilgilendirmeIstegiSorgula",
                "bilgilendirmeIstegiIptalG" => "bilgilendirmeIstegiIptal",
                "smsBilgilendirmeTurleriSorgulaG" => "smsBilgilendirmeTurleriSorgula",
                "epostaBilgilendirmeTurleriSorgulaG" => "epostaBilgilendirmeTurleriSorgula",
                "basvuruNotEkleG" => "basvuruNotEkle",
                "basvuruyuTekrarAcG" => "basvuruyuTekrarAc",
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
        var basvuruBilgileri = Child(payload, "basvuruBilgileri");
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
            GetValue(Child(basvuruBilgileri, "koordinat"), "enlem"),
            GetValue(Child(basvuruBilgileri, "koordinat"), "boylam"),
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

    private static async Task<XElement> BuildBilgilendirmeIstegiYapResponseAsync(
        IBelediyeSoapOperations operations,
        Guid tenantId,
        string belediyeKodu,
        XElement payload,
        CancellationToken cancellationToken)
    {
        var telefon = Child(payload, "cepTelefonu");
        var request = new BelediyeSoapBilgilendirmeIstegiYapRequest(
            GetValue(payload, "adi"),
            GetValue(payload, "soyadi"),
            GetValue(payload, "eposta"),
            GetValue(telefon, "ulkeKodu"),
            GetValue(telefon, "telefonNo"),
            ParseKodListesi(payload, "ilgilenilenMahalleListesi"),
            ParseBoolean(GetValue(payload, "belediyeIletisimBilgisiniGuncelle")),
            ParseKodListesi(payload, "secilenSMSBilgilendirmeKategoriListesi"),
            ParseKodListesi(payload, "secilenEpostaBilgilendirmeKategoriListesi"));

        var result = await operations.BilgilendirmeIstegiYapAsync(tenantId, GetValue(payload, "tcKimlikNo"), request, cancellationToken);
        return result.IsSuccess
            ? BuildIslemSonuc("bilgilendirmeIstegiYapC", belediyeKodu, BelediyeSoapResultCodes.Success, BelediyeSoapResultCodes.SuccessMessage)
            : BuildIslemSonuc("bilgilendirmeIstegiYapC", belediyeKodu, result.SonucKodu, result.SonucAciklamasi);
    }

    private static async Task<XElement> BuildBilgilendirmeIstegiIptalResponseAsync(
        IBelediyeSoapOperations operations,
        Guid tenantId,
        string belediyeKodu,
        string tcKimlikNo,
        CancellationToken cancellationToken)
    {
        var result = await operations.BilgilendirmeIstegiIptalAsync(tenantId, tcKimlikNo, cancellationToken);
        return result.IsSuccess
            ? BuildIslemSonuc("bilgilendirmeIstegiIptalC", belediyeKodu, BelediyeSoapResultCodes.Success, BelediyeSoapResultCodes.SuccessMessage)
            : BuildIslemSonuc("bilgilendirmeIstegiIptalC", belediyeKodu, result.SonucKodu, result.SonucAciklamasi);
    }

    private static async Task<XElement> BuildBilgilendirmeIstegiSorgulaResponseAsync(
        IBelediyeSoapOperations operations,
        Guid tenantId,
        string belediyeKodu,
        string tcKimlikNo,
        CancellationToken cancellationToken)
    {
        var result = await operations.BilgilendirmeIstegiSorgulaAsync(tenantId, tcKimlikNo, cancellationToken);
        if (!result.IsSuccess)
        {
            return BuildIslemSonuc("bilgilendirmeIstegiSorgulaC", belediyeKodu, result.SonucKodu, result.SonucAciklamasi);
        }

        var kayit = result.Data;
        XElement kayitElement;
        if (kayit is null)
        {
            kayitElement = new XElement(Tns + "kayitliBilgilendirmeIstegi", new XAttribute(Xsi + "nil", "true"));
        }
        else
        {
            var mahalleler = new XElement(Tns + "ilgilenilenMahalleListesi");
            foreach (var mahalle in kayit.Mahalleler)
            {
                mahalleler.Add(new XElement(Tns + "mahalleBilgisi",
                    new XElement(Tns + "mahalleKodu", mahalle.MahalleKodu),
                    new XElement(Tns + "mahalleAdi", mahalle.MahalleAdi)));
            }

            kayitElement = new XElement(Tns + "kayitliBilgilendirmeIstegi",
                new XElement(Tns + "eposta", kayit.Eposta),
                new XElement(Tns + "cepTelefonu",
                    new XElement(Tns + "telefonTuru", "CEP"),
                    new XElement(Tns + "ulkeKodu", kayit.CepUlkeKodu),
                    new XElement(Tns + "telefonNo", kayit.CepTelefonNo)),
                mahalleler,
                BuildBilgilendirmeTurListesi("secilenSMSBilgilendirmeKategoriListesi", kayit.SmsKategorileri),
                BuildBilgilendirmeTurListesi("secilenEpostaBilgilendirmeKategoriListesi", kayit.EpostaKategorileri));
        }

        return new XElement(Tns + "bilgilendirmeIstegiSorgulaC",
            BuildIslemSonucChildren(belediyeKodu, BelediyeSoapResultCodes.Success, BelediyeSoapResultCodes.SuccessMessage),
            kayitElement);
    }

    private static async Task<XElement> BuildBilgilendirmeTurleriResponseAsync(
        IBelediyeSoapOperations operations,
        Guid tenantId,
        string belediyeKodu,
        bool sms,
        CancellationToken cancellationToken)
    {
        var elementName = sms ? "smsBilgilendirmeTurleriSorgulaC" : "epostaBilgilendirmeTurleriSorgulaC";
        var result = await operations.BilgilendirmeTurleriSorgulaAsync(tenantId, sms, cancellationToken);
        if (!result.IsSuccess || result.Data is null)
        {
            return BuildIslemSonuc(elementName, belediyeKodu, result.SonucKodu, result.SonucAciklamasi);
        }

        return new XElement(Tns + elementName,
            BuildIslemSonucChildren(belediyeKodu, BelediyeSoapResultCodes.Success, BelediyeSoapResultCodes.SuccessMessage),
            BuildBilgilendirmeTurListesi("bilgilendirmeTurListesi", result.Data.BilgilendirmeTurListesi));
    }

    private static XElement BuildBilgilendirmeTurListesi(string name, IEnumerable<BelediyeSoapBilgilendirmeTurItem> items)
    {
        var list = new XElement(Tns + name);
        foreach (var item in items)
        {
            list.Add(new XElement(Tns + "bilgilendirmeTuru",
                new XElement(Tns + "bilgilendirmeTurKodu", item.Kod),
                new XElement(Tns + "bilgilendirmeTurAdi", item.Ad),
                new XElement(Tns + "bilgilendirmeAciklama", item.Aciklama)));
        }

        return list;
    }

    // Kilitli istemcide kimlik bilgisi hic denetlenmez; boylece kilit suresince sifre tahmini sonuc vermez.
    private async Task<BelediyeSoapAuthResult> AuthenticateAsync(HttpContext context, IBelediyeSoapOperations operations, XElement payload)
    {
        var clientKey = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        var belediyeKodu = GetValue(payload, "belediyeKodu");
        if (_authThrottle.IsLockedOut(clientKey))
        {
            return new BelediyeSoapAuthResult(false, null, belediyeKodu, BelediyeSoapResultCodes.AuthFailed, AuthLockedOutMessage);
        }

        var auth = await operations.AuthenticateAsync(
            belediyeKodu,
            GetValue(payload, "kullaniciAdi"),
            GetValue(payload, "sifre"),
            context.RequestAborted);

        if (auth.IsSuccess)
        {
            _authThrottle.Reset(clientKey);
        }
        else
        {
            _authThrottle.RegisterFailure(clientKey);
        }

        return auth;
    }

    private static async Task<XElement> BuildBasvuruNotEkleResponseAsync(
        IBelediyeSoapOperations operations,
        Guid tenantId,
        string belediyeKodu,
        XElement payload,
        CancellationToken cancellationToken)
    {
        var result = await operations.BasvuruNotEkleAsync(
            tenantId,
            GetValue(payload, "tcKimlikNo"),
            GetValue(payload, "basvuruNo"),
            GetValue(payload, "eklenecekNot"),
            cancellationToken);

        return result.IsSuccess
            ? BuildIslemSonuc("basvuruNotEkleC", belediyeKodu, BelediyeSoapResultCodes.Success, BelediyeSoapResultCodes.SuccessMessage)
            : BuildIslemSonuc("basvuruNotEkleC", belediyeKodu, result.SonucKodu, result.SonucAciklamasi);
    }

    private static async Task<XElement> BuildBasvuruyuTekrarAcResponseAsync(
        IBelediyeSoapOperations operations,
        Guid tenantId,
        string belediyeKodu,
        XElement payload,
        CancellationToken cancellationToken)
    {
        var result = await operations.BasvuruyuTekrarAcAsync(
            tenantId,
            GetValue(payload, "tcKimlikNo"),
            GetValue(payload, "basvuruNo"),
            GetValue(payload, "acilmaNedeni"),
            cancellationToken);

        return result.IsSuccess
            ? BuildIslemSonuc("basvuruyuTekrarAcC", belediyeKodu, BelediyeSoapResultCodes.Success, BelediyeSoapResultCodes.SuccessMessage)
            : BuildIslemSonuc("basvuruyuTekrarAcC", belediyeKodu, result.SonucKodu, result.SonucAciklamasi);
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
            "bilgilendirmeIstegiYap" => BuildIslemSonuc("bilgilendirmeIstegiYapC", belediyeKodu, sonucKodu, sonucAciklamasi),
            "bilgilendirmeIstegiSorgula" => BuildIslemSonuc("bilgilendirmeIstegiSorgulaC", belediyeKodu, sonucKodu, sonucAciklamasi),
            "bilgilendirmeIstegiIptal" => BuildIslemSonuc("bilgilendirmeIstegiIptalC", belediyeKodu, sonucKodu, sonucAciklamasi),
            "smsBilgilendirmeTurleriSorgula" => BuildIslemSonuc("smsBilgilendirmeTurleriSorgulaC", belediyeKodu, sonucKodu, sonucAciklamasi),
            "epostaBilgilendirmeTurleriSorgula" => BuildIslemSonuc("epostaBilgilendirmeTurleriSorgulaC", belediyeKodu, sonucKodu, sonucAciklamasi),
            "basvuruNotEkle" => BuildIslemSonuc("basvuruNotEkleC", belediyeKodu, sonucKodu, sonucAciklamasi),
            "basvuruyuTekrarAc" => BuildIslemSonuc("basvuruyuTekrarAcC", belediyeKodu, sonucKodu, sonucAciklamasi),
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

    // WSDL elementFormDefault="unqualified": istemciler govde elemanlarini namespace'siz gonderir; eski (qualified)
    // istemciler ise v3 namespace'iyle. Her ikisi de kabul edilir, bu yuzden ada gore (namespace'ten bagimsiz) okunur.
    private static XElement? Child(XElement? parent, string name)
        => parent?.Elements().FirstOrDefault(element => element.Name.LocalName == name);

    private static IEnumerable<XElement> Children(XElement parent, string name)
        => parent.Elements().Where(element => element.Name.LocalName == name);

    private static string GetValue(XElement? element, string name)
        => Child(element, name)?.Value?.Trim() ?? string.Empty;

    private static IReadOnlyList<string> ParseKodListesi(XElement parent, string listName)
    {
        var list = Child(parent, listName);
        return list is null
            ? Array.Empty<string>()
            : Children(list, "kod").Select(element => element.Value.Trim()).Where(value => value.Length > 0).ToList();
    }

    private static bool ParseBoolean(string value)
        => value.Equals("true", StringComparison.OrdinalIgnoreCase) || value == "1";

    private static IReadOnlyList<string> ParseTelefonListesi(XElement basvuruBilgileri)
    {
        var list = Child(basvuruBilgileri, "telefonListesi");
        if (list is null)
        {
            return Array.Empty<string>();
        }

        return Children(list, "telefonBilgisi")
            .Select(element => GetValue(element, "telefonNumarasi"))
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .ToList();
    }

    private static IReadOnlyList<BelediyeSoapBasvuruDosyaItem> ParseDosyaListesi(XElement basvuruBilgileri)
    {
        var list = Child(basvuruBilgileri, "dosyaListesi");
        if (list is null)
        {
            return Array.Empty<BelediyeSoapBasvuruDosyaItem>();
        }

        return Children(list, "dosyaBilgisi")
            .Select(element =>
            {
                var raw = Child(element, "dosya")?.Value ?? string.Empty;
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

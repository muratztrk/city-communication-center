using System.Text;
using CityCommunicationCenter.Api.BelediyeSoap;
using CityCommunicationCenter.Application.Abstractions.BelediyeSoap;
using CityCommunicationCenter.Application.Abstractions.SocialMedia;
using CityCommunicationCenter.Domain.Entities;
using CityCommunicationCenter.Infrastructure.BelediyeSoap;
using CityCommunicationCenter.Infrastructure.Persistence;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;

namespace CityCommunicationCenter.Application.Tests.BelediyeSoap;

public sealed class BelediyeSoapBilgilendirmeTests
{
    private static readonly Guid TenantId = Guid.Parse("b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e");
    private const string Tc = "10000000146";

    [Fact]
    public async Task TurleriSorgula_ReturnsDefaults_AndConfiguredListsWhenSet()
    {
        var (defaults, _) = await CreateAsync();
        var sms = (await defaults.BilgilendirmeTurleriSorgulaAsync(TenantId, sms: true, default)).Data!.BilgilendirmeTurListesi;
        var eposta = (await defaults.BilgilendirmeTurleriSorgulaAsync(TenantId, sms: false, default)).Data!.BilgilendirmeTurListesi;
        Assert.Equal(3, sms.Count);
        Assert.Equal(4, eposta.Count);

        var (custom, _) = await CreateAsync("""{"sms":[{"kod":"A","ad":"Kategori A","aciklama":"x"},{"kod":"a","ad":"tekrar"}]}""");
        var customSms = (await custom.BilgilendirmeTurleriSorgulaAsync(TenantId, sms: true, default)).Data!.BilgilendirmeTurListesi;
        var customEposta = (await custom.BilgilendirmeTurleriSorgulaAsync(TenantId, sms: false, default)).Data!.BilgilendirmeTurListesi;
        Assert.Equal("A", Assert.Single(customSms).Kod);
        Assert.Equal(4, customEposta.Count);
    }

    [Fact]
    public async Task Lifecycle_YapSorgulaGuncelleIptalYenidenYap()
    {
        var (operations, db) = await CreateAsync();
        db.Jobs.Add(new Job { JobId = Guid.NewGuid(), TenantId = TenantId, Title = "t", Neighborhood = "Zafer Mahallesi", Street = "Gül Sokak" });
        await db.SaveChangesAsync();
        var zafer = (await operations.MahalleSorgulaAsync(TenantId, "1", default)).Data!.MahalleListesi.Single();

        Assert.True((await operations.BilgilendirmeIstegiYapAsync(TenantId, Tc, NewRequest(mahalleKodlari: [zafer.MahalleKodu]), default)).IsSuccess);

        var kayit = (await operations.BilgilendirmeIstegiSorgulaAsync(TenantId, Tc, default)).Data!;
        Assert.Equal("ayse@example.com", kayit.Eposta);
        Assert.Equal("5321234567", kayit.CepTelefonNo);
        Assert.Equal("90", kayit.CepUlkeKodu);
        Assert.Equal("Zafer Mahallesi", Assert.Single(kayit.Mahalleler).MahalleAdi);
        Assert.Equal(["DUYURU"], kayit.SmsKategorileri.Select(x => x.Kod));
        Assert.Equal(["DUYURU", "MECLIS"], kayit.EpostaKategorileri.Select(x => x.Kod));

        // Ayni TC icin tekrar Yap: ikinci kayit olusmaz, mevcut guncellenir.
        var guncel = NewRequest(eposta: "yeni@example.com", smsKodlari: ["ETKINLIK", "etkinlik"], epostaKodlari: []);
        Assert.True((await operations.BilgilendirmeIstegiYapAsync(TenantId, Tc, guncel, default)).IsSuccess);
        Assert.Equal(1, await db.BilgilendirmeIstekleri.IgnoreQueryFilters().CountAsync());
        kayit = (await operations.BilgilendirmeIstegiSorgulaAsync(TenantId, Tc, default)).Data!;
        Assert.Equal("yeni@example.com", kayit.Eposta);
        Assert.Equal(["ETKINLIK"], kayit.SmsKategorileri.Select(x => x.Kod));
        Assert.Empty(kayit.EpostaKategorileri);
        Assert.Empty(kayit.Mahalleler);

        Assert.True((await operations.BilgilendirmeIstegiIptalAsync(TenantId, Tc, default)).IsSuccess);
        var sonra = await operations.BilgilendirmeIstegiSorgulaAsync(TenantId, Tc, default);
        Assert.True(sonra.IsSuccess);
        Assert.Null(sonra.Data);
        Assert.Equal(BelediyeSoapResultCodes.NotFound, (await operations.BilgilendirmeIstegiIptalAsync(TenantId, Tc, default)).SonucKodu);

        Assert.True((await operations.BilgilendirmeIstegiYapAsync(TenantId, Tc, NewRequest(), default)).IsSuccess);
        Assert.NotNull((await operations.BilgilendirmeIstegiSorgulaAsync(TenantId, Tc, default)).Data);
        Assert.Equal(1, await db.BilgilendirmeIstekleri.IgnoreQueryFilters().CountAsync());
    }

    [Theory]
    [InlineData("tcKisa")]
    [InlineData("eposta")]
    [InlineData("telefon")]
    [InlineData("ad")]
    [InlineData("kategoriYok")]
    [InlineData("kategoriBilinmiyor")]
    [InlineData("mahalleBilinmiyor")]
    public async Task Yap_RejectsInvalidInput(string senaryo)
    {
        var (operations, db) = await CreateAsync();
        var tc = Tc;
        var request = NewRequest();
        switch (senaryo)
        {
            case "tcKisa": tc = "123"; break;
            case "eposta": request = NewRequest(eposta: "gecersiz"); break;
            case "telefon": request = NewRequest(telefon: "123"); break;
            case "ad": request = NewRequest(adi: new string('a', 31)); break;
            case "kategoriYok": request = NewRequest(smsKodlari: [], epostaKodlari: []); break;
            case "kategoriBilinmiyor": request = NewRequest(smsKodlari: ["YOK"]); break;
            case "mahalleBilinmiyor": request = NewRequest(mahalleKodlari: ["3"]); break;
        }

        var result = await operations.BilgilendirmeIstegiYapAsync(TenantId, tc, request, default);

        Assert.False(result.IsSuccess);
        Assert.Equal(BelediyeSoapResultCodes.ValidationFailed, result.SonucKodu);
        Assert.Equal(0, await db.BilgilendirmeIstekleri.IgnoreQueryFilters().CountAsync());
    }

    [Fact]
    public async Task Middleware_EndToEnd_UnqualifiedRequests()
    {
        var (operations, _) = await CreateAsync();

        var bos = await PostAsync(operations, Envelope("bilgilendirmeIstegiSorgulaG", $"<tcKimlikNo>{Tc}</tcKimlikNo>"));
        Assert.Contains("<sonucKodu>0000</sonucKodu>", bos);
        Assert.Contains("nil=\"true\"", bos);

        var yap = await PostAsync(operations, Envelope("bilgilendirmeIstegiYapG", $$"""
            <tcKimlikNo>{{Tc}}</tcKimlikNo>
            <adi>Ayse</adi><soyadi>Yilmaz</soyadi><eposta>ayse@example.com</eposta>
            <cepTelefonu><telefonTuru>CEP</telefonTuru><ulkeKodu>90</ulkeKodu><telefonNo>5321234567</telefonNo></cepTelefonu>
            <ilgilenilenMahalleListesi/>
            <belediyeIletisimBilgisiniGuncelle>true</belediyeIletisimBilgisiniGuncelle>
            <secilenSMSBilgilendirmeKategoriListesi><kod>DUYURU</kod></secilenSMSBilgilendirmeKategoriListesi>
            <secilenEpostaBilgilendirmeKategoriListesi><kod>MECLIS</kod></secilenEpostaBilgilendirmeKategoriListesi>
            """));
        Assert.Contains("<bilgilendirmeIstegiYapC", yap);
        Assert.Contains("<sonucKodu>0000</sonucKodu>", yap);

        var sorgu = await PostAsync(operations, Envelope("bilgilendirmeIstegiSorgulaG", $"<tcKimlikNo>{Tc}</tcKimlikNo>"));
        Assert.Contains("<eposta>ayse@example.com</eposta>", sorgu);
        Assert.Contains("<telefonNo>5321234567</telefonNo>", sorgu);
        Assert.Contains("<bilgilendirmeTurKodu>MECLIS</bilgilendirmeTurKodu>", sorgu);
        Assert.DoesNotContain("nil=\"true\"", sorgu);

        var turler = await PostAsync(operations, Envelope("epostaBilgilendirmeTurleriSorgulaG", string.Empty));
        Assert.Contains("<epostaBilgilendirmeTurleriSorgulaC", turler);
        Assert.Contains("Meclis ve Encumen", turler);

        var smsTurler = await PostAsync(operations, Envelope("smsBilgilendirmeTurleriSorgulaG", string.Empty));
        Assert.Contains("<smsBilgilendirmeTurleriSorgulaC", smsTurler);

        var iptal = await PostAsync(operations, Envelope("bilgilendirmeIstegiIptalG", $"<tcKimlikNo>{Tc}</tcKimlikNo>"));
        Assert.Contains("<bilgilendirmeIstegiIptalC", iptal);
        Assert.Contains("<sonucKodu>0000</sonucKodu>", iptal);

        var tekrar = await PostAsync(operations, Envelope("bilgilendirmeIstegiIptalG", $"<tcKimlikNo>{Tc}</tcKimlikNo>"));
        Assert.Contains("<sonucKodu>0004</sonucKodu>", tekrar);
    }

    private static string Envelope(string root, string innerBody) => $$"""
        <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:v3="http://belediye.turkiye.gov.tr/v3">
          <soapenv:Body>
            <v3:{{root}}>
              <belediyeKodu>9999</belediyeKodu><kullaniciAdi>kullanici</kullaniciAdi><sifre>sifre</sifre><ipAdresi>1.2.3.4</ipAdresi>
              {{innerBody}}
            </v3:{{root}}>
          </soapenv:Body>
        </soapenv:Envelope>
        """;

    private static async Task<string> PostAsync(IBelediyeSoapOperations operations, string soap)
    {
        var context = new DefaultHttpContext();
        context.Request.Method = HttpMethods.Post;
        context.Request.Path = "/service";
        context.Request.Body = new MemoryStream(Encoding.UTF8.GetBytes(soap));
        context.Response.Body = new MemoryStream();

        await new BelediyeSoapMiddleware(_ => Task.CompletedTask).InvokeAsync(context, operations);

        context.Response.Body.Position = 0;
        return await new StreamReader(context.Response.Body, Encoding.UTF8).ReadToEndAsync();
    }

    private static BelediyeSoapBilgilendirmeIstegiYapRequest NewRequest(
        string adi = "Ayse",
        string eposta = "ayse@example.com",
        string telefon = "532 123 45 67",
        IReadOnlyList<string>? mahalleKodlari = null,
        IReadOnlyList<string>? smsKodlari = null,
        IReadOnlyList<string>? epostaKodlari = null)
        => new(
            adi, "Yilmaz", eposta, "+90", telefon,
            mahalleKodlari ?? [],
            BelediyeIletisimBilgisiniGuncelle: false,
            smsKodlari ?? ["DUYURU"],
            epostaKodlari ?? ["DUYURU", "meclis"]);

    private static async Task<(BelediyeSoapOperations Operations, CityCommunicationCenterDbContext Db)> CreateAsync(string? bilgilendirmeTurleri = null)
    {
        var db = new CityCommunicationCenterDbContext(
            new DbContextOptionsBuilder<CityCommunicationCenterDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options);
        db.TenantSettings.Add(new TenantSetting
        {
            TenantSettingId = Guid.NewGuid(),
            TenantId = TenantId,
            DisplayName = "Test Belediyesi",
            BelediyeKodu = "9999",
        });
        await db.SaveChangesAsync();

        return (new BelediyeSoapOperations(db, new FakeSettingsProvider(bilgilendirmeTurleri), new FakeHostEnvironment()), db);
    }

    private sealed class FakeSettingsProvider(string? bilgilendirmeTurleri) : ISocialMediaSettingsProvider
    {
        public SocialMediaSettings? GetSettings(Guid tenantId) => new()
        {
            EDevlet = new EDevletSettings
            {
                BelediyeKodu = "9999",
                SoapKullaniciAdi = "kullanici",
                SoapSifre = "sifre",
                IlceAdi = "Merkez",
                BilgilendirmeTurleri = bilgilendirmeTurleri,
            },
        };

        public Task SaveSettingsAsync(Guid tenantId, SocialMediaSettings settings, CancellationToken ct = default) => Task.CompletedTask;
    }

    private sealed class FakeHostEnvironment : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = "Test";

        public string ApplicationName { get; set; } = "Test";

        public string ContentRootPath { get; set; } = Path.GetTempPath();

        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}

using System.Text;
using System.Xml.Linq;
using System.Xml.Schema;
using CityCommunicationCenter.Api.BelediyeSoap;
using CityCommunicationCenter.Application.Abstractions.SocialMedia;
using CityCommunicationCenter.Domain.Entities;
using CityCommunicationCenter.Infrastructure.BelediyeSoap;
using CityCommunicationCenter.Infrastructure.Persistence;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;

namespace CityCommunicationCenter.Application.Tests.BelediyeSoap;

// Exercise the real middleware + operations + persistence, then validate the actual response
// against the supplied, unchanged V3 WSDL (the same check performed by SoapUI Validate).
public sealed class BelediyeSoapContractTests : IDisposable
{
    private const string Tc = "10000000146";
    private static readonly Guid TenantId = Guid.NewGuid();
    private static readonly XNamespace V3 = "http://belediye.turkiye.gov.tr/v3";
    private static readonly XNamespace Soap = "http://schemas.xmlsoap.org/soap/envelope/";
    private static readonly XmlSchemaSet Schemas = LoadSchemas();
    private readonly CityCommunicationCenterDbContext _db;
    private readonly BelediyeSoapOperations _operations;
    private readonly string _contentRoot = Path.Combine(Path.GetTempPath(), "ccc-soap-contract", Guid.NewGuid().ToString("N"));

    public BelediyeSoapContractTests()
    {
        _db = new CityCommunicationCenterDbContext(new DbContextOptionsBuilder<CityCommunicationCenterDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        _db.TenantSettings.Add(new TenantSetting
        {
            TenantSettingId = Guid.NewGuid(), TenantId = TenantId,
            DisplayName = "Test Belediyesi", BelediyeKodu = "9999",
        });
        _db.SaveChanges();
        _operations = new BelediyeSoapOperations(_db, new SettingsProvider(), new TestEnvironment { ContentRootPath = _contentRoot });
    }

    [Theory]
    [InlineData("echoG")]
    [InlineData("basvuruTipiBilgisiSorgulamaG")]
    [InlineData("basvuruDurumSorgulamaG")]
    [InlineData("smsBilgilendirmeTurleriSorgulaG")]
    [InlineData("epostaBilgilendirmeTurleriSorgulaG")]
    [InlineData("bilgilendirmeIstegiSorgulaG")]
    [InlineData("ayarOkuG")]
    [InlineData("ayarOkuListeG")]
    [InlineData("ilceSorgulamaG")]
    [InlineData("mahalleSorgulaG")]
    [InlineData("sokakCaddeSorgulamaG")]
    public async Task SuccessResponses_ValidateAgainstWsdl(string root)
    {
        var response = await PostAsync(root, new XElement("tcKimlikNo", Tc),
            new XElement("ayar", TalepOneriOptions.AyarAdi));
        Assert.Equal("0000", response.Element("sonucKodu")?.Value);
        Validate(response);
    }

    [Theory]
    [InlineData("basvuruTipiBilgisiSorgulamaG")]
    [InlineData("basvuruYapG")]
    [InlineData("basvuruDurumSorgulamaG")]
    [InlineData("basvuruDetaySorgulamaG")]
    [InlineData("basvuruNotEkleG")]
    [InlineData("basvuruyuTekrarAcG")]
    [InlineData("bilgilendirmeIstegiYapG")]
    [InlineData("bilgilendirmeIstegiSorgulaG")]
    [InlineData("bilgilendirmeIstegiIptalG")]
    [InlineData("smsBilgilendirmeTurleriSorgulaG")]
    [InlineData("epostaBilgilendirmeTurleriSorgulaG")]
    [InlineData("ayarOkuG")]
    [InlineData("ayarOkuListeG")]
    [InlineData("ilceSorgulamaG")]
    [InlineData("mahalleSorgulaG")]
    [InlineData("sokakCaddeSorgulamaG")]
    public async Task AuthFailureResponses_ValidateAgainstWsdl(string root)
    {
        var response = await SendAsync(root, [], password: "incorrect");
        Assert.Equal("0001", response.Element("sonucKodu")?.Value);
        Validate(response);
    }

    [Fact]
    public async Task BasvuruLifecycle_PreservesStandardPhoneAndValidatesResponses()
    {
        var created = await PostAsync("basvuruYapG", new XElement("tcKimlikNo", Tc), BasvuruBilgileri());
        Assert.Equal("0000", created.Element("sonucKodu")?.Value);
        Validate(created);
        var no = created.Element("basvuruTakipNo")!.Value;

        var initial = await PostAsync("basvuruDetaySorgulamaG", new XElement("tcKimlikNo", Tc), new XElement("basvuruNumarasi", no));
        Validate(initial);
        Assert.Equal("5321234567", initial.Element("telefonListesi")?.Element("telefonBilgisiType")?.Element("telefonNo")?.Value);
        Assert.Empty(_db.EDevletBasvurular.Single().GetCitizenNotes());

        var note = await PostAsync("basvuruNotEkleG", new XElement("tcKimlikNo", Tc), new XElement("basvuruNo", no), new XElement("eklenecekNot", "Ek bilgi"));
        Validate(note);
        Assert.Equal("0000", note.Element("sonucKodu")?.Value);

        var detail = await PostAsync("basvuruDetaySorgulamaG", new XElement("tcKimlikNo", Tc), new XElement("basvuruNumarasi", no));
        Validate(detail);
        Assert.Contains(detail.Descendants("notMetin"), item => item.Value == "Ek bilgi");

        var status = await PostAsync("basvuruDurumSorgulamaG", new XElement("tcKimlikNo", Tc));
        Validate(status);
        Assert.Single(status.Element("basvuruDurumListesi")!.Elements());

        var entity = _db.EDevletBasvurular.Single();
        entity.Status = CityCommunicationCenter.Domain.Enums.EDevletBasvuruStatus.Rejected;
        await _db.SaveChangesAsync();
        var reopened = await PostAsync("basvuruyuTekrarAcG", new XElement("tcKimlikNo", Tc), new XElement("basvuruNo", no), new XElement("acilmaNedeni", "Yeniden incelensin"));
        Validate(reopened);
        Assert.Equal("0000", reopened.Element("sonucKodu")?.Value);
    }

    [Fact]
    public async Task BilgilendirmeLifecycle_ValidatesCreateUpdateCancelAndQueries()
    {
        foreach (var email in new[] { "test@example.com", "updated@example.com" })
        {
            var created = await PostAsync("bilgilendirmeIstegiYapG", new XElement("tcKimlikNo", Tc),
                new XElement("adi", "Test"), new XElement("soyadi", "Kullanici"), new XElement("eposta", email),
                new XElement("cepTelefonu", new XElement("telefonTuru", "CEP"), new XElement("ulkeKodu", "90"), new XElement("telefonNo", "5321234567")),
                new XElement("ilgilenilenMahalleListesi"), new XElement("belediyeIletisimBilgisiniGuncelle", false),
                new XElement("secilenSMSBilgilendirmeKategoriListesi", new XElement("kod", "DUYURU")),
                new XElement("secilenEpostaBilgilendirmeKategoriListesi"));
            Validate(created);
            Assert.Equal("0000", created.Element("sonucKodu")?.Value);
            var query = await PostAsync("bilgilendirmeIstegiSorgulaG", new XElement("tcKimlikNo", Tc));
            Validate(query);
            Assert.Equal(email, query.Element("kayitliBilgilendirmeIstegi")?.Element("eposta")?.Value);
        }
        Assert.Single(_db.BilgilendirmeIstekleri);
        var cancelled = await PostAsync("bilgilendirmeIstegiIptalG", new XElement("tcKimlikNo", Tc));
        Validate(cancelled);
        Assert.Equal("0000", cancelled.Element("sonucKodu")?.Value);
        var absent = await PostAsync("bilgilendirmeIstegiSorgulaG", new XElement("tcKimlikNo", Tc));
        Validate(absent);
        Assert.Equal("true", absent.Element("kayitliBilgilendirmeIstegi")?.Attribute(XName.Get("nil", "http://www.w3.org/2001/XMLSchema-instance"))?.Value);
    }

    [Theory]
    [InlineData("")]
    [InlineData("not-base64!")]
    public async Task Basvuru_InvalidAttachment_IsRejectedWithoutSaving(string data)
    {
        var fields = BasvuruBilgileri();
        fields.Element("dosyaListesi")!.Add(new XElement("dosyaBilgisi", new XElement("dosyaCesidi", "Ek"),
            new XElement("dosyauzanti", "PDF"), new XElement("belgeTarihi", ""), new XElement("belgeSayisi", "1"), new XElement("dosya", data)));
        var response = await PostAsync("basvuruYapG", new XElement("tcKimlikNo", Tc), fields);
        Assert.Equal("0002", response.Element("sonucKodu")?.Value);
        Validate(response);
        Assert.Empty(_db.EDevletBasvurular);
    }

    [Fact]
    public async Task Basvuru_ValidAttachment_IsSavedWithItsContent()
    {
        var fields = BasvuruBilgileri();
        fields.Element("dosyaListesi")!.Add(new XElement("dosyaBilgisi", new XElement("dosyaCesidi", "Ek"),
            new XElement("dosyauzanti", "PDF"), new XElement("belgeTarihi", ""), new XElement("belgeSayisi", "1"),
            new XElement("dosya", Convert.ToBase64String([1, 2, 3]))));
        var response = await PostAsync("basvuruYapG", new XElement("tcKimlikNo", Tc), fields);
        Validate(response);
        Assert.Equal("0000", response.Element("sonucKodu")?.Value);
        var saved = Assert.Single(Directory.GetFiles(_contentRoot, "*", SearchOption.AllDirectories));
        Assert.Equal(new byte[] { 1, 2, 3 }, await File.ReadAllBytesAsync(saved));
    }

    [Fact]
    public async Task Basvuru_OtherCitizen_CannotReadOrModifyApplication()
    {
        var created = await PostAsync("basvuruYapG", new XElement("tcKimlikNo", Tc), BasvuruBilgileri());
        var no = created.Element("basvuruTakipNo")!.Value;
        var detail = await PostAsync("basvuruDetaySorgulamaG", new XElement("tcKimlikNo", "10000000147"), new XElement("basvuruNumarasi", no));
        Validate(detail);
        Assert.Equal("0003", detail.Element("sonucKodu")?.Value);
        Assert.DoesNotContain("Test talebi", detail.ToString());
        var note = await PostAsync("basvuruNotEkleG", new XElement("tcKimlikNo", "10000000147"), new XElement("basvuruNo", no), new XElement("eklenecekNot", "Unauthorized"));
        Validate(note);
        Assert.Equal("0003", note.Element("sonucKodu")?.Value);
        Assert.Empty(_db.EDevletBasvurular.Single().GetCitizenNotes());
    }

    [Fact]
    public async Task Basvuru_BusinessRuleFailure_ValidatesAndDoesNotSave()
    {
        var fields = BasvuruBilgileri();
        fields.Element("cevapSekli")!.Value = "INVALID";
        var response = await PostAsync("basvuruYapG", new XElement("tcKimlikNo", Tc), fields);
        Validate(response);
        Assert.Equal("0006", response.Element("sonucKodu")?.Value);
        Assert.Empty(_db.EDevletBasvurular);
    }

    private static XElement BasvuruBilgileri() => new("basvuruBilgileri",
        new XElement("adi", "Test"), new XElement("soyadi", "Kullanici"), new XElement("aboneNo", ""),
        new XElement("ilceKodu", "1"), new XElement("mahalleKodu", ""), new XElement("sokakCaddeKodu", ""),
        new XElement("disKapiNo", ""), new XElement("icKapiNo", ""), new XElement("basvuranAcikAdres", ""),
        new XElement("basvuranNVIAdresNo", ""), new XElement("basvuruTipi", "TALEP"), new XElement("eposta", "test@example.com"),
        new XElement("telefonListesi", new XElement("telefonBilgisiType", new XElement("telefonTuru", "CEP"), new XElement("ulkeKodu", "90"), new XElement("telefonNo", "5321234567"))),
        new XElement("basvuruDetay", "Test talebi"), new XElement("koordinat", new XElement("enlem", ""), new XElement("boylam", "")),
        new XElement("dosyaListesi"), new XElement("cevapSekli", "EPOSTA"), new XElement("detayListesi"));

    private Task<XElement> PostAsync(string root, params XElement[] fields) => SendAsync(root, fields);

    private async Task<XElement> SendAsync(string root, XElement[] fields, string password = "sifre")
    {
        var payload = new XElement(V3 + root, new XAttribute(XNamespace.Xmlns + "v3", V3),
            new XElement("belediyeKodu", "9999"), new XElement("kullaniciAdi", "kullanici"), new XElement("sifre", password), new XElement("ipAdresi", "203.0.113.7"), fields);
        var context = new DefaultHttpContext();
        context.Request.Method = "POST";
        context.Request.Path = "/service";
        context.Request.Body = new MemoryStream(Encoding.UTF8.GetBytes(new XElement(Soap + "Envelope", new XElement(Soap + "Body", payload)).ToString()));
        context.Response.Body = new MemoryStream();
        await new BelediyeSoapMiddleware(_ => Task.CompletedTask).InvokeAsync(context, _operations);
        context.Response.Body.Position = 0;
        var response = XDocument.Load(context.Response.Body).Root!.Element(Soap + "Body")!.Elements().Single();
        return response;
    }

    private static void Validate(XElement response)
    {
        var errors = new List<string>();
        new XDocument(new XElement(response)).Validate(Schemas, (_, args) => errors.Add(args.Message));
        Assert.True(errors.Count == 0, string.Join(Environment.NewLine, errors) + Environment.NewLine + response);
    }

    private static XmlSchemaSet LoadSchemas()
    {
        var wsdl = XDocument.Load(Path.Combine(AppContext.BaseDirectory, "BelediyeSoap", "BelediyeStandartV3.wsdl"));
        XNamespace xsd = "http://www.w3.org/2001/XMLSchema";
        var schema = new XElement(wsdl.Descendants(xsd + "schema").Single());
        schema.SetAttributeValue(XNamespace.Xmlns + "xsd", xsd);
        var schemas = new XmlSchemaSet { XmlResolver = null };
        using var reader = schema.CreateReader();
        schemas.Add(XmlSchema.Read(reader, null)!);
        schemas.Compile();
        return schemas;
    }

    public void Dispose()
    {
        _db.Dispose();
        if (Directory.Exists(_contentRoot))
        {
            Directory.Delete(_contentRoot, recursive: true);
        }
    }

    private sealed class SettingsProvider : ISocialMediaSettingsProvider
    {
        public SocialMediaSettings? GetSettings(Guid tenantId) => new()
        {
            EDevlet = new EDevletSettings
            {
                BelediyeKodu = "9999", SoapKullaniciAdi = "kullanici", SoapSifre = "sifre", IlceAdi = "Merkez",
                TalepOneriAyarlari = """{"notEklenebilirmi":1,"basvuruTekrarAcilabilirmi":1,"basvuruDosyaSayisi":1}""",
            },
        };
        public Task SaveSettingsAsync(Guid tenantId, SocialMediaSettings settings, CancellationToken ct = default) => Task.CompletedTask;
    }

    private sealed class TestEnvironment : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = "Test";
        public string ApplicationName { get; set; } = "Test";
        public string ContentRootPath { get; set; } = Path.GetTempPath();
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}

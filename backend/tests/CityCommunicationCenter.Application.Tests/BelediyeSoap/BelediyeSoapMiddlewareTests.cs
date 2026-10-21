using System.Text;
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

public sealed class BelediyeSoapMiddlewareTests
{
    private static readonly Guid TenantId = Guid.Parse("b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e");

    // WSDL elementFormDefault="unqualified": kok eleman v3 namespace'inde, alt elemanlar namespace'siz.
    private const string UnqualifiedRequest = """
        <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:v3="http://belediye.turkiye.gov.tr/v3">
          <soapenv:Body>
            <v3:basvuruTipiBilgisiSorgulamaG>
              <belediyeKodu>9999</belediyeKodu>
              <kullaniciAdi>kullanici</kullaniciAdi>
              <sifre>sifre</sifre>
              <ipAdresi>1.2.3.4</ipAdresi>
            </v3:basvuruTipiBilgisiSorgulamaG>
          </soapenv:Body>
        </soapenv:Envelope>
        """;

    // Eski (qualified) servislerin kullandigi bicim: alt elemanlar da v3 namespace'inde.
    private const string QualifiedRequest = """
        <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:v3="http://belediye.turkiye.gov.tr/v3">
          <soapenv:Body>
            <v3:basvuruTipiBilgisiSorgulamaG>
              <v3:belediyeKodu>9999</v3:belediyeKodu>
              <v3:kullaniciAdi>kullanici</v3:kullaniciAdi>
              <v3:sifre>sifre</v3:sifre>
              <v3:ipAdresi>1.2.3.4</v3:ipAdresi>
            </v3:basvuruTipiBilgisiSorgulamaG>
          </soapenv:Body>
        </soapenv:Envelope>
        """;

    [Theory]
    [InlineData(UnqualifiedRequest)]
    [InlineData(QualifiedRequest)]
    public async Task Invoke_AuthenticatesWithQualifiedAndUnqualifiedChildElements(string request)
    {
        var body = await PostAsync(request);

        Assert.Contains("<sonucKodu>0000</sonucKodu>", body);
        Assert.Contains("Talep", body);
    }

    [Fact]
    public async Task Invoke_WrongPassword_IsRejectedWithAuthFailure()
    {
        var body = await PostAsync(UnqualifiedRequest.Replace("<sifre>sifre</sifre>", "<sifre>yanlis</sifre>"));

        Assert.Contains("<sonucKodu>0001</sonucKodu>", body);
    }

    private static async Task<string> PostAsync(string soap)
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

        var operations = new BelediyeSoapOperations(
            db,
            new FakeSettingsProvider(),
            new FakeHostEnvironment());

        var context = new DefaultHttpContext();
        context.Request.Method = HttpMethods.Post;
        context.Request.Path = "/service";
        context.Request.Body = new MemoryStream(Encoding.UTF8.GetBytes(soap));
        context.Response.Body = new MemoryStream();

        await new BelediyeSoapMiddleware(_ => Task.CompletedTask).InvokeAsync(context, operations);

        context.Response.Body.Position = 0;
        return await new StreamReader(context.Response.Body, Encoding.UTF8).ReadToEndAsync();
    }

    private sealed class FakeSettingsProvider : ISocialMediaSettingsProvider
    {
        public SocialMediaSettings? GetSettings(Guid tenantId) => new()
        {
            EDevlet = new EDevletSettings
            {
                BelediyeKodu = "9999",
                SoapKullaniciAdi = "kullanici",
                SoapSifre = "sifre",
                IlceAdi = "Merkez",
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

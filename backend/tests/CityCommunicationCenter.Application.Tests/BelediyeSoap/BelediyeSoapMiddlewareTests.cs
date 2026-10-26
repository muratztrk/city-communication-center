using System.Text;
using System.Xml.Linq;
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
    public async Task Invoke_ResponseFollowsUnqualifiedWsdl_OnlyRootIsInV3Namespace()
    {
        var body = await PostAsync(UnqualifiedRequest);

        XNamespace v3 = "http://belediye.turkiye.gov.tr/v3";
        var root = XDocument.Parse(body).Descendants().Single(element => element.Name.Namespace == v3);
        Assert.Equal("basvuruTipiBilgisiSorgulamaC", root.Name.LocalName);
        Assert.NotEmpty(root.Descendants());
        Assert.All(root.Descendants(), element => Assert.Equal(XNamespace.None, element.Name.Namespace));
        Assert.Equal("0000", root.Element("sonucKodu")?.Value);
        Assert.DoesNotContain("xmlns=\"", body);
    }

    [Fact]
    public async Task Invoke_UnknownBelediyeKodu_IsInvalidParameter()
    {
        var body = await PostAsync(UnqualifiedRequest.Replace("<belediyeKodu>9999</belediyeKodu>", "<belediyeKodu>1111</belediyeKodu>"));

        Assert.Contains("<sonucKodu>0002</sonucKodu>", body);
    }

    [Fact]
    public async Task Invoke_WrongPassword_IsRejectedWithAuthFailure()
    {
        var body = await PostAsync(UnqualifiedRequest.Replace("<sifre>sifre</sifre>", "<sifre>yanlis</sifre>"));

        Assert.Contains("<sonucKodu>0001</sonucKodu>", body);
    }

    [Fact]
    public async Task Invoke_LocksOutClientAfterRepeatedAuthFailures_EvenWithCorrectPassword()
    {
        var throttle = new BelediyeSoapAuthThrottle(new BelediyeSoapAuthThrottleOptions { MaxFailures = 2, WindowSeconds = 600 });
        var wrong = UnqualifiedRequest.Replace("<sifre>sifre</sifre>", "<sifre>yanlis</sifre>");

        Assert.Contains("<sonucKodu>0001</sonucKodu>", await PostAsync(wrong, throttle));
        Assert.Contains("<sonucKodu>0001</sonucKodu>", await PostAsync(wrong, throttle));

        var locked = await PostAsync(UnqualifiedRequest, throttle);
        Assert.Contains("<sonucKodu>0001</sonucKodu>", locked);
        Assert.Contains("COK FAZLA HATALI GIRIS DENEMESI", locked);

        // Kilit IP basinadir; baska istemci etkilenmez.
        Assert.Contains("<sonucKodu>0000</sonucKodu>", await PostAsync(UnqualifiedRequest, throttle, "10.0.0.9"));
    }

    [Fact]
    public async Task Invoke_SuccessfulAuth_ResetsFailureCount()
    {
        var throttle = new BelediyeSoapAuthThrottle(new BelediyeSoapAuthThrottleOptions { MaxFailures = 2, WindowSeconds = 600 });
        var wrong = UnqualifiedRequest.Replace("<sifre>sifre</sifre>", "<sifre>yanlis</sifre>");

        await PostAsync(wrong, throttle);
        Assert.Contains("<sonucKodu>0000</sonucKodu>", await PostAsync(UnqualifiedRequest, throttle));
        await PostAsync(wrong, throttle);

        Assert.Contains("<sonucKodu>0000</sonucKodu>", await PostAsync(UnqualifiedRequest, throttle));
    }

    [Fact]
    public async Task Invoke_UnknownBelediyeKodu_DoesNotCountTowardLockout()
    {
        var throttle = new BelediyeSoapAuthThrottle(new BelediyeSoapAuthThrottleOptions { MaxFailures = 2, WindowSeconds = 600 });
        // Kilide sayilsaydi ucuncu istekten itibaren kilit mesaji (0001) donerdi.
        for (var i = 0; i < 5; i++)
        {
            Assert.Contains("<sonucKodu>0002</sonucKodu>", await PostAsync(UnqualifiedRequest.Replace("9999", "1111"), throttle));
        }

        Assert.Contains("<sonucKodu>0000</sonucKodu>", await PostAsync(UnqualifiedRequest, throttle));
    }

    [Fact]
    public async Task Invoke_UnexpectedError_ReturnsSoapSystemErrorInsteadOfException()
    {
        var body = await PostAsync(UnqualifiedRequest, disposeDb: true);

        Assert.Contains("<soapenv:Envelope", body);
        Assert.Contains("<sonucKodu>0004</sonucKodu>", body);
    }

    [Fact]
    public void Throttle_ParallelAttempts_CannotExceedLimit()
    {
        var throttle = new BelediyeSoapAuthThrottle(new BelediyeSoapAuthThrottleOptions { MaxFailures = 10, WindowSeconds = 600 });
        var key = BelediyeSoapAuthThrottle.ClientKey(System.Net.IPAddress.Parse("203.0.113.7"), "9999");

        var acquired = 0;
        Parallel.For(0, 500, _ =>
        {
            if (throttle.TryBeginAttempt(key))
            {
                Interlocked.Increment(ref acquired);
            }
        });

        Assert.Equal(10, acquired);
    }

    [Fact]
    public void Throttle_ReleasedAndSucceededAttempts_FreeTheSlot()
    {
        var throttle = new BelediyeSoapAuthThrottle(new BelediyeSoapAuthThrottleOptions { MaxFailures = 1, WindowSeconds = 600 });
        var key = BelediyeSoapAuthThrottle.ClientKey(System.Net.IPAddress.Parse("203.0.113.7"), "9999");

        Assert.True(throttle.TryBeginAttempt(key));
        throttle.ReleaseAttempt(key);
        Assert.True(throttle.TryBeginAttempt(key));
        throttle.Succeeded(key);
        Assert.True(throttle.TryBeginAttempt(key));
        Assert.False(throttle.TryBeginAttempt(key));
    }

    [Fact]
    public void Throttle_KeyIsPerBelediyeAndGroupsIpv6By64()
    {
        var ip = System.Net.IPAddress.Parse("203.0.113.7");
        Assert.NotEqual(BelediyeSoapAuthThrottle.ClientKey(ip, "9999"), BelediyeSoapAuthThrottle.ClientKey(ip, "1111"));
        Assert.Equal(BelediyeSoapAuthThrottle.ClientKey(ip, "9999"), BelediyeSoapAuthThrottle.ClientKey(ip.MapToIPv6(), " 9999 "));
        Assert.Equal(
            BelediyeSoapAuthThrottle.ClientKey(System.Net.IPAddress.Parse("2001:db8:1:2::1"), "9999"),
            BelediyeSoapAuthThrottle.ClientKey(System.Net.IPAddress.Parse("2001:db8:1:2:ffff::9"), "9999"));
        Assert.NotEqual(
            BelediyeSoapAuthThrottle.ClientKey(System.Net.IPAddress.Parse("2001:db8:1:2::1"), "9999"),
            BelediyeSoapAuthThrottle.ClientKey(System.Net.IPAddress.Parse("2001:db8:1:3::1"), "9999"));
    }

    private static async Task<string> PostAsync(
        string soap,
        BelediyeSoapAuthThrottle? throttle = null,
        string clientIp = "203.0.113.7",
        bool disposeDb = false)
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
        if (disposeDb)
        {
            await db.DisposeAsync();
        }

        context.Request.Path = "/service";
        context.Connection.RemoteIpAddress = System.Net.IPAddress.Parse(clientIp);
        context.Request.Body = new MemoryStream(Encoding.UTF8.GetBytes(soap));
        context.Response.Body = new MemoryStream();

        await new BelediyeSoapMiddleware(_ => Task.CompletedTask, throttle).InvokeAsync(context, operations);

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

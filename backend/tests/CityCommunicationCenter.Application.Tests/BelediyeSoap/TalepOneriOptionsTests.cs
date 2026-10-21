using CityCommunicationCenter.Infrastructure.BelediyeSoap;

namespace CityCommunicationCenter.Application.Tests.BelediyeSoap;

public sealed class TalepOneriOptionsTests
{
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("{bozuk json")]
    [InlineData("[1,2]")]
    public void Parse_EmptyOrInvalid_ReturnsDefaults(string? json)
    {
        var options = TalepOneriOptions.Parse(json);

        Assert.Equal(TalepOneriOptions.Default, options);
        Assert.Equal(0, options.BasvuruDosyaSayisi);
        Assert.False(options.BasvuruTekrarAcilabilir);
        Assert.False(options.NotEklenebilir);
    }

    [Fact]
    public void Parse_ClampsToSddLimits_AndAcceptsStringNumbers()
    {
        var options = TalepOneriOptions.Parse("""{"basvuruDosyaSayisi":"9","dosyaBoyut":4096,"basvuruTekrarAcilabilirmi":"1","notEklenebilirmi":1}""");

        Assert.Equal(5, options.BasvuruDosyaSayisi);
        Assert.Equal(1024, options.DosyaBoyutKb);
        Assert.True(options.BasvuruTekrarAcilabilir);
        Assert.True(options.NotEklenebilir);
    }

    [Fact]
    public void ToJson_UsesNumericValuesAsInSddSample_AndRoundTrips()
    {
        var json = TalepOneriOptions.Default.ToJson();

        Assert.Contains("\"basvuruDosyaSayisi\":0", json);
        Assert.Contains("\"dosyaBoyut\":512", json);
        Assert.Contains("\"basvuruTekrarAcilabilirmi\":0", json);
        Assert.Contains("\"cevapTuru\":\"EPOSTA,YAZILI,SMS,TELEFON,FAX\"", json);
        Assert.Equal(TalepOneriOptions.Default, TalepOneriOptions.Parse(json));
    }

    [Fact]
    public void Matching_IgnoresCaseTurkishCharactersAndSeparators()
    {
        var options = TalepOneriOptions.Default;

        Assert.True(options.IsExtensionAllowed(".pdf"));
        Assert.True(options.IsExtensionAllowed("Jpg"));
        Assert.False(options.IsExtensionAllowed("exe"));
        Assert.True(options.IsCevapTuruAllowed("eposta"));
        Assert.False(options.IsCevapTuruAllowed("E-POSTA-X"));
        Assert.True(options.IsClosedStatus("IPTAL EDİLDİ"));
        Assert.True(options.IsClosedStatus("TAMAMLANDI"));
        Assert.False(options.IsClosedStatus("ISLEMDE"));
    }
}

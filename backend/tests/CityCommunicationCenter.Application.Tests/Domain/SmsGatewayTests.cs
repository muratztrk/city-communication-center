using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Infrastructure.Sms;

namespace CityCommunicationCenter.Application.Tests.Domain;

public class SmsPhoneNumberTests
{
    [Theory]
    // Her iki sağlayıcı da 90XXXXXXXXXX (12 hane) bekliyor.
    [InlineData("0555 123 45 67", "905551234567")]
    [InlineData("05551234567", "905551234567")]
    [InlineData("5551234567", "905551234567")]
    [InlineData("905551234567", "905551234567")]
    [InlineData("+90 555 123 45 67", "905551234567")]
    [InlineData("0090 555 123 45 67", "905551234567")]
    [InlineData("(0555) 123-45-67", "905551234567")]
    // Sabit hat da destekleniyor ("Sabit veya GSM Numaraları").
    [InlineData("0232 425 95 55", "902324259555")]
    public void TryNormalize_returns_provider_format(string input, string expected)
    {
        Assert.Equal(expected, SmsPhoneNumber.TryNormalize(input));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("1234")]
    [InlineData("abc")]
    // 12 hane ama Türkiye ülke kodu değil.
    [InlineData("491701234567")]
    // 13 hane.
    [InlineData("9055512345678")]
    public void TryNormalize_rejects_unusable_input(string? input)
    {
        Assert.Null(SmsPhoneNumber.TryNormalize(input));
    }
}

public class SmsEndpointAllowListTests
{
    private const string JettDefault = "http://api.jettmesaj.com/";
    private const string AsistelDefault = "http://92.42.35.50:16899/smswebservice.asmx";

    [Fact]
    public void Resolve_uses_default_when_not_configured()
    {
        Assert.Equal(JettDefault, SmsEndpointAllowList.Resolve(SmsProvider.JettMesaj, null, JettDefault));
        Assert.Equal(JettDefault, SmsEndpointAllowList.Resolve(SmsProvider.JettMesaj, "   ", JettDefault));
    }

    [Fact]
    public void Resolve_keeps_configured_url_on_provider_host()
    {
        Assert.Equal(
            "https://api.jettmesaj.com/send",
            SmsEndpointAllowList.Resolve(SmsProvider.JettMesaj, "https://api.jettmesaj.com/send", JettDefault));

        Assert.Equal(
            "http://92.42.35.50:16899/smswebservice.asmx",
            SmsEndpointAllowList.Resolve(SmsProvider.Asistel, "http://92.42.35.50:16899/smswebservice.asmx", AsistelDefault));
    }

    [Theory]
    // Kayıtlı parolayı dışarı sızdırma girişimleri: hepsi varsayılana düşmeli.
    [InlineData("http://attacker.example.com/collect")]
    [InlineData("https://api.jettmesaj.com.attacker.example.com/")]
    [InlineData("file:///etc/passwd")]
    [InlineData("not-a-url")]
    [InlineData("//api.jettmesaj.com/")]
    public void Resolve_falls_back_for_foreign_hosts(string configured)
    {
        Assert.Equal(JettDefault, SmsEndpointAllowList.Resolve(SmsProvider.JettMesaj, configured, JettDefault));
        Assert.False(SmsEndpointAllowList.IsAllowed(SmsProvider.JettMesaj, configured));
    }

    [Fact]
    public void Resolve_does_not_leak_across_providers()
    {
        // Asistel host'u jeTTMesaj için geçerli değil (ve tersi).
        Assert.Equal(
            JettDefault,
            SmsEndpointAllowList.Resolve(SmsProvider.JettMesaj, "http://92.42.35.50:16899/x", JettDefault));
    }
}

public class SmsProviderErrorCodeTests
{
    [Theory]
    [InlineData("100")]
    [InlineData("OK")]
    [InlineData("ok")]
    public void Success_codes_are_recognized(string code)
    {
        Assert.True(SmsProviderErrorCodes.IsSuccess(code));
    }

    [Theory]
    [InlineData("104")]
    [InlineData("109")]
    [InlineData("121")]
    public void Documented_error_codes_are_recognized(string code)
    {
        Assert.False(SmsProviderErrorCodes.IsSuccess(code));
        Assert.True(SmsProviderErrorCodes.IsKnownErrorCode(code));
        Assert.NotEmpty(SmsProviderErrorCodes.Describe(code));
    }

    [Fact]
    public void Unknown_code_is_surfaced_not_swallowed()
    {
        Assert.Contains("999", SmsProviderErrorCodes.Describe("999"));
        Assert.False(SmsProviderErrorCodes.IsSuccess("999"));
    }
}

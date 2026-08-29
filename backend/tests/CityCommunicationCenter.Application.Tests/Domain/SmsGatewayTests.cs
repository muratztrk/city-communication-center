using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Application.Common;
using CityCommunicationCenter.Application.Features.Admin;
using CityCommunicationCenter.Infrastructure.Services;
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
    [InlineData("100:107066193")]
    [InlineData("100:107066171")]
    public void Success_codes_are_recognized(string code)
    {
        Assert.True(SmsProviderErrorCodes.IsSuccess(code));
    }

    [Fact]
    public void Success_with_transaction_id_describes_as_loaded()
    {
        Assert.Equal(
            "SMS başarıyla gönderildi.",
            SmsProviderErrorCodes.Describe("100:107066193"));
        Assert.False(SmsProviderErrorCodes.IsKnownErrorCode("100:107066193"));
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

public class AsistelSendAtFormatTests
{
    [Fact]
    public void FormatImmediateSend_is_ddMMyyyyHHmmss()
    {
        // 2026-08-02 08:30:45 UTC → TR (UTC+3) 11:30:45 → 02082026113045
        var utc = new DateTimeOffset(2026, 8, 2, 8, 30, 45, TimeSpan.Zero);
        var formatted = AsistelSmsSender.FormatImmediateSendAt(utc);
        Assert.Equal(14, formatted.Length);
        Assert.Equal("02082026113045", formatted);
        Assert.True(formatted.All(char.IsDigit));
    }
}

public class CitizenOutboundGreetingTests
{
    [Fact]
    public void Ensure_adds_greeting_and_blank_line()
    {
        Assert.Equal(
            "Değerli vatandaşımız,\n\nTalebiniz işleme alındı.",
            CitizenOutboundGreeting.Ensure("Talebiniz işleme alındı."));
    }

    [Fact]
    public void Ensure_does_not_double_prefix()
    {
        var already = "Değerli vatandaşımız,\n\nMetin";
        Assert.Equal(already, CitizenOutboundGreeting.Ensure(already));
    }

    [Fact]
    public void EnsureOptional_skips_blank()
    {
        Assert.Null(CitizenOutboundGreeting.EnsureOptional(null));
        Assert.Equal("   ", CitizenOutboundGreeting.EnsureOptional("   "));
    }

    [Fact]
    public void Ensure_uses_custom_greeting()
    {
        Assert.Equal(
            "Sayın hemşehrimiz,\n\nTalebiniz alındı.",
            CitizenOutboundGreeting.Ensure("Talebiniz alındı.", "Sayın hemşehrimiz,"));
    }
}

public class CitizenAutoReplyGreetingScopeTests
{
    private static CitizenAutoReplyTemplateModel Model(CitizenAutoReplyGreetings? greetings, string? greeting = "Genel hitap,") =>
        new("a", "b", "c", "d", greeting, null, greetings);

    [Fact]
    public void Each_status_uses_its_own_greeting()
    {
        var model = Model(new CitizenAutoReplyGreetings("İşleme,", "Yapılmakta,", "Tamamlandı,", "İptal,"));

        Assert.Equal("İşleme,", model.GreetingFor("İşleme Alındı"));
        Assert.Equal("Yapılmakta,", model.GreetingFor("Yapılmakta"));
        Assert.Equal("Tamamlandı,", model.GreetingFor("Tamamlanmış"));
        Assert.Equal("İptal,", model.GreetingFor("İptal"));
    }

    [Fact]
    public void Blank_status_greeting_falls_back_to_general()
    {
        var model = Model(new CitizenAutoReplyGreetings(ProcessingReceived: "  ", InProgress: "Yapılmakta,"));

        Assert.Equal("Genel hitap,", model.GreetingFor("İşleme Alındı"));
        Assert.Equal("Yapılmakta,", model.GreetingFor("Yapılmakta"));
    }

    [Fact]
    public void Legacy_record_without_status_greetings_uses_general()
    {
        var model = Model(null);

        Assert.Equal("Genel hitap,", model.GreetingFor("İşleme Alındı"));
        Assert.Equal("Genel hitap,", model.GreetingFor("Tamamlandı"));
    }

    [Fact]
    public void Status_greetings_survive_json_round_trip()
    {
        var json = CitizenAutoReplyTemplateJson.Serialize(
            Model(new CitizenAutoReplyGreetings("İşleme,", "Yapılmakta,", "Tamamlandı,", "İptal,")));
        var parsed = CitizenAutoReplyTemplateJson.ParseOrDefault(json);

        Assert.Equal("İşleme,", parsed.GreetingFor("İşleme Alındı"));
        Assert.Equal("İptal,", parsed.GreetingFor("İptal"));
    }
}

public class CitizenSmsTerminalNoteFormatTests
{
    [Fact]
    public void Blank_line_before_department_and_note_without_Not_label()
    {
        var withDept = CitizenJobStatusNotifier.EnsureBlankLineBeforeTargetDepartments(
            "VT-2026-1 no'lu Başlık talebinizin durumu \"Tamamlandı\". Fen İşleri Müdürlüğü",
            "Fen İşleri Müdürlüğü");
        Assert.Equal(
            "VT-2026-1 no'lu Başlık talebinizin durumu \"Tamamlandı\".\n\nFen İşleri Müdürlüğü",
            withDept);

        var withNote = CitizenJobStatusNotifier.AppendSmsTerminalNote(withDept, "sahada tamamlandı.");
        Assert.Equal(
            "VT-2026-1 no'lu Başlık talebinizin durumu \"Tamamlandı\".\n\nFen İşleri Müdürlüğü\n\nSahada tamamlandı.",
            withNote);
    }

    [Fact]
    public void Append_skips_empty_note()
    {
        Assert.Equal("metin", CitizenJobStatusNotifier.AppendSmsTerminalNote("metin", "  "));
    }
}

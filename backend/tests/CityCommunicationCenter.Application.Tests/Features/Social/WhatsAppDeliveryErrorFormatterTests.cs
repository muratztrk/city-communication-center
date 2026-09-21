using CityCommunicationCenter.Application.Features.Social;

namespace CityCommunicationCenter.Application.Tests.Features.Social;

public sealed class WhatsAppDeliveryErrorFormatterTests
{
    [Fact]
    public void StoreValue_formats_re_engagement_and_fits_column_limit()
    {
        var stored = WhatsAppDeliveryErrorFormatter.StoreValue(
            """{"error":{"message":"(#131047) Re-engagement message","type":"OAuthException"}}""");

        Assert.NotNull(stored);
        Assert.Contains("Meta onaylı şablon", stored, StringComparison.Ordinal);
        Assert.True(stored.Length <= WhatsAppDeliveryErrorFormatter.MaxStoredLength);
    }

    [Fact]
    public void StoreValue_formats_marketing_experiment_error()
    {
        var stored = WhatsAppDeliveryErrorFormatter.StoreValue(
            "User's number is part of an experiment");

        Assert.Equal(WhatsAppDeliveryErrorFormatter.MarketingExperimentWarning, stored);
    }

    [Fact]
    public void StoreValue_truncates_very_long_plain_text()
    {
        var stored = WhatsAppDeliveryErrorFormatter.StoreValue(new string('x', 900));

        Assert.NotNull(stored);
        Assert.Equal(WhatsAppDeliveryErrorFormatter.MaxStoredLength, stored.Length);
    }
}

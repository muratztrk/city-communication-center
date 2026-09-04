namespace CityCommunicationCenter.Infrastructure.Options;

public sealed class SmsOptions
{
    public const string SectionName = "Sms";

    /// <summary>
    /// Kapalıyken sağlayıcıya hiç çıkılmaz; deneme simülasyon olarak loglanır.
    /// Test ortamında (<c>CCC_SMS_LIVE_SEND_ENABLED=false</c>) gerçek SMS engellenir.
    /// </summary>
    public bool LiveSendEnabled { get; set; } = true;
}

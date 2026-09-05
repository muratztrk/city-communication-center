namespace CityCommunicationCenter.Infrastructure.Options;

public sealed class SmsOptions
{
    public const string SectionName = "Sms";

    /// <summary>
    /// Kapalıyken sağlayıcıya hiç çıkılmaz (SMS gateway + otomatik WhatsApp durum mesajları).
    /// Test ortamında <c>CCC_SMS_LIVE_SEND_ENABLED=false</c>.
    /// </summary>
    public bool LiveSendEnabled { get; set; } = true;
}

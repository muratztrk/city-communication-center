namespace CityCommunicationCenter.Application.Abstractions;

/// <summary>
/// Vatandaşa giden SMS'lerin tek çıkış kapısı. Tenant'ın SMS ayarlarını okur, numarayı
/// normalize eder ve sağlayıcıya gönderir.
/// </summary>
public interface ISmsGateway
{
    Task<SmsSendResult> SendAsync(
        Guid tenantId,
        string phoneNumber,
        string text,
        CancellationToken cancellationToken = default);

    /// <summary>Ayarlar ekranındaki "Test SMS Gönder" için: kayıtlı ayarlar + verilen numara.</summary>
    Task<SmsSendResult> SendTestAsync(
        Guid tenantId,
        string phoneNumber,
        string text,
        CancellationToken cancellationToken = default);
}

/// <param name="ProviderCode">Sağlayıcının döndürdüğü ham kod (Asistel "100", jeTTMesaj "OK" vb.).</param>
public sealed record SmsSendResult(bool Success, string? ProviderCode, string? Message)
{
    public static SmsSendResult Ok(string? providerCode, string? message = null) =>
        new(true, providerCode, message);

    public static SmsSendResult Fail(string message, string? providerCode = null) =>
        new(false, providerCode, message);
}

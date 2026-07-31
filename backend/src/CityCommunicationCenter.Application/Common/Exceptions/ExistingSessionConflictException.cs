namespace CityCommunicationCenter.Application.Common.Exceptions;

/// <summary>
/// Kullanıcının aktif oturumu varken yeni login onayı isteniyor (#6a6c805e).
/// </summary>
public sealed class ExistingSessionConflictException : Exception
{
    public ExistingSessionConflictException()
        : base("Bu hesap için açık bir oturum var. Devam ederseniz mevcut oturum sonlandırılacaktır.")
    {
    }
}

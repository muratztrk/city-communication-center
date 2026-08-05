namespace CityCommunicationCenter.Application.Abstractions;

/// <summary>Uygulamanın lisanslı modülleri. Bir tenant her ikisine de sahip olabilir.</summary>
public enum LicenseModule
{
    /// <summary>Vatandaş İş Takip Sistemi.</summary>
    Citizen,

    /// <summary>Kurum İçi İş Takip Sistemi.</summary>
    Internal,
}

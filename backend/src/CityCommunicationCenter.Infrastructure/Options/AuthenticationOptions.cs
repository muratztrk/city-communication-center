namespace CityCommunicationCenter.Infrastructure.Options;

public sealed class AuthenticationOptions
{
    public const string SectionName = "Authentication";

    public bool EnableLocalUsers { get; set; } = true;

    public string? InitialPassword { get; set; }

    public LdapAuthenticationOptions Ldap { get; set; } = new();
}

public sealed class LdapAuthenticationOptions
{
    public bool Enabled { get; set; }

    public string? Host { get; set; }

    public int Port { get; set; } = 389;

    public bool UseSsl { get; set; }

    public bool IgnoreCertificateErrors { get; set; }

    public string? Domain { get; set; }

    public string? SearchBase { get; set; }

    public string? BindDn { get; set; }

    public string? BindPassword { get; set; }

    public string UserAttribute { get; set; } = "mail";
}
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

    public int SearchResultLimit { get; set; } = 20;

    public int ImportPageSize { get; set; } = 500;

    public int ImportResultLimit { get; set; } = 5000;

    public string? Host { get; set; }

    public int Port { get; set; } = 389;

    public bool UseSsl { get; set; }

    public bool IgnoreCertificateErrors { get; set; }

    public string? Domain { get; set; }

    public string? SearchBase { get; set; }

    public string? BindDn { get; set; }

    public string? BindPassword { get; set; }

    public string UserAttribute { get; set; } = "mail";

    public List<LdapMockUserOptions> MockUsers { get; set; } = [];
}

public sealed class LdapMockUserOptions
{
    public string ExternalIdentityId { get; set; } = string.Empty;

    public string Username { get; set; } = string.Empty;

    public string DisplayName { get; set; } = string.Empty;

    public string? Email { get; set; }

    public string Password { get; set; } = string.Empty;
}
namespace CityCommunicationCenter.Api.Security;

public static class AuthorizationPolicies
{
    public const string SessionCookieScheme = "CityCommunicationCenter.Session";
    public const string TenantMember = "tenant-member";
    public const string PlatformAdmin = "platform-admin";
}

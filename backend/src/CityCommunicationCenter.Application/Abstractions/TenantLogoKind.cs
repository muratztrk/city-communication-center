namespace CityCommunicationCenter.Application.Abstractions;

public enum TenantLogoKind
{
    Institution = 0,
    Login = 1,
    Popup = 2,
}

public static class TenantLogoKindExtensions
{
    public static (string FileBaseName, string PreviousFileBaseName) GetFileBaseNames(this TenantLogoKind kind)
        => kind switch
        {
            TenantLogoKind.Login => ("login-logo", "login-logo-previous"),
            TenantLogoKind.Popup => ("popup-logo", "popup-logo-previous"),
            _ => ("logo", "logo-previous"),
        };
}

namespace CityCommunicationCenter.Infrastructure.SocialMedia;

/// <summary>
/// Configuration settings for social media integrations.
/// These are typically stored per-tenant in TenantSettings table.
/// </summary>
public class SocialMediaSettings
{
    public XSettings? X { get; set; }
    public FacebookSettings? Facebook { get; set; }
    public InstagramSettings? Instagram { get; set; }
    public WhatsAppSettings? WhatsApp { get; set; }
}

public class XSettings
{
    /// <summary>X API Key (Consumer Key)</summary>
    public string? ApiKey { get; set; }
    
    /// <summary>X API Secret (Consumer Secret)</summary>
    public string? ApiSecret { get; set; }
    
    /// <summary>Access Token for the municipality's X account</summary>
    public string? AccessToken { get; set; }
    
    /// <summary>Access Token Secret</summary>
    public string? AccessTokenSecret { get; set; }
    
    /// <summary>Bearer Token for API v2</summary>
    public string? BearerToken { get; set; }
}

public class FacebookSettings
{
    /// <summary>Facebook App ID</summary>
    public string? AppId { get; set; }
    
    /// <summary>Facebook App Secret</summary>
    public string? AppSecret { get; set; }
    
    /// <summary>Page Access Token (long-lived)</summary>
    public string? PageAccessToken { get; set; }
    
    /// <summary>Facebook Page ID</summary>
    public string? PageId { get; set; }
    
    /// <summary>Webhook Verify Token</summary>
    public string? WebhookVerifyToken { get; set; }
}

public class InstagramSettings
{
    /// <summary>Instagram Business Account ID</summary>
    public string? AccountId { get; set; }
    
    /// <summary>Access Token (via Facebook Graph API)</summary>
    public string? AccessToken { get; set; }
    
    /// <summary>Facebook Page ID linked to Instagram</summary>
    public string? LinkedPageId { get; set; }
}

public class WhatsAppSettings
{
    /// <summary>WhatsApp Business Account ID</summary>
    public string? BusinessAccountId { get; set; }
    
    /// <summary>Phone Number ID</summary>
    public string? PhoneNumberId { get; set; }
    
    /// <summary>Access Token</summary>
    public string? AccessToken { get; set; }
    
    /// <summary>Webhook Verify Token</summary>
    public string? WebhookVerifyToken { get; set; }
}

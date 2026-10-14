using CityCommunicationCenter.Domain.Entities;

namespace CityCommunicationCenter.Application.Features.Social;

/// <summary>
/// Telefon geldiyse telefon alanına yazılır. Telefon yoksa alan boş kalır;
/// profil adı, kullanıcı adı ve user_id kendi kolonlarına gider.
/// </summary>
public static class WhatsAppCitizenProfile
{
    public static string PhoneOrEmpty(string? phone)
        => string.IsNullOrWhiteSpace(phone) ? string.Empty : phone.Trim();

    public static void Apply(
        CitizenConversation conversation,
        string? phone,
        string? userId,
        string? username,
        string? profileName)
    {
        if (!string.IsNullOrWhiteSpace(phone))
        {
            conversation.CitizenPhone = phone.Trim();
        }

        var id = userId?.Trim();
        if (WhatsAppBusinessScopedUserId.IsValid(id))
        {
            conversation.WhatsAppUserId = id;
        }

        if (!string.IsNullOrWhiteSpace(username))
        {
            conversation.WhatsAppUsername = username.Trim();
        }

        if (!string.IsNullOrWhiteSpace(profileName))
        {
            // Profil adı Vatandaş Adı'na kopyalanmaz; kutu operatör yazana kadar boş kalır (#4209).
            conversation.WhatsAppProfileName = profileName.Trim();
        }
    }
}

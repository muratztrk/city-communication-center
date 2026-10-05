namespace CityCommunicationCenter.Application.Features.Social;

/// <summary>
/// WhatsApp gelen medya NAS/FTP klasörü: webhook anında <see cref="CitizenHandle"/> (çoğunlukla numara)
/// ile yazılmış, sonradan profil adına güncellenmiş kayıtlar için okuma sırasında numara yedeklenir.
/// </summary>
public static class ConversationMediaRemotePathHelper
{
    public static IReadOnlyList<string> BuildFolderCandidates(string? citizenHandle, string? citizenPhone)
    {
        var folders = new List<string>();
        if (!string.IsNullOrWhiteSpace(citizenHandle))
        {
            folders.Add(citizenHandle.Trim());
        }

        if (!string.IsNullOrWhiteSpace(citizenPhone))
        {
            var normalizedPhone = citizenPhone.Trim().TrimStart('+');
            if (!folders.Exists(candidate =>
                    string.Equals(candidate, citizenPhone, StringComparison.Ordinal) ||
                    string.Equals(candidate, normalizedPhone, StringComparison.Ordinal)))
            {
                folders.Add(normalizedPhone);
            }
        }

        return folders;
    }
}

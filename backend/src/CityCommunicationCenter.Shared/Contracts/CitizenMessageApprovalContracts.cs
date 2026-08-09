namespace CityCommunicationCenter.Shared.Contracts;

/// <summary>
/// Vatandaşa Gönderilecek Mesaj Onayı grid satırı — terminale ulaşmış (Tamamlanmış/İptal) WhatsApp/Çağrı
/// vatandaş taleplerinin otomatik durum mesajı Manager/CRM onayı bekliyor veya serbest bırakılmış (card #2039).
/// </summary>
public sealed record CitizenMessageApprovalResponse(
    Guid JobId,
    Guid SocialMessageId,
    string Channel,
    int? CitizenRequestNumber,
    int? CitizenRequestNumberYear,
    DateTimeOffset RequestDateUtc,
    string? CitizenName,
    string? CitizenPhone,
    string Title,
    DateTimeOffset? DueDateUtc,
    string Status,
    string? Note,
    Guid OwnerDepartmentId,
    string? OwnerDepartmentName,
    DateTimeOffset? ReleasedAtUtc,
    /// <summary>WA: Mesajı Onayla anı; SMS: operatör SMS gönderim onayı (RespondedAtUtc).</summary>
    DateTimeOffset? MessageApprovedAtUtc,
    /// <summary>Tamamlanmış taleplerde Durum alt satırı (#2067).</summary>
    DateTimeOffset? CompletedAtUtc,
    /// <summary>İptal taleplerde Durum alt satırı — Giden grid ile aynı (#2067).</summary>
    DateTimeOffset? UpdatedAtUtc);

public sealed record EditCitizenMessageApprovalNoteRequest(string Note);

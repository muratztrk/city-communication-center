namespace CityCommunicationCenter.Shared.Contracts;

public sealed record SlaWeekendSettingsResponse(bool ExcludeWeekends, IReadOnlyList<Guid> ExemptDepartmentIds);
public sealed record UpdateSlaWeekendSettingsRequest(bool ExcludeWeekends, IReadOnlyList<Guid> ExemptDepartmentIds);

/// <summary>Son Tarih seçici kısıtı — hafta sonu SLA durduruluyorsa Pazartesi mesai başlangıcı (#2706).</summary>
public sealed record DueDateConstraintsResponse(bool ExcludeWeekends, string? WeekendDueDateMinLocal);

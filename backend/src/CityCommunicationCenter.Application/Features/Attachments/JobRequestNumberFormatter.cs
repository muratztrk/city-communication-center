using CityCommunicationCenter.Domain.Enums;

namespace CityCommunicationCenter.Application.Features.Attachments;

public static class JobRequestNumberFormatter
{
    public static string Format(
        JobRequestType requestType,
        JobSourceType sourceType,
        int? jobNumber,
        int? jobNumberYear,
        int? citizenRequestNumber,
        int? citizenRequestNumberYear,
        DateTimeOffset? fallbackDate = null)
    {
        if (IsCitizenRequest(requestType, sourceType))
        {
            var year = citizenRequestNumberYear ?? jobNumberYear ?? fallbackDate?.Year ?? DateTimeOffset.UtcNow.Year;
            return citizenRequestNumber.HasValue
                ? $"VT-{year}-{citizenRequestNumber.Value}"
                : $"VT-{year}-Onay Bekleyen";
        }

        if (jobNumber.HasValue && jobNumberYear.HasValue)
        {
            return $"T-{jobNumberYear}-{jobNumber}";
        }

        var pendingYear = jobNumberYear ?? fallbackDate?.Year ?? DateTimeOffset.UtcNow.Year;
        return $"T-{pendingYear}-Onay Bekleyen";
    }

    public static bool IsCitizenRequest(JobRequestType requestType, JobSourceType sourceType) =>
        requestType == JobRequestType.Citizen
        || sourceType is JobSourceType.SocialMessage or JobSourceType.CitizenRequest or JobSourceType.EDevlet;
}

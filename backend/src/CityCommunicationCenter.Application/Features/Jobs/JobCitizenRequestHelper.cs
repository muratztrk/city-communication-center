namespace CityCommunicationCenter.Application.Features.Jobs;

internal static class JobCitizenRequestHelper
{
    internal static bool IsCitizenRequest(Job job) =>
        job.RequestType == JobRequestType.Citizen
        || job.SourceType is JobSourceType.SocialMessage or JobSourceType.CitizenRequest or JobSourceType.EDevlet;
}

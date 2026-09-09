namespace CityCommunicationCenter.Application.Features.Jobs;

public static class JobCitizenRequestHelper
{
    public static bool IsCitizenRequest(Job job) =>
        job.RequestType == JobRequestType.Citizen
        || job.SourceType is JobSourceType.SocialMessage or JobSourceType.CitizenRequest or JobSourceType.EDevlet;
}

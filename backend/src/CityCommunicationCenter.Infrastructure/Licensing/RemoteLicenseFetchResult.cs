namespace CityCommunicationCenter.Infrastructure.Licensing;

internal enum RemoteLicenseFetchOutcome
{
    Success,
    Denied,
    Unreachable,
}

internal sealed record RemoteLicenseFetchResult(RemoteLicenseFetchOutcome Outcome, string? Token);

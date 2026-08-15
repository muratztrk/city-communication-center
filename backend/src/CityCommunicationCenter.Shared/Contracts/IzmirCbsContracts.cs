namespace CityCommunicationCenter.Shared.Contracts;

public sealed record IzmirCbsOptionResponse(string Id, string Name);

public sealed record IzmirCbsPointResponse(double Latitude, double Longitude, bool Approximate);

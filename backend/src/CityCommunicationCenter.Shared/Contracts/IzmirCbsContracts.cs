namespace CityCommunicationCenter.Shared.Contracts;

public sealed record IzmirCbsOptionResponse(string Id, string Name);

public sealed record IzmirCbsPointResponse(double Latitude, double Longitude, bool Approximate);

public sealed record IzmirCbsNearestAddressResponse(string Neighborhood, string Street);

public sealed record IzmirCbsLandmarkResponse(
    string Name,
    string Category,
    double Latitude,
    double Longitude,
    string Kind);

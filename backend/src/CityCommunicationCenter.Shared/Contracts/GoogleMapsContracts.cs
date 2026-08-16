namespace CityCommunicationCenter.Shared.Contracts;

public sealed record GoogleMapsCoordinatesResponse(double Latitude, double Longitude);

public sealed record GoogleMapsAddressFromLinkResponse(
    double Latitude,
    double Longitude,
    string Neighborhood,
    string Street,
    string StreetNo);

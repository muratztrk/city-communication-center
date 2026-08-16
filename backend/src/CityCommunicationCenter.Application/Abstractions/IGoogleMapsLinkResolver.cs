namespace CityCommunicationCenter.Application.Abstractions;

public interface IGoogleMapsLinkResolver
{
    Task<(double Latitude, double Longitude)?> ResolveAsync(string input, CancellationToken cancellationToken);
}

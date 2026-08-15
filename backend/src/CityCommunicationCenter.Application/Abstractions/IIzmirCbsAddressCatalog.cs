namespace CityCommunicationCenter.Application.Abstractions;

public interface IIzmirCbsAddressCatalog
{
    Task<IReadOnlyList<IzmirCbsOptionResponse>> GetNeighborhoodsAsync(
        string districtId,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<IzmirCbsOptionResponse>> GetStreetsAsync(
        string neighborhoodId,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<IzmirCbsOptionResponse>> GetDoorNumbersAsync(
        string streetId,
        string neighborhoodId,
        CancellationToken cancellationToken);

    Task<IzmirCbsPointResponse?> LocateAsync(
        string districtId,
        string? neighborhood,
        string? street,
        string? streetNo,
        bool allowNeighborhoodFallback,
        CancellationToken cancellationToken);
}

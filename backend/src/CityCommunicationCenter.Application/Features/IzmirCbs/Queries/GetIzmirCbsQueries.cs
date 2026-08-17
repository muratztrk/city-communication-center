namespace CityCommunicationCenter.Application.Features.IzmirCbs;

public sealed record GetIzmirCbsNeighborhoodsQuery(string DistrictId)
    : IQuery<IReadOnlyList<IzmirCbsOptionResponse>>;

public sealed record GetIzmirCbsStreetsQuery(string NeighborhoodId)
    : IQuery<IReadOnlyList<IzmirCbsOptionResponse>>;

public sealed record GetIzmirCbsDoorNumbersQuery(string StreetId, string NeighborhoodId)
    : IQuery<IReadOnlyList<IzmirCbsOptionResponse>>;

public sealed record GetIzmirCbsPointQuery(
    string DistrictId,
    string? Neighborhood,
    string? Street,
    string? StreetNo,
    bool AllowNeighborhoodFallback) : IQuery<IzmirCbsPointResponse?>;

public sealed class GetIzmirCbsNeighborhoodsQueryValidator : AbstractValidator<GetIzmirCbsNeighborhoodsQuery>
{
    public GetIzmirCbsNeighborhoodsQueryValidator()
    {
        RuleFor(x => x.DistrictId)
            .NotEmpty()
            .WithMessage("İlçe seçiniz.");
    }
}

public sealed class GetIzmirCbsStreetsQueryValidator : AbstractValidator<GetIzmirCbsStreetsQuery>
{
    public GetIzmirCbsStreetsQueryValidator()
    {
        RuleFor(x => x.NeighborhoodId)
            .NotEmpty()
            .Matches(@"^-?\d+$")
            .WithMessage("Geçersiz mahalle değeri.");
    }
}

public sealed class GetIzmirCbsDoorNumbersQueryValidator : AbstractValidator<GetIzmirCbsDoorNumbersQuery>
{
    public GetIzmirCbsDoorNumbersQueryValidator()
    {
        RuleFor(x => x.StreetId)
            .NotEmpty()
            .Matches(@"^-?\d+$")
            .WithMessage("Geçersiz cadde/sokak değeri.");
        RuleFor(x => x.NeighborhoodId)
            .NotEmpty()
            .Matches(@"^-?\d+$")
            .WithMessage("Geçersiz mahalle değeri.");
    }
}

public sealed class GetIzmirCbsNeighborhoodsQueryHandler
    : IQueryHandler<GetIzmirCbsNeighborhoodsQuery, IReadOnlyList<IzmirCbsOptionResponse>>
{
    private readonly IIzmirCbsAddressCatalog _catalog;

    public GetIzmirCbsNeighborhoodsQueryHandler(IIzmirCbsAddressCatalog catalog)
    {
        _catalog = catalog;
    }

    public ValueTask<IReadOnlyList<IzmirCbsOptionResponse>> Handle(
        GetIzmirCbsNeighborhoodsQuery request,
        CancellationToken cancellationToken)
        => new(_catalog.GetNeighborhoodsAsync(request.DistrictId, cancellationToken));
}

public sealed class GetIzmirCbsStreetsQueryHandler
    : IQueryHandler<GetIzmirCbsStreetsQuery, IReadOnlyList<IzmirCbsOptionResponse>>
{
    private readonly IIzmirCbsAddressCatalog _catalog;

    public GetIzmirCbsStreetsQueryHandler(IIzmirCbsAddressCatalog catalog)
    {
        _catalog = catalog;
    }

    public ValueTask<IReadOnlyList<IzmirCbsOptionResponse>> Handle(
        GetIzmirCbsStreetsQuery request,
        CancellationToken cancellationToken)
        => new(_catalog.GetStreetsAsync(request.NeighborhoodId, cancellationToken));
}

public sealed class GetIzmirCbsDoorNumbersQueryHandler
    : IQueryHandler<GetIzmirCbsDoorNumbersQuery, IReadOnlyList<IzmirCbsOptionResponse>>
{
    private readonly IIzmirCbsAddressCatalog _catalog;

    public GetIzmirCbsDoorNumbersQueryHandler(IIzmirCbsAddressCatalog catalog)
    {
        _catalog = catalog;
    }

    public ValueTask<IReadOnlyList<IzmirCbsOptionResponse>> Handle(
        GetIzmirCbsDoorNumbersQuery request,
        CancellationToken cancellationToken)
        => new(_catalog.GetDoorNumbersAsync(request.StreetId, request.NeighborhoodId, cancellationToken));
}

public sealed class GetIzmirCbsPointQueryHandler
    : IQueryHandler<GetIzmirCbsPointQuery, IzmirCbsPointResponse?>
{
    private readonly IIzmirCbsAddressCatalog _catalog;

    public GetIzmirCbsPointQueryHandler(IIzmirCbsAddressCatalog catalog)
    {
        _catalog = catalog;
    }

    public ValueTask<IzmirCbsPointResponse?> Handle(
        GetIzmirCbsPointQuery request,
        CancellationToken cancellationToken)
        => new(_catalog.LocateAsync(
            request.DistrictId,
            request.Neighborhood,
            request.Street,
            request.StreetNo,
            request.AllowNeighborhoodFallback,
            cancellationToken));
}

public sealed record GetIzmirCbsNearestQuery(
    string DistrictId,
    double Latitude,
    double Longitude) : IQuery<IzmirCbsNearestAddressResponse?>;

public sealed class GetIzmirCbsNearestQueryValidator : AbstractValidator<GetIzmirCbsNearestQuery>
{
    public GetIzmirCbsNearestQueryValidator()
    {
        RuleFor(x => x.DistrictId)
            .NotEmpty()
            .WithMessage("İlçe seçiniz.");
        RuleFor(x => x.Latitude)
            .InclusiveBetween(-90, 90)
            .WithMessage("Geçersiz enlem.");
        RuleFor(x => x.Longitude)
            .InclusiveBetween(-180, 180)
            .WithMessage("Geçersiz boylam.");
    }
}

public sealed class GetIzmirCbsNearestQueryHandler
    : IQueryHandler<GetIzmirCbsNearestQuery, IzmirCbsNearestAddressResponse?>
{
    private readonly IIzmirCbsAddressCatalog _catalog;

    public GetIzmirCbsNearestQueryHandler(IIzmirCbsAddressCatalog catalog)
    {
        _catalog = catalog;
    }

    public ValueTask<IzmirCbsNearestAddressResponse?> Handle(
        GetIzmirCbsNearestQuery request,
        CancellationToken cancellationToken)
        => new(_catalog.FindNearestAddressAsync(
            request.DistrictId,
            request.Latitude,
            request.Longitude,
            cancellationToken));
}

public sealed record GetIzmirCbsLandmarksQuery(string DistrictId)
    : IQuery<IReadOnlyList<IzmirCbsLandmarkResponse>>;

public sealed class GetIzmirCbsLandmarksQueryValidator : AbstractValidator<GetIzmirCbsLandmarksQuery>
{
    public GetIzmirCbsLandmarksQueryValidator()
    {
        RuleFor(x => x.DistrictId)
            .NotEmpty()
            .WithMessage("İlçe seçiniz.");
    }
}

public sealed class GetIzmirCbsLandmarksQueryHandler
    : IQueryHandler<GetIzmirCbsLandmarksQuery, IReadOnlyList<IzmirCbsLandmarkResponse>>
{
    private readonly IIzmirCbsAddressCatalog _catalog;

    public GetIzmirCbsLandmarksQueryHandler(IIzmirCbsAddressCatalog catalog)
    {
        _catalog = catalog;
    }

    public ValueTask<IReadOnlyList<IzmirCbsLandmarkResponse>> Handle(
        GetIzmirCbsLandmarksQuery request,
        CancellationToken cancellationToken)
        => new(_catalog.GetLandmarksAsync(request.DistrictId, cancellationToken));
}

public sealed record GetIzmirCbsMapReferenceLandmarksQuery(string DistrictId)
    : IQuery<IReadOnlyList<IzmirCbsLandmarkResponse>>;

public sealed class GetIzmirCbsMapReferenceLandmarksQueryValidator : AbstractValidator<GetIzmirCbsMapReferenceLandmarksQuery>
{
    public GetIzmirCbsMapReferenceLandmarksQueryValidator()
    {
        RuleFor(x => x.DistrictId)
            .NotEmpty()
            .WithMessage("İlçe seçiniz.");
    }
}

public sealed class GetIzmirCbsMapReferenceLandmarksQueryHandler
    : IQueryHandler<GetIzmirCbsMapReferenceLandmarksQuery, IReadOnlyList<IzmirCbsLandmarkResponse>>
{
    private readonly IIzmirCbsAddressCatalog _catalog;

    public GetIzmirCbsMapReferenceLandmarksQueryHandler(IIzmirCbsAddressCatalog catalog)
    {
        _catalog = catalog;
    }

    public ValueTask<IReadOnlyList<IzmirCbsLandmarkResponse>> Handle(
        GetIzmirCbsMapReferenceLandmarksQuery request,
        CancellationToken cancellationToken)
        => new(_catalog.GetMapReferenceLandmarksAsync(request.DistrictId, cancellationToken));
}

namespace CityCommunicationCenter.Application.Features.IzmirCbs;

public sealed record GetIzmirCbsNeighborhoodsQuery(string DistrictId)
    : IQuery<IReadOnlyList<IzmirCbsOptionResponse>>;

public sealed record GetIzmirCbsStreetsQuery(string NeighborhoodId)
    : IQuery<IReadOnlyList<IzmirCbsOptionResponse>>;

public sealed record GetIzmirCbsDoorNumbersQuery(string StreetId, string NeighborhoodId)
    : IQuery<IReadOnlyList<IzmirCbsOptionResponse>>;

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

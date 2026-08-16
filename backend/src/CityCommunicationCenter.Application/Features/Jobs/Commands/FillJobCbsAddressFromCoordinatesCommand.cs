using CityCommunicationCenter.Application.Abstractions;

namespace CityCommunicationCenter.Application.Features.Jobs;

/// <summary>
/// Mahalle/cadde boş, koordinat dolu taleplere CBS’den mahalle+cadde yazar; No = Yok (#2719).
/// </summary>
public sealed record FillJobCbsAddressFromCoordinatesCommand(
    Guid JobId,
    Guid? ActorUserId,
    string DistrictId) : ICommand<bool>;

public sealed class FillJobCbsAddressFromCoordinatesCommandValidator
    : AbstractValidator<FillJobCbsAddressFromCoordinatesCommand>
{
    public FillJobCbsAddressFromCoordinatesCommandValidator()
    {
        RuleFor(x => x.DistrictId)
            .NotEmpty()
            .WithMessage("İlçe seçiniz.");
    }
}

public sealed class FillJobCbsAddressFromCoordinatesCommandHandler
    : ICommandHandler<FillJobCbsAddressFromCoordinatesCommand, bool>
{
    private const string StreetNoNone = "Yok";

    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;
    private readonly IIzmirCbsAddressCatalog _catalog;

    public FillJobCbsAddressFromCoordinatesCommandHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor,
        IIzmirCbsAddressCatalog catalog)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
        _catalog = catalog;
    }

    public async ValueTask<bool> Handle(
        FillJobCbsAddressFromCoordinatesCommand request,
        CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();
        await JobWorkflowAuthorization.RequireActorAsync(
            _dbContext, request.ActorUserId, tenantId, cancellationToken);

        var job = await _dbContext.Jobs.FirstOrDefaultAsync(
            item => item.JobId == request.JobId && item.TenantId == tenantId,
            cancellationToken);
        if (job is null)
        {
            return false;
        }

        if (!string.IsNullOrWhiteSpace(job.Neighborhood) || !string.IsNullOrWhiteSpace(job.Street))
        {
            return true;
        }

        if (job.Latitude is null || job.Longitude is null)
        {
            return false;
        }

        var nearest = await _catalog.FindNearestAddressAsync(
            request.DistrictId,
            job.Latitude.Value,
            job.Longitude.Value,
            cancellationToken);
        if (nearest is null)
        {
            return false;
        }

        job.Neighborhood = nearest.Neighborhood;
        job.Street = nearest.Street;
        job.StreetNo = StreetNoNone;
        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }
}

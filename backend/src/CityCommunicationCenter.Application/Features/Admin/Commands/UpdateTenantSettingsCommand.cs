using CityCommunicationCenter.Application.Common.Tenancy;
using Microsoft.Extensions.Localization;

namespace CityCommunicationCenter.Application.Features.Admin;

public sealed record UpdateTenantSettingsCommand(
    Guid TenantId,
    string DisplayName,
    string DeploymentMode,
    string? Theme,
    string? Domain,
    int DefaultSlaHours) : ICommand<Unit>;

public sealed class UpdateTenantSettingsCommandValidator : AbstractValidator<UpdateTenantSettingsCommand>
{
    public UpdateTenantSettingsCommandValidator(IStringLocalizer<ApplicationResource> localizer, IApplicationDbContext dbContext)
    {
        RuleFor(command => command.TenantId).NotEmpty();
        RuleFor(command => command.DisplayName)
            .NotEmpty()
            .WithMessage(localizer["ValidationDisplayNameRequired"])
            .MaximumLength(200);
        RuleFor(command => command.DeploymentMode)
            .NotEmpty()
            .Must(value => Enum.TryParse<DeploymentMode>(value, true, out _))
            .WithMessage(localizer["ValidationDeploymentModeRequired"]);
        RuleFor(command => command.DefaultSlaHours)
            .GreaterThan(0)
            .WithMessage(localizer["ValidationDefaultSlaPositive"]);
        RuleFor(command => command.Domain)
            .MustAsync((command, domain, cancellationToken) => BeUniqueDomainAsync(dbContext, command.TenantId, domain, cancellationToken))
            .WithMessage(localizer["ValidationTenantDomainUnique"]);
    }

    private static async Task<bool> BeUniqueDomainAsync(
        IApplicationDbContext dbContext,
        Guid tenantId,
        string? domain,
        CancellationToken cancellationToken)
    {
        var normalizedDomain = TenantDomainNormalizer.Normalize(domain);
        if (string.IsNullOrWhiteSpace(normalizedDomain))
        {
            return true;
        }

        var tenantDomains = await dbContext.Tenants
            .Where(entity => entity.TenantId != tenantId && entity.Domain != null)
            .Select(entity => entity.Domain)
            .ToListAsync(cancellationToken);

        var tenantSettingDomains = await dbContext.TenantSettings
            .IgnoreQueryFilters()
            .Where(entity => entity.TenantId != tenantId && entity.Domain != null)
            .Select(entity => entity.Domain)
            .ToListAsync(cancellationToken);

        return tenantDomains
            .Concat(tenantSettingDomains)
            .Select(TenantDomainNormalizer.Normalize)
            .All(existingDomain => !string.Equals(existingDomain, normalizedDomain, StringComparison.OrdinalIgnoreCase));
    }
}

public sealed class UpdateTenantSettingsCommandHandler : ICommandHandler<UpdateTenantSettingsCommand, Unit>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public UpdateTenantSettingsCommandHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<Unit> Handle(UpdateTenantSettingsCommand request, CancellationToken cancellationToken)
    {
        var actorUserId = _tenantContextAccessor.GetCurrent().UserId;
        var normalizedDomain = TenantDomainNormalizer.Normalize(request.Domain);
        var tenant = await _dbContext.Tenants
            .FirstAsync(entity => entity.TenantId == request.TenantId, cancellationToken);
        var settings = await _dbContext.TenantSettings
            .FirstOrDefaultAsync(entity => entity.TenantId == request.TenantId, cancellationToken);

        if (settings is null)
        {
            settings = new TenantSetting
            {
                TenantSettingId = Guid.NewGuid(),
                TenantId = request.TenantId,
                CreatedByUserId = actorUserId
            };

            _dbContext.TenantSettings.Add(settings);
        }
        else
        {
            settings.UpdatedByUserId = actorUserId;
            settings.UpdatedAtUtc = DateTimeOffset.UtcNow;
        }

        tenant.DisplayName = request.DisplayName.Trim();
        tenant.DeploymentMode = Enum.Parse<DeploymentMode>(request.DeploymentMode, true);
        tenant.Theme = string.IsNullOrWhiteSpace(request.Theme) ? null : request.Theme.Trim();
        tenant.Domain = normalizedDomain;

        settings.DisplayName = request.DisplayName.Trim();
        settings.Theme = string.IsNullOrWhiteSpace(request.Theme) ? null : request.Theme.Trim();
        settings.Domain = null;
        settings.DefaultSlaHours = request.DefaultSlaHours;

        _dbContext.AuditLogs.Add(new AuditLog
        {
            AuditLogId = Guid.NewGuid(),
            TenantId = request.TenantId,
            EntityType = nameof(TenantSetting),
            EntityId = settings.TenantSettingId.ToString(),
            Action = "TenantSettingsUpdated",
            ActorUserId = actorUserId,
            Details = $"Tenant settings updated (displayName='{settings.DisplayName}', slaHours={settings.DefaultSlaHours}).",
        });

        await _dbContext.SaveChangesAsync(cancellationToken);
        return Unit.Value;
    }
}
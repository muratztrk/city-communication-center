namespace CityCommunicationCenter.Application.Features.Social;

// Talep etiketleri Vatandaş Talepleri > WhatsApp Konuşmaları'ndaki "Talep Etiketi" alanı için
// paylaşılan (tenant genelinde) bir liste oluşturur; yalnızca Operatör/SystemAdmin ekleyebilir (kart #1510).
public sealed record CreateRequestTagCommand(string Name) : ICommand<RequestTagResponse>;

public sealed class CreateRequestTagCommandValidator : AbstractValidator<CreateRequestTagCommand>
{
    public CreateRequestTagCommandValidator()
    {
        RuleFor(c => c.Name).NotEmpty().WithMessage("Etiket adı gereklidir.");
    }
}

public sealed class CreateRequestTagCommandHandler : ICommandHandler<CreateRequestTagCommand, RequestTagResponse>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public CreateRequestTagCommandHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<RequestTagResponse> Handle(CreateRequestTagCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        var userId = context.UserId;

        var canManage = Enum.TryParse<RoleCode>(context.RoleCode, true, out var roleCode)
            && roleCode is RoleCode.Operator or RoleCode.SystemAdmin;
        if (!canManage)
        {
            throw new ForbiddenAccessException("Talep etiketi yalnızca Vatandaş Talep Operatörü veya Sistem Yöneticisi ekleyebilir.");
        }

        var name = request.Name.Trim();

        var existing = await _dbContext.RequestTags
            .FirstOrDefaultAsync(entity => entity.TenantId == tenantId && entity.Name == name, cancellationToken);
        if (existing is not null)
        {
            return new RequestTagResponse(existing.TagId, existing.Name);
        }

        var tag = new RequestTag
        {
            TagId = Guid.NewGuid(),
            TenantId = tenantId,
            Name = name,
            CreatedByUserId = userId,
            UpdatedByUserId = userId,
        };
        _dbContext.RequestTags.Add(tag);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return new RequestTagResponse(tag.TagId, tag.Name);
    }
}

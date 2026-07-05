using CityCommunicationCenter.Application.Common;

namespace CityCommunicationCenter.Application.Features.Social;

public sealed record UpdateCitizenConversationProfileCommand(
    Guid CitizenConversationId,
    string? CitizenName,
    string? CitizenPhone,
    string? Label,
    string? Neighborhood,
    string? Street,
    string? OpenAddress) : ICommand<bool>;

public sealed class UpdateCitizenConversationProfileCommandValidator : AbstractValidator<UpdateCitizenConversationProfileCommand>
{
    public UpdateCitizenConversationProfileCommandValidator()
    {
        RuleFor(c => c.Street).MaximumLength(AddressFieldLimits.StreetMaxLength)
            .WithMessage("Cadde / Sokak / Bulvar en fazla 50 karakter olabilir.");
        RuleFor(c => c.OpenAddress).MaximumLength(AddressFieldLimits.OpenAddressMaxLength)
            .WithMessage("Açık Adres en fazla 100 karakter olabilir.");
    }
}

public sealed class UpdateCitizenConversationProfileCommandHandler
    : ICommandHandler<UpdateCitizenConversationProfileCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public UpdateCitizenConversationProfileCommandHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<bool> Handle(UpdateCitizenConversationProfileCommand request, CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();
        var conversation = await _dbContext.CitizenConversations
            .FirstOrDefaultAsync(c => c.CitizenConversationId == request.CitizenConversationId && c.TenantId == tenantId, cancellationToken);

        if (conversation is null) return false;

        conversation.CitizenName = NormalizeOptional(request.CitizenName);
        conversation.Label = NormalizeOptional(request.Label);
        conversation.Neighborhood = NormalizeOptional(request.Neighborhood);
        conversation.Street = NormalizeOptional(request.Street);
        conversation.OpenAddress = NormalizeOptional(request.OpenAddress);

        var phone = NormalizePhone(request.CitizenPhone);
        if (!string.IsNullOrWhiteSpace(phone))
        {
            conversation.CitizenPhone = phone;
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    private static string? NormalizeOptional(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string? NormalizePhone(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var digits = new string(value.Where(char.IsDigit).ToArray());
        return string.IsNullOrWhiteSpace(digits) ? null : digits;
    }
}

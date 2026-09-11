using CityCommunicationCenter.Application.Common;

namespace CityCommunicationCenter.Application.Features.Social;

public sealed record UpdateCitizenConversationProfileCommand(
    Guid CitizenConversationId,
    string? CitizenName,
    string? CitizenPhone,
    string? Label,
    string? Neighborhood,
    string? Street,
    string? StreetNo,
    string? OpenAddress,
    bool AllowClear = false) : ICommand<bool>;

public sealed class UpdateCitizenConversationProfileCommandValidator : AbstractValidator<UpdateCitizenConversationProfileCommand>
{
    public UpdateCitizenConversationProfileCommandValidator()
    {
        RuleFor(c => c.Street).MaximumLength(AddressFieldLimits.StreetMaxLength)
            .WithMessage("Cadde / Sokak en fazla 50 karakter olabilir.");
        RuleFor(c => c.StreetNo).MaximumLength(AddressFieldLimits.StreetNoMaxLength)
            .WithMessage("No en fazla 20 karakter olabilir.");
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

        // Kayıtlı Vatandaş Bilgileri talep oluşturunca silinmez. Boş string ancak
        // WhatsApp / dizin Kaydet (`AllowClear`) ile elle temizlenir.
        conversation.CitizenName = ApplyProfileField(conversation.CitizenName, request.CitizenName, request.AllowClear);
        conversation.Label = ApplyProfileField(conversation.Label, request.Label, request.AllowClear);
        conversation.Neighborhood = ApplyProfileField(conversation.Neighborhood, request.Neighborhood, request.AllowClear);
        conversation.Street = ApplyProfileField(conversation.Street, request.Street, request.AllowClear);
        conversation.StreetNo = ApplyProfileField(conversation.StreetNo, request.StreetNo, request.AllowClear);
        conversation.OpenAddress = ApplyProfileField(conversation.OpenAddress, request.OpenAddress, request.AllowClear);

        var phone = NormalizePhone(request.CitizenPhone);
        if (!string.IsNullOrWhiteSpace(phone))
        {
            conversation.CitizenPhone = phone;
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    private static string? ApplyProfileField(string? current, string? incoming, bool allowClear)
    {
        if (incoming is null)
        {
            return current;
        }

        var normalized = string.IsNullOrWhiteSpace(incoming) ? null : incoming.Trim();
        if (normalized is null)
        {
            return allowClear ? null : current;
        }

        return normalized;
    }

    private static string? NormalizePhone(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var digits = new string(value.Where(char.IsDigit).ToArray());
        return string.IsNullOrWhiteSpace(digits) ? null : digits;
    }
}

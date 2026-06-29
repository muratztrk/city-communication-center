using CityCommunicationCenter.Application.Features.Users;

namespace CityCommunicationCenter.Application.Features.Social;

// Beklemedeki (henüz iletilmemiş) bir WhatsApp yanıtının metnini düzenler. Yalnızca Vatandaş
// Operatörü veya Sistem Yöneticisi düzenleyebilir (card #1094).
public sealed record EditPendingConversationEntryCommand(
    Guid SocialMessageId,
    Guid EntryId,
    string Content,
    Guid? ActorUserId) : ICommand<bool>;

public sealed class EditPendingConversationEntryCommandValidator : AbstractValidator<EditPendingConversationEntryCommand>
{
    public EditPendingConversationEntryCommandValidator()
    {
        RuleFor(c => c.Content).NotEmpty().WithMessage("Mesaj içeriği boş olamaz.");
    }
}

public sealed class EditPendingConversationEntryCommandHandler
    : ICommandHandler<EditPendingConversationEntryCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public EditPendingConversationEntryCommandHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<bool> Handle(EditPendingConversationEntryCommand request, CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();
        var actor = await ActorAuthorization.RequireActiveActorAsync(_dbContext, request.ActorUserId, tenantId, cancellationToken);

        if (actor.RoleCode != RoleCode.Operator && actor.RoleCode != RoleCode.SystemAdmin)
        {
            throw new ForbiddenAccessException("Bekleyen mesajı yalnızca Vatandaş Talep Operatörü veya Sistem Yöneticisi düzenleyebilir.");
        }

        var message = await _dbContext.SocialMessages.FirstOrDefaultAsync(
            m => m.SocialMessageId == request.SocialMessageId && m.TenantId == tenantId, cancellationToken);
        if (message is null) return false;

        var entry = await _dbContext.ConversationEntries.FirstOrDefaultAsync(
            e => e.EntryId == request.EntryId && e.SocialMessageId == request.SocialMessageId, cancellationToken);
        if (entry is null) return false;

        // Yalnızca beklemedeki giden mesaj düzenlenebilir.
        if (entry.Direction != ConversationEntryDirection.Outbound
            || entry.DeliveryStatus != ConversationDeliveryStatus.Pending)
        {
            throw new ValidationException([
                new FluentValidation.Results.ValidationFailure(nameof(request.EntryId), "Bu mesaj düzenlenebilir durumda değil.")
            ]);
        }

        entry.Content = request.Content.Trim();
        entry.EditedAtUtc = DateTimeOffset.UtcNow;
        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }
}

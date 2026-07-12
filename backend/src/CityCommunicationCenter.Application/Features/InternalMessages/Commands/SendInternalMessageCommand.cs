namespace CityCommunicationCenter.Application.Features.InternalMessages;

public sealed record SendInternalMessageCommand(Guid RecipientUserId, Guid? ActorUserId, string Content)
    : ICommand<SendInternalMessageResponse?>;

public sealed class SendInternalMessageCommandValidator : AbstractValidator<SendInternalMessageCommand>
{
    public SendInternalMessageCommandValidator()
    {
        RuleFor(c => c.Content).NotEmpty().WithMessage("Mesaj içeriği zorunludur.")
            .MaximumLength(4000).WithMessage("Mesaj en fazla 4000 karakter olabilir.");
        RuleFor(c => c.RecipientUserId).NotEmpty().WithMessage("Alıcı kullanıcı zorunludur.");
        RuleFor(c => c).Must(c => c.ActorUserId != c.RecipientUserId)
            .WithMessage("Kendinize mesaj gönderemezsiniz.");
    }
}

public sealed class SendInternalMessageCommandHandler
    : ICommandHandler<SendInternalMessageCommand, SendInternalMessageResponse?>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;
    private readonly INotificationPushService _notificationPushService;

    public SendInternalMessageCommandHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor,
        INotificationPushService notificationPushService)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
        _notificationPushService = notificationPushService;
    }

    public async ValueTask<SendInternalMessageResponse?> Handle(SendInternalMessageCommand request, CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();
        var currentUserId = request.ActorUserId ?? Guid.Empty;

        // Pasif kullanıcıya mesaj gönderilemez — SearchUsersQuery ile aynı kural (codex review, card #1539).
        var recipientExists = await _dbContext.Users.AsNoTracking()
            .AnyAsync(u => u.TenantId == tenantId && u.UserId == request.RecipientUserId && u.IsActive, cancellationToken);
        if (!recipientExists) return null;

        var senderName = await _dbContext.Users.AsNoTracking()
            .Where(u => u.TenantId == tenantId && u.UserId == currentUserId)
            .Select(u => u.DisplayName)
            .FirstOrDefaultAsync(cancellationToken) ?? string.Empty;

        var (userAId, userBId) = InternalConversationHelper.NormalizePair(currentUserId, request.RecipientUserId);
        var utcNow = DateTimeOffset.UtcNow;

        var conversation = await _dbContext.InternalConversations
            .FirstOrDefaultAsync(c => c.TenantId == tenantId && c.UserAId == userAId && c.UserBId == userBId, cancellationToken);
        if (conversation is null)
        {
            conversation = new InternalConversation
            {
                InternalConversationId = Guid.NewGuid(),
                TenantId = tenantId,
                UserAId = userAId,
                UserBId = userBId,
                LastMessageAtUtc = utcNow,
                CreatedByUserId = request.ActorUserId,
            };
            _dbContext.InternalConversations.Add(conversation);
            try
            {
                await _dbContext.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateException)
            {
                // İki kullanıcı aynı anda ilk mesajı gönderirse eşsiz indeks bir isteği reddeder;
                // mesajı kaybetmek yerine kazanan satırı kullanmaya devam et (codex review, card #1539).
                _dbContext.InternalConversations.Entry(conversation).State = EntityState.Detached;
                conversation = await _dbContext.InternalConversations
                    .FirstAsync(c => c.TenantId == tenantId && c.UserAId == userAId && c.UserBId == userBId, cancellationToken);
            }
        }
        else
        {
            conversation.LastMessageAtUtc = utcNow;
        }

        var content = request.Content.Trim();
        var message = new InternalMessage
        {
            InternalMessageId = Guid.NewGuid(),
            TenantId = tenantId,
            InternalConversationId = conversation.InternalConversationId,
            SenderUserId = currentUserId,
            Content = content,
            CreatedAtUtc = utcNow,
            CreatedByUserId = request.ActorUserId,
        };
        _dbContext.InternalMessages.Add(message);

        await _dbContext.SaveChangesAsync(cancellationToken);

        // Mesaj zaten kalıcı kaydedildi — SignalR bildirimi başarısız olsa da isteği başarısız gösterme,
        // aksi halde istemci zaten gönderilmiş mesajı tekrar göndermeye çalışıp mükerrer oluşturur
        // (codex review, card #1539). Alıcı bir sonraki poll'da mesajı zaten görür.
        try
        {
            await _notificationPushService.SendInternalMessageToUserAsync(
                tenantId,
                request.RecipientUserId,
                new InternalMessagePayload(conversation.InternalConversationId, currentUserId, senderName, content, utcNow),
                cancellationToken);
        }
        catch (Exception)
        {
            // yoksay — mesaj kaydedildi, gerçek zamanlı bildirim en iyi çaba (best-effort)
        }

        return new SendInternalMessageResponse(
            conversation.InternalConversationId,
            new InternalMessageResponse(message.InternalMessageId, message.SenderUserId, message.Content, message.CreatedAtUtc, message.ReadAtUtc));
    }
}

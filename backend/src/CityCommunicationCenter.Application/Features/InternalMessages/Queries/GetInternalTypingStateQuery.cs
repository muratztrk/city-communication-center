namespace CityCommunicationCenter.Application.Features.InternalMessages;

public sealed record GetInternalTypingStateQuery(Guid OtherUserId, Guid? ActorUserId)
    : IQuery<InternalTypingStateResponse>;

public sealed class GetInternalTypingStateQueryHandler
    : IQueryHandler<GetInternalTypingStateQuery, InternalTypingStateResponse>
{
    private readonly IInternalTypingStateCache _typingStateCache;

    public GetInternalTypingStateQueryHandler(IInternalTypingStateCache typingStateCache)
    {
        _typingStateCache = typingStateCache;
    }

    public ValueTask<InternalTypingStateResponse> Handle(
        GetInternalTypingStateQuery request,
        CancellationToken cancellationToken)
    {
        var currentUserId = request.ActorUserId
            ?? throw new ForbiddenAccessException("Oturum kullanıcısı bulunamadı.");

        var isTyping = _typingStateCache.IsTyping(request.OtherUserId, currentUserId);
        return ValueTask.FromResult(new InternalTypingStateResponse(isTyping));
    }
}

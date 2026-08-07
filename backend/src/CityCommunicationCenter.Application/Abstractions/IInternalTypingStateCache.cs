namespace CityCommunicationCenter.Application.Abstractions;

public interface IInternalTypingStateCache
{
    void SetTyping(Guid senderUserId, Guid recipientUserId, bool isTyping);

    bool IsTyping(Guid senderUserId, Guid recipientUserId);
}

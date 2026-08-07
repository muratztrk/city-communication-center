using System.Collections.Concurrent;
using CityCommunicationCenter.Application.Abstractions;

namespace CityCommunicationCenter.Infrastructure.Services;

public sealed class InternalTypingStateCache : IInternalTypingStateCache
{
    private static readonly TimeSpan ActiveTtl = TimeSpan.FromSeconds(5);
    private readonly ConcurrentDictionary<string, DateTimeOffset> _activeUntil = new();

    public void SetTyping(Guid senderUserId, Guid recipientUserId, bool isTyping)
    {
        var key = BuildKey(senderUserId, recipientUserId);
        if (!isTyping)
        {
            _activeUntil.TryRemove(key, out _);
            return;
        }

        _activeUntil[key] = DateTimeOffset.UtcNow.Add(ActiveTtl);
    }

    public bool IsTyping(Guid senderUserId, Guid recipientUserId)
    {
        var key = BuildKey(senderUserId, recipientUserId);
        if (!_activeUntil.TryGetValue(key, out var activeUntil))
        {
            return false;
        }

        if (activeUntil <= DateTimeOffset.UtcNow)
        {
            _activeUntil.TryRemove(key, out _);
            return false;
        }

        return true;
    }

    private static string BuildKey(Guid senderUserId, Guid recipientUserId)
        => $"{senderUserId:D}|{recipientUserId:D}";
}

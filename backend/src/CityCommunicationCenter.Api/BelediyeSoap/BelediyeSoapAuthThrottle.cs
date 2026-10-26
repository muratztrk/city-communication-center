using System.Collections.Concurrent;

namespace CityCommunicationCenter.Api.BelediyeSoap;

public sealed class BelediyeSoapAuthThrottleOptions
{
    public const string SectionName = "BelediyeSoap:AuthThrottle";

    /// <summary>Pencere icinde izin verilen hatali kimlik dogrulama sayisi; asildiginda istemci pencere bitene kadar kilitlenir.</summary>
    public int MaxFailures { get; set; } = 10;

    public int WindowSeconds { get; set; } = 900;
}

/// <summary>
/// /service (e-Devlet SOAP) icin IP basina hatali giris sayaci. Genel rate limiter bu yolu kapsamaz
/// (middleware ondan once calisir); bu sayac SOAP sifresine kaba kuvvet denemesini sinirlar.
/// Basarili istekler sayilmaz, boylece e-Devlet'in yogun trafigi kisilmaz.
/// </summary>
public sealed class BelediyeSoapAuthThrottle
{
    private const int CleanupThreshold = 10_000;

    private readonly ConcurrentDictionary<string, FailureWindow> _failures = new(StringComparer.Ordinal);
    private readonly int _maxFailures;
    private readonly TimeSpan _window;
    private readonly TimeProvider _timeProvider;

    public BelediyeSoapAuthThrottle(BelediyeSoapAuthThrottleOptions options, TimeProvider? timeProvider = null)
    {
        _maxFailures = Math.Max(1, options.MaxFailures);
        _window = TimeSpan.FromSeconds(Math.Max(1, options.WindowSeconds));
        _timeProvider = timeProvider ?? TimeProvider.System;
    }

    public bool IsLockedOut(string clientKey)
    {
        if (!_failures.TryGetValue(clientKey, out var entry))
        {
            return false;
        }

        if (IsExpired(entry))
        {
            _failures.TryRemove(new KeyValuePair<string, FailureWindow>(clientKey, entry));
            return false;
        }

        return entry.Count >= _maxFailures;
    }

    public void RegisterFailure(string clientKey)
    {
        if (_failures.Count >= CleanupThreshold)
        {
            RemoveExpired();
        }

        var now = _timeProvider.GetUtcNow();
        _failures.AddOrUpdate(
            clientKey,
            _ => new FailureWindow(now, 1),
            (_, existing) => IsExpired(existing) ? new FailureWindow(now, 1) : existing with { Count = existing.Count + 1 });
    }

    public void Reset(string clientKey) => _failures.TryRemove(clientKey, out _);

    private bool IsExpired(FailureWindow entry) => _timeProvider.GetUtcNow() - entry.StartedAtUtc >= _window;

    private void RemoveExpired()
    {
        foreach (var pair in _failures)
        {
            if (IsExpired(pair.Value))
            {
                _failures.TryRemove(pair);
            }
        }
    }

    private sealed record FailureWindow(DateTimeOffset StartedAtUtc, int Count);
}

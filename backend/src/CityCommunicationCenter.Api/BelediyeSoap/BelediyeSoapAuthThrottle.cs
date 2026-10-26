using System.Collections.Concurrent;
using System.Net;
using System.Net.Sockets;

namespace CityCommunicationCenter.Api.BelediyeSoap;

public sealed class BelediyeSoapAuthThrottleOptions
{
    public const string SectionName = "BelediyeSoap:AuthThrottle";

    /// <summary>Pencere icinde izin verilen hatali kimlik dogrulama sayisi; asildiginda istemci pencere bitene kadar kilitlenir.</summary>
    public int MaxFailures { get; set; } = 10;

    public int WindowSeconds { get; set; } = 900;
}

/// <summary>
/// /service (e-Devlet SOAP) icin hatali giris sayaci. Genel rate limiter bu yolu kapsamaz
/// (middleware ondan once calisir); bu sayac SOAP sifresine kaba kuvvet denemesini sinirlar.
///
/// - Anahtar (istemci IP, belediyeKodu): bir belediyeye yapilan denemeler baska belediyenin cagrisini kilitlemez,
///   baska belediyedeki basarili giris de bu sayaci sifirlamaz.
/// - Hak, kimlik dogrulamadan ONCE atomik olarak ayrilir; paralel istekler kontrol ile kayit arasindaki
///   bosluktan sinirin otesine gecemez. Basarili giriste sayac sifirlanir, sifreyle ilgisiz hatada hak geri verilir.
/// - Yalnizca sifre/kullanici uyusmazligi sayilir; basarili istekler sayilmaz, e-Devlet trafigi kisilmaz.
/// </summary>
public sealed class BelediyeSoapAuthThrottle
{
    // Bu kadar anahtar birikirse once suresi gecenler, yetmezse en eskiler atilir; tarama her istekte degil, yalnizca dolunca yapilir.
    private const int MaxEntries = 10_000;

    private readonly ConcurrentDictionary<string, FailureWindow> _attempts = new(StringComparer.Ordinal);
    private readonly int _maxFailures;
    private readonly TimeSpan _window;
    private readonly TimeProvider _timeProvider;

    public BelediyeSoapAuthThrottle(BelediyeSoapAuthThrottleOptions options, TimeProvider? timeProvider = null)
    {
        _maxFailures = Math.Max(1, options.MaxFailures);
        _window = TimeSpan.FromSeconds(Math.Max(1, options.WindowSeconds));
        _timeProvider = timeProvider ?? TimeProvider.System;
    }

    /// <summary>IPv6 istemciler /64 blogu ile gruplanir; tek blok icinde adres degistirerek sinir asilamaz.</summary>
    public static string ClientKey(IPAddress? remoteIp, string belediyeKodu)
    {
        var ip = remoteIp?.IsIPv4MappedToIPv6 == true ? remoteIp.MapToIPv4() : remoteIp;
        var ipKey = ip switch
        {
            null => "unknown",
            { AddressFamily: AddressFamily.InterNetworkV6 } => Ipv6Prefix64(ip),
            _ => ip.ToString(),
        };

        return ipKey + "|" + belediyeKodu.Trim().ToUpperInvariant();
    }

    /// <summary>Bir deneme hakki ayirir. Sinir dolmussa false doner ve kimlik bilgisi hic denetlenmemelidir.</summary>
    public bool TryBeginAttempt(string clientKey)
    {
        if (_attempts.Count >= MaxEntries)
        {
            Compact();
        }

        var now = _timeProvider.GetUtcNow();
        var acquired = false;
        _attempts.AddOrUpdate(
            clientKey,
            _ =>
            {
                acquired = true;
                return new FailureWindow(now, 1);
            },
            (_, existing) =>
            {
                if (IsExpired(existing, now))
                {
                    acquired = true;
                    return new FailureWindow(now, 1);
                }

                acquired = existing.Count < _maxFailures;
                return acquired ? existing with { Count = existing.Count + 1 } : existing;
            });

        return acquired;
    }

    /// <summary>Basarili giris: sayac sifirlanir.</summary>
    public void Succeeded(string clientKey) => _attempts.TryRemove(clientKey, out _);

    /// <summary>Sifreyle ilgisiz basarisizlik (bilinmeyen belediye kodu, eksik ayar): ayrilan hak geri verilir.</summary>
    public void ReleaseAttempt(string clientKey)
    {
        while (_attempts.TryGetValue(clientKey, out var existing) && existing.Count > 0)
        {
            if (_attempts.TryUpdate(clientKey, existing with { Count = existing.Count - 1 }, existing))
            {
                return;
            }
        }
    }

    private bool IsExpired(FailureWindow entry, DateTimeOffset now) => now - entry.StartedAtUtc >= _window;

    private void Compact()
    {
        var now = _timeProvider.GetUtcNow();
        foreach (var pair in _attempts)
        {
            if (IsExpired(pair.Value, now))
            {
                _attempts.TryRemove(pair);
            }
        }

        if (_attempts.Count < MaxEntries)
        {
            return;
        }

        foreach (var pair in _attempts.OrderBy(pair => pair.Value.StartedAtUtc).Take(_attempts.Count - (MaxEntries / 2)))
        {
            _attempts.TryRemove(pair);
        }
    }

    private static string Ipv6Prefix64(IPAddress ip)
    {
        var bytes = ip.GetAddressBytes();
        Array.Clear(bytes, 8, 8);
        return new IPAddress(bytes) + "/64";
    }

    private sealed record FailureWindow(DateTimeOffset StartedAtUtc, int Count);
}

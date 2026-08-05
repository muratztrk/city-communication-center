using System.Net;

namespace CityCommunicationCenter.Infrastructure.Security;

internal static class IpCidrMatcher
{
    public static bool IsMatch(IPAddress address, IReadOnlyList<string> cidrs)
    {
        return cidrs.Any(cidr => IpCidrRange.TryParse(cidr, out var range) && range.Contains(address));
    }

    private sealed class IpCidrRange
    {
        private IpCidrRange(IPAddress networkAddress, int prefixLength)
        {
            NetworkAddress = networkAddress;
            PrefixLength = prefixLength;
        }

        public IPAddress NetworkAddress { get; }

        public int PrefixLength { get; }

        public bool Contains(IPAddress address)
        {
            var networkAddress = NetworkAddress.IsIPv4MappedToIPv6 ? NetworkAddress.MapToIPv4() : NetworkAddress;
            var candidateAddress = address.IsIPv4MappedToIPv6 ? address.MapToIPv4() : address;
            var networkBytes = networkAddress.GetAddressBytes();
            var addressBytes = candidateAddress.GetAddressBytes();
            if (addressBytes.Length != networkBytes.Length)
            {
                return false;
            }

            var fullBytes = PrefixLength / 8;
            var remainingBits = PrefixLength % 8;

            for (var index = 0; index < fullBytes; index += 1)
            {
                if (networkBytes[index] != addressBytes[index])
                {
                    return false;
                }
            }

            if (remainingBits == 0)
            {
                return true;
            }

            var mask = (byte)(byte.MaxValue << (8 - remainingBits));
            return (networkBytes[fullBytes] & mask) == (addressBytes[fullBytes] & mask);
        }

        public static bool TryParse(string value, out IpCidrRange range)
        {
            range = null!;
            if (string.IsNullOrWhiteSpace(value))
            {
                return false;
            }

            var parts = value.Split('/', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length != 2 || !IPAddress.TryParse(parts[0], out var networkAddress))
            {
                return false;
            }

            if (!int.TryParse(parts[1], out var prefixLength))
            {
                return false;
            }

            var maxPrefix = networkAddress.AddressFamily == System.Net.Sockets.AddressFamily.InterNetworkV6 ? 128 : 32;
            if (prefixLength < 0 || prefixLength > maxPrefix)
            {
                return false;
            }

            range = new IpCidrRange(networkAddress, prefixLength);
            return true;
        }
    }
}

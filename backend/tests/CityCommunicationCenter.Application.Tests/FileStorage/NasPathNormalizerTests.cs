using CityCommunicationCenter.Shared.FileStorage;

namespace CityCommunicationCenter.Application.Tests.FileStorage;

public sealed class NasPathNormalizerTests
{
    [Theory]
    [InlineData(@"\\192.168.0.10\Tire İletisim Merkezi", "Tire Iletisim Merkezi")]
    [InlineData("//192.168.0.10/share", "share")]
    [InlineData("plain-share", "plain-share")]
    [InlineData("Tire İletisim Merkezi", "Tire Iletisim Merkezi")]
    [InlineData("Şehir Paylaşım", "Sehir Paylasim")]
    [InlineData(null, null)]
    public void NormalizeShareName_ExtractsShareFromUnc(string? input, string? expected)
    {
        Assert.Equal(expected, NasPathNormalizer.NormalizeShareName(input));
    }

    [Theory]
    [InlineData(@"\\192.168.0.10\Tire İletisim Merkezi", "192.168.0.10")]
    [InlineData("//nas.local/data", "nas.local")]
    [InlineData("192.168.0.10", "192.168.0.10")]
    [InlineData(null, null)]
    public void NormalizeHost_ExtractsHostFromUnc(string? input, string? expected)
    {
        Assert.Equal(expected, NasPathNormalizer.NormalizeHost(input));
    }
}

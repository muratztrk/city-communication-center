using CityCommunicationCenter.Infrastructure.BelediyeSoap;

namespace CityCommunicationCenter.Application.Tests.BelediyeSoap;

public sealed class BelediyeAddressCodesTests
{
    [Fact]
    public void Encode_IsStableAndFitsSddCodeLength()
    {
        var code = BelediyeAddressCodes.Encode("Atatürk Mahallesi");

        Assert.Equal(12, code.Length);
        Assert.Equal(code, BelediyeAddressCodes.Encode("  ATATÜRK   MAHALLESİ "));
        Assert.NotEqual(code, BelediyeAddressCodes.Encode("Cumhuriyet Mahallesi"));
    }

    [Fact]
    public void Resolve_CodeSurvivesNewNamesBeingAdded()
    {
        var code = BelediyeAddressCodes.Encode("Cumhuriyet Mahallesi");

        var before = BelediyeAddressCodes.Resolve(code, ["Cumhuriyet Mahallesi"]);
        var after = BelediyeAddressCodes.Resolve(code, ["Alsancak Mahallesi", "Cumhuriyet Mahallesi", "Zafer Mahallesi"]);

        Assert.Equal("Cumhuriyet Mahallesi", before);
        Assert.Equal("Cumhuriyet Mahallesi", after);
    }

    [Theory]
    [InlineData("3")]
    [InlineData("0123456789ab")]
    [InlineData("")]
    [InlineData(null)]
    public void Resolve_LegacyIndexOrUnknownCode_DoesNotBecomeAName(string? code)
    {
        Assert.Null(BelediyeAddressCodes.Resolve(code, ["Cumhuriyet Mahallesi"]));
    }

    [Fact]
    public void Resolve_FreeText_IsKeptAsName()
    {
        Assert.Equal("Merkez", BelediyeAddressCodes.Resolve(" Merkez ", ["Cumhuriyet Mahallesi"]));
    }
}

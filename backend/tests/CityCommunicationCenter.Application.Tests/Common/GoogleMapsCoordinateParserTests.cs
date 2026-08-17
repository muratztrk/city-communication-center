using CityCommunicationCenter.Application.Common;

namespace CityCommunicationCenter.Application.Tests.Common;

public sealed class GoogleMapsCoordinateParserTests
{
    [Theory]
    [InlineData("https://www.google.com/maps/@38.089012,27.735011,17z", 38.089012, 27.735011)]
    [InlineData("https://www.google.com.tr/maps/@38.089012,27.735011,17z", 38.089012, 27.735011)]
    [InlineData("https://www.google.com/maps?q=38.089012,27.735011", 38.089012, 27.735011)]
    [InlineData("https://www.google.com/maps/search/38.089012,27.735011", 38.089012, 27.735011)]
    [InlineData("https://maps.app.goo.gl/abc", null, null)]
    public void TryParse_ExtractsCoordinatesFromMapsUrls(string input, double? expectedLat, double? expectedLng)
    {
        var parsed = GoogleMapsCoordinateParser.TryParse(input);
        if (expectedLat is null)
        {
            Assert.Null(parsed);
            return;
        }

        Assert.NotNull(parsed);
        Assert.Equal(expectedLat.Value, parsed.Value.Latitude, 5);
        Assert.Equal(expectedLng!.Value, parsed.Value.Longitude, 5);
    }

    [Fact]
    public void IsAllowedMapsHost_AcceptsGoogleAndShortenerHosts()
    {
        Assert.True(GoogleMapsCoordinateParser.IsAllowedMapsHost("www.google.com.tr"));
        Assert.True(GoogleMapsCoordinateParser.IsAllowedMapsHost("maps.app.goo.gl"));
        Assert.False(GoogleMapsCoordinateParser.IsAllowedMapsHost("evil.example.com"));
    }
}

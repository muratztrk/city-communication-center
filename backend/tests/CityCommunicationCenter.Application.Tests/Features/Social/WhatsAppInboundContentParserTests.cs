using System.Text.Json;
using CityCommunicationCenter.Application.Features.Social;

namespace CityCommunicationCenter.Application.Tests.Features.Social;

public sealed class WhatsAppInboundContentParserTests
{
    [Fact]
    public void Reaction_with_emoji_returns_emoji_text()
    {
        using var doc = JsonDocument.Parse("""
            {
              "type": "reaction",
              "reaction": {
                "message_id": "wamid.test",
                "emoji": "👍"
              }
            }
            """);

        var (content, mediaId, _, _, _) = WhatsAppInboundContentParser.Parse(doc.RootElement);

        Assert.Equal("👍", content);
        Assert.Null(mediaId);
    }

    [Fact]
    public void Reaction_without_emoji_returns_tepki_placeholder()
    {
        using var doc = JsonDocument.Parse("""
            {
              "type": "reaction",
              "reaction": {
                "message_id": "wamid.test"
              }
            }
            """);

        var (content, _, _, _, _) = WhatsAppInboundContentParser.Parse(doc.RootElement);

        Assert.Equal("[tepki]", content);
    }

    [Fact]
    public void Unsupported_type_still_brackets_type_name()
    {
        using var doc = JsonDocument.Parse("""{ "type": "unsupported" }""");

        var (content, _, _, _, _) = WhatsAppInboundContentParser.Parse(doc.RootElement);

        Assert.Equal("[unsupported]", content);
    }

    [Fact]
    public void System_without_body_is_placeholder()
    {
        using var doc = JsonDocument.Parse("""
            {
              "type": "system",
              "system": { "type": "user_changed_number" }
            }
            """);

        var (content, mediaId, _, _, _) = WhatsAppInboundContentParser.Parse(doc.RootElement);

        Assert.Equal("[system]", content);
        Assert.Null(mediaId);
    }

    [Fact]
    public void System_with_body_keeps_body()
    {
        using var doc = JsonDocument.Parse("""
            {
              "type": "system",
              "system": {
                "body": "Kullanıcı numarasını değiştirdi",
                "type": "user_changed_number"
              }
            }
            """);

        var (content, _, _, _, _) = WhatsAppInboundContentParser.Parse(doc.RootElement);

        Assert.Equal("Kullanıcı numarasını değiştirdi", content);
    }

    [Theory]
    [InlineData("[unsupported]", null, true)]
    [InlineData("[unsupported]", "", true)]
    [InlineData("[unsupported]", "media-id", false)]
    [InlineData("[system]", null, true)]
    [InlineData("[image]", null, false)]
    [InlineData("Merhaba", null, false)]
    public void IsIgnorableInboundNoise_detects_unsupported_without_media(
        string content,
        string? mediaId,
        bool expected)
    {
        Assert.Equal(expected, WhatsAppInboundContentParser.IsIgnorableInboundNoise(content, mediaId));
    }
}

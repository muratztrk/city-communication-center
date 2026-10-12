using System.Text.Json;
using CityCommunicationCenter.Application.Features.Social;

namespace CityCommunicationCenter.Application.Tests.Features.Social;

public sealed class WhatsAppWebhookForensicsTests
{
    [Fact]
    public void MaskSender_keeps_last_four_digits()
    {
        Assert.Equal("********6544", WhatsAppWebhookForensics.MaskSender("905453566544"));
        Assert.Equal("****", WhatsAppWebhookForensics.MaskSender("12"));
        Assert.Equal(string.Empty, WhatsAppWebhookForensics.MaskSender("  "));
    }

    [Theory]
    [InlineData("111", "111", false)]
    [InlineData("222", "111", true)]
    [InlineData(null, "111", false)]
    [InlineData("111", null, false)]
    public void IsPhoneNumberMismatch_only_when_both_ids_present_and_differ(
        string? payloadPhoneNumberId,
        string? expectedPhoneNumberId,
        bool expected)
    {
        Assert.Equal(
            expected,
            WhatsAppWebhookForensics.IsPhoneNumberMismatch(payloadPhoneNumberId, expectedPhoneNumberId));
    }

    [Fact]
    public void Enumerate_returns_message_status_and_echo_without_body_text()
    {
        using var document = JsonDocument.Parse("""
            {
              "object": "whatsapp_business_account",
              "entry": [
                {
                  "id": "waba-1",
                  "changes": [
                    {
                      "field": "messages",
                      "value": {
                        "metadata": { "phone_number_id": "pn-tire" },
                        "messages": [
                          {
                            "from": "905453566544",
                            "id": "wamid.IN",
                            "type": "text",
                            "text": { "body": "GIZLI-METIN-1210" }
                          }
                        ],
                        "statuses": [
                          {
                            "id": "wamid.OUT",
                            "status": "delivered",
                            "recipient_id": "905541429331"
                          }
                        ],
                        "message_echoes": [
                          {
                            "to": "905541429331",
                            "id": "wamid.ECHO",
                            "type": "text",
                            "text": { "body": "GIZLI-ECHO" }
                          }
                        ]
                      }
                    }
                  ]
                }
              ]
            }
            """);

        var hints = WhatsAppWebhookForensics.Enumerate(document.RootElement);

        Assert.Equal(3, hints.Count);
        Assert.Contains(hints, hint => hint.EventType == "message" && hint.MessageId == "wamid.IN" && hint.SenderMasked == "********6544" && hint.MessageType == "text");
        Assert.Contains(hints, hint => hint.EventType == "status" && hint.MessageId == "wamid.OUT" && hint.MessageType == "delivered");
        Assert.Contains(hints, hint => hint.EventType == "echo" && hint.MessageId == "wamid.ECHO");
        Assert.All(hints, hint => Assert.Equal("pn-tire", hint.PhoneNumberId));
        Assert.All(hints, hint => Assert.Equal("waba-1", hint.WabaId));

        var serialized = string.Join('|', hints.Select(hint => $"{hint.EventType}:{hint.MessageId}:{hint.SenderMasked}:{hint.MessageType}"));
        Assert.DoesNotContain("GIZLI-METIN-1210", serialized, StringComparison.Ordinal);
        Assert.DoesNotContain("GIZLI-ECHO", serialized, StringComparison.Ordinal);
        Assert.DoesNotContain("905453566544", serialized, StringComparison.Ordinal);
    }
}

using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Domain.Entities;
using CityCommunicationCenter.Domain.Enums;
using CityCommunicationCenter.Infrastructure.Services;

namespace CityCommunicationCenter.Application.Tests.Domain;

public sealed class SmsOutboundLogWriterTests
{
    [Fact]
    public void Map_truncates_body_preview_and_sets_fields()
    {
        var longText = new string('x', 600);
        var entry = new SmsOutboundLogEntry(
            Guid.NewGuid(),
            new SmsSendContext(
                SmsOutboundKind.CitizenStatus,
                JobId: Guid.NewGuid(),
                SocialMessageId: Guid.NewGuid(),
                RequestNumber: "VT-2026-42"),
            "905551234****",
            longText,
            Success: true,
            Provider: "Asistel",
            ProviderCode: "100",
            ProviderMessage: "OK");

        var entity = SmsOutboundLogWriter.Map(entry);

        Assert.Equal(SmsOutboundKind.CitizenStatus, entity.Kind);
        Assert.Equal(entry.TenantId, entity.TenantId);
        Assert.Equal("905551234****", entity.RecipientPhoneMasked);
        Assert.Equal("VT-2026-42", entity.RequestNumber);
        Assert.Equal(600, entity.TextLength);
        Assert.Equal(500, entity.BodyPreview!.Length);
        Assert.True(entity.Success);
        Assert.Equal("Asistel", entity.Provider);
    }
}

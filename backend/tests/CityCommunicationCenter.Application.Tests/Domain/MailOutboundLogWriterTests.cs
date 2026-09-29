using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Domain.Enums;
using CityCommunicationCenter.Infrastructure.Services;

namespace CityCommunicationCenter.Application.Tests.Domain;

public sealed class MailOutboundLogWriterTests
{
    [Fact]
    public void Map_truncates_body_preview_and_sets_fields()
    {
        var longText = new string('x', 600);
        var entry = new MailOutboundLogEntry(
            Guid.NewGuid(),
            new MailSendContext(
                MailOutboundKind.Incoming,
                JobId: Guid.NewGuid(),
                RecipientUserId: Guid.NewGuid(),
                RequestNumber: "VT-2026-42"),
            "mudur@example.com",
            "Konu {TalepNo}",
            longText,
            Success: false,
            ErrorMessage: "SMTP sunucusuna bağlanılamadı.");

        var entity = MailOutboundLogWriter.Map(entry);

        Assert.Equal(MailOutboundKind.Incoming, entity.Kind);
        Assert.Equal(entry.TenantId, entity.TenantId);
        Assert.Equal("mudur@example.com", entity.RecipientEmail);
        Assert.Equal("VT-2026-42", entity.RequestNumber);
        Assert.Equal(600, entity.TextLength);
        Assert.Equal(500, entity.BodyPreview!.Length);
        Assert.False(entity.Success);
        Assert.Equal("SMTP sunucusuna bağlanılamadı.", entity.ErrorMessage);
    }
}

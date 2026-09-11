using CityCommunicationCenter.Application.Features.Social;
using CityCommunicationCenter.Domain.Entities;
using CityCommunicationCenter.Domain.Enums;
using CityCommunicationCenter.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CityCommunicationCenter.Application.Tests.Features.Social;

public sealed class CitizenWhatsAppDeliveryTargetTests
{
    private static readonly Guid TenantId = Guid.Parse("b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e");
    private static readonly Guid ConversationId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static readonly Guid WhatsAppMessageId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private static readonly Guid PhoneMessageId = Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc");

    [Fact]
    public async Task Resolve_PhoneJob_WithUnansweredWhatsApp_UsesWhatsAppThread()
    {
        await using var db = CreateDbContext();
        await SeedAsync(db, lastWhatsAppDirection: ConversationEntryDirection.Inbound);
        var phone = await db.SocialMessages.SingleAsync(m => m.SocialMessageId == PhoneMessageId);

        var delivery = await CitizenWhatsAppDeliveryTarget.ResolveDeliveryMessageAsync(
            db, TenantId, phone, CancellationToken.None);

        Assert.Equal(WhatsAppMessageId, delivery.SocialMessageId);
        Assert.Equal(SocialChannel.WhatsApp, delivery.Channel);
    }

    [Fact]
    public async Task Resolve_PhoneJob_AfterWhatsAppReply_KeepsPhone()
    {
        await using var db = CreateDbContext();
        await SeedAsync(db, lastWhatsAppDirection: ConversationEntryDirection.Outbound);
        var phone = await db.SocialMessages.SingleAsync(m => m.SocialMessageId == PhoneMessageId);

        var delivery = await CitizenWhatsAppDeliveryTarget.ResolveDeliveryMessageAsync(
            db, TenantId, phone, CancellationToken.None);

        Assert.Equal(PhoneMessageId, delivery.SocialMessageId);
        Assert.Equal(SocialChannel.Phone, delivery.Channel);
    }

    [Fact]
    public async Task Resolve_WhatsAppSource_StaysOnWhatsApp()
    {
        await using var db = CreateDbContext();
        await SeedAsync(db, lastWhatsAppDirection: ConversationEntryDirection.Inbound);
        var whatsapp = await db.SocialMessages.SingleAsync(m => m.SocialMessageId == WhatsAppMessageId);

        var delivery = await CitizenWhatsAppDeliveryTarget.ResolveDeliveryMessageAsync(
            db, TenantId, whatsapp, CancellationToken.None);

        Assert.Equal(WhatsAppMessageId, delivery.SocialMessageId);
    }

    private static async Task SeedAsync(
        CityCommunicationCenterDbContext db,
        ConversationEntryDirection lastWhatsAppDirection)
    {
        db.Tenants.Add(new Tenant
        {
            TenantId = TenantId,
            MunicipalityName = "Test",
            DisplayName = "Test",
            IsActive = true,
        });
        db.CitizenConversations.Add(new CitizenConversation
        {
            CitizenConversationId = ConversationId,
            TenantId = TenantId,
            CitizenPhone = "905422961615",
            CitizenName = "Gizem Kabalar",
            LastMessageAt = DateTimeOffset.UtcNow,
        });
        db.SocialMessages.Add(new SocialMessage
        {
            SocialMessageId = WhatsAppMessageId,
            TenantId = TenantId,
            Channel = SocialChannel.WhatsApp,
            ExternalMessageId = "wa-1",
            CitizenHandle = "905422961615",
            Content = "WhatsApp inbound",
            CitizenConversationId = ConversationId,
            ReceivedAtUtc = DateTimeOffset.UtcNow.AddMinutes(-10),
        });
        db.SocialMessages.Add(new SocialMessage
        {
            SocialMessageId = PhoneMessageId,
            TenantId = TenantId,
            Channel = SocialChannel.Phone,
            ExternalMessageId = "phone-1",
            CitizenHandle = "905422961615",
            Content = "Call request",
            CitizenConversationId = ConversationId,
            ReceivedAtUtc = DateTimeOffset.UtcNow,
        });
        db.ConversationEntries.Add(new SocialConversationEntry
        {
            EntryId = Guid.NewGuid(),
            SocialMessageId = WhatsAppMessageId,
            Direction = ConversationEntryDirection.Inbound,
            Content = "İyi günler yaklaşık 1 buçuk saat önce",
            SentAt = DateTimeOffset.UtcNow.AddMinutes(-8),
        });
        if (lastWhatsAppDirection == ConversationEntryDirection.Outbound)
        {
            db.ConversationEntries.Add(new SocialConversationEntry
            {
                EntryId = Guid.NewGuid(),
                SocialMessageId = WhatsAppMessageId,
                Direction = ConversationEntryDirection.Outbound,
                Content = "WhatsApp yanıt",
                SentAt = DateTimeOffset.UtcNow.AddMinutes(-1),
            });
        }

        await db.SaveChangesAsync();
    }

    private static CityCommunicationCenterDbContext CreateDbContext() => new(
        new DbContextOptionsBuilder<CityCommunicationCenterDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);
}

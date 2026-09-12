using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Application.Features.Social;
using CityCommunicationCenter.Domain.Entities;
using CityCommunicationCenter.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CityCommunicationCenter.Application.Tests.Features.Social;

public sealed class UpdateCitizenConversationProfileCommandTests
{
    private static readonly Guid TenantId = Guid.Parse("b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e");
    private static readonly Guid ConversationId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");

    [Fact]
    public async Task Handle_LabelOnly_DoesNotClearSavedNameOrAddress()
    {
        await using var db = CreateDbContext();
        await SeedAsync(db);
        var handler = new UpdateCitizenConversationProfileCommandHandler(
            db,
            new TestTenantContextAccessor(new TenantContext(TenantId, null, null, null, true, "claims", null, true)));

        var updated = await handler.Handle(
            new UpdateCitizenConversationProfileCommand(
                ConversationId,
                CitizenName: null,
                CitizenPhone: null,
                Label: "Yeni Etiket",
                Neighborhood: null,
                Street: null,
                StreetNo: null,
                OpenAddress: null),
            CancellationToken.None);

        Assert.True(updated);
        var conversation = await db.CitizenConversations.SingleAsync();
        Assert.Equal("Gizem Kabalar", conversation.CitizenName);
        Assert.Equal("Yeni Etiket", conversation.Label);
        Assert.Equal("Atatürk Mahallesi", conversation.Neighborhood);
        Assert.Equal("İnönü Caddesi", conversation.Street);
        Assert.Equal("12", conversation.StreetNo);
        Assert.Equal("Kat 1", conversation.OpenAddress);
    }

    [Fact]
    public async Task Handle_EmptyStringsWithoutAllowClear_KeepSavedProfile()
    {
        await using var db = CreateDbContext();
        await SeedAsync(db);
        var handler = new UpdateCitizenConversationProfileCommandHandler(
            db,
            new TestTenantContextAccessor(new TenantContext(TenantId, null, null, null, true, "claims", null, true)));

        var updated = await handler.Handle(
            new UpdateCitizenConversationProfileCommand(
                ConversationId,
                CitizenName: "",
                CitizenPhone: null,
                Label: "",
                Neighborhood: "",
                Street: "",
                StreetNo: "",
                OpenAddress: "",
                AllowClear: false),
            CancellationToken.None);

        Assert.True(updated);
        var conversation = await db.CitizenConversations.SingleAsync();
        Assert.Equal("Gizem Kabalar", conversation.CitizenName);
        Assert.Equal("Eski Etiket", conversation.Label);
        Assert.Equal("Atatürk Mahallesi", conversation.Neighborhood);
        Assert.Equal("İnönü Caddesi", conversation.Street);
        Assert.Equal("12", conversation.StreetNo);
        Assert.Equal("Kat 1", conversation.OpenAddress);
    }

    [Fact]
    public async Task Handle_EmptyStringsWithAllowClear_ClearsProfileFields()
    {
        await using var db = CreateDbContext();
        await SeedAsync(db);
        var handler = new UpdateCitizenConversationProfileCommandHandler(
            db,
            new TestTenantContextAccessor(new TenantContext(TenantId, null, null, null, true, "claims", null, true)));

        var updated = await handler.Handle(
            new UpdateCitizenConversationProfileCommand(
                ConversationId,
                CitizenName: "",
                CitizenPhone: null,
                Label: "",
                Neighborhood: "",
                Street: "",
                StreetNo: "",
                OpenAddress: "",
                AllowClear: true),
            CancellationToken.None);

        Assert.True(updated);
        var conversation = await db.CitizenConversations.SingleAsync();
        Assert.Null(conversation.CitizenName);
        Assert.Null(conversation.Label);
        Assert.Null(conversation.Neighborhood);
        Assert.Null(conversation.Street);
        Assert.Null(conversation.StreetNo);
        Assert.Null(conversation.OpenAddress);
    }

    [Fact]
    public async Task Handle_UpdatesOnlyTheRequestedConversationAddress()
    {
        await using var db = CreateDbContext();
        await SeedAsync(db);
        var otherId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
        db.CitizenConversations.Add(new CitizenConversation
        {
            CitizenConversationId = otherId,
            TenantId = TenantId,
            CitizenPhone = "905551112233",
            CitizenName = "Diğer Vatandaş",
            Neighborhood = "Ergene Mahallesi",
            Street = "İstiklal Caddesi",
            StreetNo = "5",
            OpenAddress = "Kat 2",
            LastMessageAt = DateTimeOffset.UtcNow,
            UnreadCount = 0,
        });
        await db.SaveChangesAsync();

        var handler = new UpdateCitizenConversationProfileCommandHandler(
            db,
            new TestTenantContextAccessor(new TenantContext(TenantId, null, null, null, true, "claims", null, true)));

        var updated = await handler.Handle(
            new UpdateCitizenConversationProfileCommand(
                ConversationId,
                CitizenName: null,
                CitizenPhone: null,
                Label: null,
                Neighborhood: "Yeni Mahalle",
                Street: "Yeni Cadde",
                StreetNo: "99",
                OpenAddress: "Kat 3",
                AllowClear: true),
            CancellationToken.None);

        Assert.True(updated);
        var target = await db.CitizenConversations.SingleAsync(c => c.CitizenConversationId == ConversationId);
        var other = await db.CitizenConversations.SingleAsync(c => c.CitizenConversationId == otherId);
        Assert.Equal("Yeni Mahalle", target.Neighborhood);
        Assert.Equal("Yeni Cadde", target.Street);
        Assert.Equal("99", target.StreetNo);
        Assert.Equal("Kat 3", target.OpenAddress);
        Assert.Equal("Ergene Mahallesi", other.Neighborhood);
        Assert.Equal("İstiklal Caddesi", other.Street);
        Assert.Equal("5", other.StreetNo);
        Assert.Equal("Kat 2", other.OpenAddress);
    }

    private static async Task SeedAsync(CityCommunicationCenterDbContext db)
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
            Label = "Eski Etiket",
            Neighborhood = "Atatürk Mahallesi",
            Street = "İnönü Caddesi",
            StreetNo = "12",
            OpenAddress = "Kat 1",
            LastMessageAt = DateTimeOffset.UtcNow,
            UnreadCount = 0,
        });
        await db.SaveChangesAsync();
    }

    private static CityCommunicationCenterDbContext CreateDbContext() => new(
        new DbContextOptionsBuilder<CityCommunicationCenterDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private sealed class TestTenantContextAccessor(TenantContext context) : ITenantContextAccessor
    {
        public TenantContext GetCurrent() => context;
    }
}

using System.Text.Json;
using CityCommunicationCenter.Domain.Entities;
using CityCommunicationCenter.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CityCommunicationCenter.Api.Services;

internal sealed class WhatsAppTemplateSeeder
{
    private readonly CityCommunicationCenterDbContext _dbContext;

    public WhatsAppTemplateSeeder(CityCommunicationCenterDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task SeedAsync(CancellationToken cancellationToken = default)
    {
        var tenantIds = await _dbContext.Tenants
            .AsNoTracking()
            .Where(tenant => tenant.IsActive)
            .Select(tenant => tenant.TenantId)
            .ToListAsync(cancellationToken);

        if (tenantIds.Count == 0)
        {
            return;
        }

        var hasChanges = false;

        foreach (var tenantId in tenantIds)
        {
            var existingNames = await _dbContext.WhatsAppTemplates
                .AsNoTracking()
                .Where(template => template.TenantId == tenantId)
                .Select(template => template.Name)
                .ToListAsync(cancellationToken);

            var existingNameSet = existingNames.ToHashSet(StringComparer.Ordinal);

            foreach (var seed in DefaultTemplates)
            {
                if (existingNameSet.Contains(seed.Name))
                {
                    continue;
                }

                _dbContext.WhatsAppTemplates.Add(new WhatsAppMessageTemplate
                {
                    TemplateId = Guid.NewGuid(),
                    TenantId = tenantId,
                    Name = seed.Name,
                    Content = seed.Content,
                    IsActive = seed.IsActive,
                    Channel = seed.Channel,
                    IsGeneral = seed.IsGeneral,
                    AutoReply = seed.AutoReply,
                    ReplyDelaySecs = seed.ReplyDelaySecs,
                    HasKeyword = seed.HasKeyword,
                    QueryType = seed.QueryType,
                    KeywordsJson = JsonSerializer.Serialize(seed.Keywords),
                    CreatedByUserId = InitialData.AdminUserId,
                    CreatedAtUtc = DateTimeOffset.UtcNow,
                });
                hasChanges = true;
            }
        }

        if (!hasChanges)
        {
            return;
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    private sealed record SeedTemplate(
        string Name,
        string Content,
        string Channel,
        bool IsActive,
        bool IsGeneral,
        bool AutoReply,
        int ReplyDelaySecs,
        bool HasKeyword,
        string QueryType,
        string[] Keywords);

    private static readonly SeedTemplate[] DefaultTemplates =
    [
        new(
            "KVKK Hoşgeldiniz",
            "Tire Belediyesi İletişim Merkezine hoşgeldiniz. Tire Belediyesi olarak kişisel verilerinizi önemsiyoruz. KVKK bilgilendirmesi için \"https://tire.bel.tr/tr/Kurumsal/AydinlatmaMetni\" linkine tıklayarak KVKK Aydınlatma Metnine ulaşabilirsiniz. İstek, talep ve şikâyetlerinizin kayıt altına alınabilmesi için Ad, Soyad, Telefon ve adres bilgilerinizi yazabilir misiniz?",
            "Genel",
            true,
            true,
            false,
            30,
            false,
            "(LIKE) İçerikte Geçsin",
            []),
        new(
            "Eksik Bilgi",
            "Değerli hemşehrimiz, taleplerinizde adınız soyadınız telefon numaranız talebinizin bulunduğu açık adresi ile birlikte talebinizi belirtmeniz gerektiğini lütfen unutmayınız. Eksik bilgi nedeniyle talebiniz oluşturulamamış olup, lütfen yeniden talep oluşturunuz.",
            "Genel",
            true,
            false,
            false,
            30,
            false,
            "(LIKE) İçerikte Geçsin",
            []),
        new(
            "Talep İletildi",
            "Merhaba, talebiniz ilgili Birime iletilmiştir. İlginize teşekkür eder. İyi günler dileriz.",
            "Genel",
            true,
            false,
            false,
            30,
            false,
            "(LIKE) İçerikte Geçsin",
            []),
        new(
            "Mesai Saati",
            "Tire Belediyesi İletişim Merkezi'ne hoş geldiniz. İletişim Merkezi, hafta içi her gün 08:30 - 17:30 saatleri arasında hizmet vermektedir. Acil durumlar için 444 35 03 numaramızı arayarak talebinizi bize 7/24 iletebilirsiniz. İyi günler dileriz.",
            "Genel",
            true,
            false,
            true,
            30,
            true,
            "(LIKE) İçerikte Geçsin",
            ["mesai", "çalışma saati", "saat"]),
        new(
            "Nöbetçi Eczane",
            "Merhaba, nöbetçi eczane listesine https://tire.bel.tr/tr/HizmetRehberi/NobetciEczaneler linkinden ulaşabilirsiniz. Geçmiş olsun dileklerimizi iletir, iyi günler dileriz.",
            "Genel",
            true,
            false,
            true,
            30,
            true,
            "(LIKE) İçerikte Geçsin",
            ["eczane", "nöbetçi eczane"]),
        new(
            "Toptepe Rezervasyon",
            "Merhabalar mesajınız için teşekkür ederiz. Toptepe Aile Restoranımızın bilgi alma ve rezervasyon numarası: 0232 270 1261. Bizimle iletişime geçtiğiniz için teşekkür ederiz. Tekrar görüşmek dileğiyle.",
            "WhatsApp",
            true,
            false,
            true,
            30,
            true,
            "(LIKE) İçerikte Geçsin",
            ["toptepe aile restaurant", "Toptepe Aile Gazinosu", "toptepe restoran", "toptepe restorant"]),
        new(
            "Gölet Restoran",
            "Merhabalar mesajınız için teşekkür ederiz. Gölet Restoran'ımızın bilgi alma ve rezervasyon numarası: 0232 270 1260. Bizimle iletişime geçtiğiniz için teşekkür ederiz. Tekrar görüşmek dileğiyle.",
            "WhatsApp",
            true,
            false,
            true,
            30,
            true,
            "(LIKE) İçerikte Geçsin",
            ["gölet restoran", "gölet"]),
        new(
            "Derekahve Kafe",
            "Merhabalar mesajınız için teşekkür ederiz. Derekahve Kafe için bilgi alma ve rezervasyon numarası: 0232 270 1262. Bizimle iletişime geçtiğiniz için teşekkür ederiz. Tekrar görüşmek dileğiyle.",
            "WhatsApp",
            true,
            false,
            true,
            30,
            true,
            "(LIKE) İçerikte Geçsin",
            ["derekahve", "dere kahve", "kafe"]),
        new(
            "Acil İletişim",
            "Tire Belediyesi İletişim Merkezi'ne hoş geldiniz. İletişim Merkezi, hafta içi her gün 08:30 - 17:30 saatleri arasında hizmet vermektedir. Acil durumlar için 444 35 03 numaramızı arayarak talebinizi bize 7/24 iletebilirsiniz. İyi günler dileriz.",
            "Genel",
            true,
            false,
            false,
            30,
            false,
            "(LIKE) İçerikte Geçsin",
            []),
    ];
}

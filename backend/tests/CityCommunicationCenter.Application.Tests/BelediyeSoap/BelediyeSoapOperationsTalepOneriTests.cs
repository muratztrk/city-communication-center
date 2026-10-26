using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Application.Abstractions.BelediyeSoap;
using CityCommunicationCenter.Application.Abstractions.SocialMedia;
using CityCommunicationCenter.Domain.Entities;
using CityCommunicationCenter.Domain.Enums;
using CityCommunicationCenter.Infrastructure.BelediyeSoap;
using CityCommunicationCenter.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;

namespace CityCommunicationCenter.Application.Tests.BelediyeSoap;

public sealed class BelediyeSoapOperationsTalepOneriTests : IDisposable
{
    private static readonly Guid TenantId = Guid.Parse("b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e");
    private const string Tc = "10000000146";

    private readonly string _contentRoot = Path.Combine(Path.GetTempPath(), "ccc-soap-" + Guid.NewGuid().ToString("N"));

    public void Dispose()
    {
        if (Directory.Exists(_contentRoot))
        {
            Directory.Delete(_contentRoot, recursive: true);
        }
    }

    [Fact]
    public async Task AyarOku_TalepOneriKey_ReturnsDefaultJson_AndConfiguredJsonWhenSet()
    {
        var (operations, _) = await CreateAsync(talepOneriAyarlari: null);
        var defaults = await operations.AyarOkuAsync(TenantId, "taleponeriozellestirmeparametreleri", default);
        Assert.True(defaults.IsSuccess);
        Assert.Equal(TalepOneriOptions.Default.ToJson(), defaults.Data);

        var (configured, _) = await CreateAsync(talepOneriAyarlari: """{"notEklenebilirmi":1,"basvuruDosyaSayisi":2}""");
        var json = (await configured.AyarOkuAsync(TenantId, TalepOneriOptions.AyarAdi, default)).Data;
        Assert.Contains("\"notEklenebilirmi\":1", json);
        Assert.Contains("\"basvuruDosyaSayisi\":2", json);

        var liste = await configured.AyarOkuListeAsync(TenantId, TalepOneriOptions.AyarAdi, default);
        Assert.Single(liste.Data!);
    }

    [Fact]
    public async Task BasvuruYap_ResolvesMahalleAndSokakCodesToNames()
    {
        var (operations, db) = await CreateAsync();
        db.Jobs.Add(NewJob("Cumhuriyet Mahallesi", "Gül Sokak"));
        db.Jobs.Add(NewJob("Zafer Mahallesi", "Lale Sokak"));
        await db.SaveChangesAsync();

        var mahalleler = (await operations.MahalleSorgulaAsync(TenantId, "1", default)).Data!.MahalleListesi;
        var sokaklar = (await operations.SokakCaddeSorgulaAsync(TenantId, "1", "x", default)).Data!.SokakCaddeListesi;
        var zafer = mahalleler.Single(item => item.MahalleAdi == "Zafer Mahallesi");
        var gul = sokaklar.Single(item => item.SokakCaddeAdi == "Gül Sokak");

        var result = await operations.BasvuruYapAsync(
            TenantId,
            NewRequest(mahalleKodu: zafer.MahalleKodu, sokakKodu: gul.SokakCaddeKodu),
            default);

        Assert.True(result.IsSuccess);
        var saved = await db.EDevletBasvurular.IgnoreQueryFilters().SingleAsync();
        Assert.Equal("Zafer Mahallesi", saved.MahalleAdi);
        Assert.Equal(zafer.MahalleKodu, saved.MahalleKodu);
        Assert.Equal("Gül Sokak", saved.SokakCaddeAdi);
    }

    [Fact]
    public async Task BasvuruYap_LegacyNumericCode_IsRejectedInsteadOfSavedWithoutAddress()
    {
        var (operations, db) = await CreateAsync();

        var mahalle = await operations.BasvuruYapAsync(TenantId, NewRequest(mahalleKodu: "3"), default);
        Assert.False(mahalle.IsSuccess);
        Assert.Equal(BelediyeSoapResultCodes.ValidationFailed, mahalle.SonucKodu);
        Assert.Equal("GECERSIZ MAHALLE KODU", mahalle.SonucAciklamasi);

        var sokak = await operations.BasvuruYapAsync(TenantId, NewRequest(sokakKodu: "7"), default);
        Assert.False(sokak.IsSuccess);
        Assert.Equal("GECERSIZ SOKAK/CADDE KODU", sokak.SonucAciklamasi);

        Assert.Empty(await db.EDevletBasvurular.IgnoreQueryFilters().ToListAsync());
    }

    [Fact]
    public async Task BasvuruYap_CodeOfRemovedName_IsRejected()
    {
        var (operations, db) = await CreateAsync();
        var job = NewJob("Zafer Mahallesi", "Lale Sokak");
        db.Jobs.Add(job);
        await db.SaveChangesAsync();
        var zafer = (await operations.MahalleSorgulaAsync(TenantId, "1", default)).Data!.MahalleListesi.Single();

        db.Jobs.Remove(job);
        await db.SaveChangesAsync();

        var result = await operations.BasvuruYapAsync(TenantId, NewRequest(mahalleKodu: zafer.MahalleKodu), default);
        Assert.False(result.IsSuccess);
        Assert.Equal("GECERSIZ MAHALLE KODU", result.SonucAciklamasi);
    }

    [Fact]
    public async Task MahalleSorgula_ListsMoreThan500Names_AndLastOneStillResolves()
    {
        var (operations, db) = await CreateAsync();
        for (var i = 0; i < 520; i++)
        {
            db.Jobs.Add(NewJob($"Mahalle {i:D3}", $"Sokak {i:D3}"));
        }

        await db.SaveChangesAsync();

        var mahalleler = (await operations.MahalleSorgulaAsync(TenantId, "1", default)).Data!.MahalleListesi;
        var sokaklar = (await operations.SokakCaddeSorgulaAsync(TenantId, "1", "x", default)).Data!.SokakCaddeListesi;
        Assert.Equal(520, mahalleler.Count);
        Assert.Equal(520, sokaklar.Count);

        var last = mahalleler.Single(item => item.MahalleAdi == "Mahalle 519");
        var lastSokak = sokaklar.Single(item => item.SokakCaddeAdi == "Sokak 519");
        Assert.True((await operations.BasvuruYapAsync(
            TenantId, NewRequest(mahalleKodu: last.MahalleKodu, sokakKodu: lastSokak.SokakCaddeKodu), default)).IsSuccess);

        var saved = await db.EDevletBasvurular.IgnoreQueryFilters().SingleAsync();
        Assert.Equal("Mahalle 519", saved.MahalleAdi);
        Assert.Equal("Sokak 519", saved.SokakCaddeAdi);
    }

    [Fact]
    public async Task MahalleSorgula_SkipsNumericNamesLeftByTheOldBug()
    {
        var (operations, db) = await CreateAsync();
        db.Jobs.Add(NewJob("3", "7"));
        db.Jobs.Add(NewJob("Cumhuriyet Mahallesi", "Gül Sokak"));
        await db.SaveChangesAsync();

        var mahalleler = (await operations.MahalleSorgulaAsync(TenantId, "1", default)).Data!.MahalleListesi;

        Assert.Equal(["Cumhuriyet Mahallesi"], mahalleler.Select(item => item.MahalleAdi));
    }

    [Fact]
    public async Task BasvuruYap_FilesRejectedWhileUploadIsClosed_AndCheckedAgainstConfiguration()
    {
        var file = new BelediyeSoapBasvuruDosyaItem("Foto", "pdf", null, null, new byte[2048]);

        var (closed, _) = await CreateAsync();
        var rejected = await closed.BasvuruYapAsync(TenantId, NewRequest(files: [file]), default);
        Assert.False(rejected.IsSuccess);
        Assert.Equal(BelediyeSoapResultCodes.ValidationFailed, rejected.SonucKodu);

        var (open, db) = await CreateAsync("""{"basvuruDosyaSayisi":1,"dosyaUzanti":"PDF","dosyaBoyut":4}""");
        Assert.True((await open.BasvuruYapAsync(TenantId, NewRequest(files: [file]), default)).IsSuccess);
        Assert.Single((await db.EDevletBasvurular.IgnoreQueryFilters().Include(x => x.Attachments).SingleAsync()).Attachments);

        var wrongExtension = file with { DosyaUzanti = "exe" };
        Assert.False((await open.BasvuruYapAsync(TenantId, NewRequest(files: [wrongExtension]), default)).IsSuccess);

        var tooBig = file with { Dosya = new byte[5 * 1024] };
        Assert.False((await open.BasvuruYapAsync(TenantId, NewRequest(files: [tooBig]), default)).IsSuccess);

        Assert.False((await open.BasvuruYapAsync(TenantId, NewRequest(files: [file, file]), default)).IsSuccess);
    }

    [Theory]
    [InlineData("EPOSTA", true)]
    [InlineData("sms", true)]
    [InlineData("E-POSTA,EDEVLET", false)]
    public async Task BasvuruYap_ValidatesCevapSekliAgainstCevapTuru(string cevapSekli, bool expected)
    {
        var (operations, _) = await CreateAsync();

        var result = await operations.BasvuruYapAsync(TenantId, NewRequest(cevapSekli: cevapSekli), default);

        Assert.Equal(expected, result.IsSuccess);
    }

    [Fact]
    public async Task NotEkle_DisabledByDefault_ThenStoresNoteAndListsItInDetail()
    {
        var (disabled, _) = await CreateAsync();
        var takipNo = (await disabled.BasvuruYapAsync(TenantId, NewRequest(), default)).Data!.BasvuruTakipNo;
        Assert.False((await disabled.BasvuruNotEkleAsync(TenantId, Tc, takipNo, "not", default)).IsSuccess);

        var (enabled, _) = await CreateAsync("""{"notEklenebilirmi":1}""");
        takipNo = (await enabled.BasvuruYapAsync(TenantId, NewRequest(), default)).Data!.BasvuruTakipNo;

        Assert.True((await enabled.BasvuruNotEkleAsync(TenantId, Tc, takipNo, "  ek bilgi  ", default)).IsSuccess);
        Assert.False((await enabled.BasvuruNotEkleAsync(TenantId, Tc, takipNo, "   ", default)).IsSuccess);
        Assert.False((await enabled.BasvuruNotEkleAsync(TenantId, Tc, takipNo, new string('x', 1001), default)).IsSuccess);
        Assert.Equal(
            BelediyeSoapResultCodes.NotFound,
            (await enabled.BasvuruNotEkleAsync(TenantId, "99999999999", takipNo, "not", default)).SonucKodu);

        var detay = (await enabled.BasvuruDetaySorgulaAsync(TenantId, Tc, takipNo, default)).Data!;
        var note = Assert.Single(detay.BasvuruNotListesi);
        Assert.Equal("ek bilgi", note.NotMetin);
        Assert.Equal(1, note.NotSiraNumarasi);
    }

    [Fact]
    public async Task TekrarAc_OnlyWhenEnabledAndClosed_ReturnsRejectedToPendingReview()
    {
        var (disabled, _) = await CreateAsync();
        var disabledNo = (await disabled.BasvuruYapAsync(TenantId, NewRequest(), default)).Data!.BasvuruTakipNo;
        Assert.False((await disabled.BasvuruyuTekrarAcAsync(TenantId, Tc, disabledNo, "neden", default)).IsSuccess);

        var (enabled, db) = await CreateAsync("""{"basvuruTekrarAcilabilirmi":1}""");
        var takipNo = (await enabled.BasvuruYapAsync(TenantId, NewRequest(), default)).Data!.BasvuruTakipNo;

        // Henuz sonuclanmadi (BASVURU ALINDI).
        Assert.False((await enabled.BasvuruyuTekrarAcAsync(TenantId, Tc, takipNo, "neden", default)).IsSuccess);

        var basvuru = await db.EDevletBasvurular.IgnoreQueryFilters().SingleAsync();
        basvuru.Status = EDevletBasvuruStatus.Rejected;
        await db.SaveChangesAsync();

        Assert.False((await enabled.BasvuruyuTekrarAcAsync(TenantId, Tc, takipNo, " ", default)).IsSuccess);
        Assert.True((await enabled.BasvuruyuTekrarAcAsync(TenantId, Tc, takipNo, "yeni bilgi var", default)).IsSuccess);

        basvuru = await db.EDevletBasvurular.IgnoreQueryFilters().SingleAsync();
        Assert.Equal(EDevletBasvuruStatus.PendingReview, basvuru.Status);
        Assert.NotNull(basvuru.ReopenedAtUtc);
        var note = Assert.Single(basvuru.GetCitizenNotes());
        Assert.Equal(EDevletBasvuruNote.KindReopen, note.Kind);
        Assert.Equal("yeni bilgi var", note.Text);

        // Tekrar acildiktan sonra sonuclanmadigi icin yeniden acilamaz.
        Assert.False((await enabled.BasvuruyuTekrarAcAsync(TenantId, Tc, takipNo, "yine", default)).IsSuccess);
    }

    [Fact]
    public async Task NotEkle_And_TekrarAc_NotifyActiveOperators()
    {
        var push = new FakePushService();
        var (operations, db) = await CreateAsync("""{"notEklenebilirmi":1,"basvuruTekrarAcilabilirmi":1}""", push);
        var operatorId = AddUser(db, RoleCode.Operator);
        var additionalOperatorId = AddUser(db, RoleCode.Staff, additionalRoles: """["Operator"]""");
        AddUser(db, RoleCode.Operator, isActive: false);
        AddUser(db, RoleCode.Staff);
        AddUser(db, RoleCode.SystemAdmin);
        await db.SaveChangesAsync();

        var takipNo = (await operations.BasvuruYapAsync(TenantId, NewRequest(), default)).Data!.BasvuruTakipNo;
        Assert.True((await operations.BasvuruNotEkleAsync(TenantId, Tc, takipNo, "ek bilgi", default)).IsSuccess);

        var noteNotifications = await db.Notifications.IgnoreQueryFilters().ToListAsync();
        Assert.Equal(
            new[] { operatorId, additionalOperatorId }.OrderBy(id => id),
            noteNotifications.Select(item => item.UserId).OrderBy(id => id));
        Assert.All(noteNotifications, item =>
        {
            Assert.Equal("e-Devlet başvurusuna not eklendi", item.Title);
            Assert.Contains(takipNo, item.Message);
            Assert.Contains("ek bilgi", item.Message);
            Assert.Equal("/edevlet/basvurular", item.ActionUrl);
        });
        Assert.Equal(2, push.Sent.Count);

        var basvuru = await db.EDevletBasvurular.IgnoreQueryFilters().SingleAsync();
        basvuru.Status = EDevletBasvuruStatus.Rejected;
        await db.SaveChangesAsync();
        Assert.True((await operations.BasvuruyuTekrarAcAsync(TenantId, Tc, takipNo, "yeni bilgi var", default)).IsSuccess);

        var reopenNotifications = await db.Notifications.IgnoreQueryFilters()
            .Where(item => item.Title == "e-Devlet başvurusu tekrar açıldı")
            .ToListAsync();
        Assert.Equal(2, reopenNotifications.Count);
        Assert.Equal(4, push.Sent.Count);
    }

    [Fact]
    public async Task TekrarAc_WithoutOperators_NotifiesSystemAdminsAndJobCreator()
    {
        var (operations, db) = await CreateAsync("""{"basvuruTekrarAcilabilirmi":1}""");
        var adminId = AddUser(db, RoleCode.SystemAdmin);
        var creatorId = AddUser(db, RoleCode.Staff);
        await db.SaveChangesAsync();

        var takipNo = (await operations.BasvuruYapAsync(TenantId, NewRequest(), default)).Data!.BasvuruTakipNo;
        var job = NewJob("Cumhuriyet Mahallesi", "Gül Sokak");
        job.Status = JobStatus.Completed;
        job.CompletedAtUtc = DateTimeOffset.UtcNow.AddDays(-1);
        job.CreatedByUserId = creatorId;
        db.Jobs.Add(job);
        var basvuru = await db.EDevletBasvurular.IgnoreQueryFilters().SingleAsync();
        basvuru.Status = EDevletBasvuruStatus.ConvertedToJob;
        basvuru.JobId = job.JobId;
        await db.SaveChangesAsync();

        Assert.True((await operations.BasvuruyuTekrarAcAsync(TenantId, Tc, takipNo, "sorun devam ediyor", default)).IsSuccess);

        var recipients = await db.Notifications.IgnoreQueryFilters().Select(item => item.UserId).ToListAsync();
        Assert.Equal(new[] { adminId, creatorId }.OrderBy(id => id), recipients.OrderBy(id => id));
    }

    private static Guid AddUser(CityCommunicationCenterDbContext db, RoleCode role, bool isActive = true, string? additionalRoles = null)
    {
        var userId = Guid.NewGuid();
        db.Users.Add(new ApplicationUser
        {
            UserId = userId,
            TenantId = TenantId,
            DepartmentId = Guid.NewGuid(),
            Username = "u" + userId.ToString("N")[..8],
            DisplayName = "Kullanici",
            RoleCode = role,
            AdditionalRoleCodesJson = additionalRoles,
            IsActive = isActive,
        });
        return userId;
    }

    private async Task<(BelediyeSoapOperations Operations, CityCommunicationCenterDbContext Db)> CreateAsync(
        string? talepOneriAyarlari = null,
        INotificationPushService? pushService = null)
    {
        var db = new CityCommunicationCenterDbContext(
            new DbContextOptionsBuilder<CityCommunicationCenterDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options);
        db.TenantSettings.Add(new TenantSetting
        {
            TenantSettingId = Guid.NewGuid(),
            TenantId = TenantId,
            DisplayName = "Test Belediyesi",
            BelediyeKodu = "9999",
        });
        await db.SaveChangesAsync();

        var settings = new FakeSettingsProvider(new EDevletSettings
        {
            BelediyeKodu = "9999",
            SoapKullaniciAdi = "kullanici",
            SoapSifre = "sifre",
            IlceAdi = "Merkez",
            TalepOneriAyarlari = talepOneriAyarlari,
        });

        return (new BelediyeSoapOperations(db, settings, new FakeHostEnvironment(_contentRoot), pushService), db);
    }

    private static Job NewJob(string neighborhood, string street) => new()
    {
        JobId = Guid.NewGuid(),
        TenantId = TenantId,
        Title = "Test",
        Neighborhood = neighborhood,
        Street = street,
    };

    private static BelediyeSoapBasvuruYapRequest NewRequest(
        string? mahalleKodu = null,
        string? sokakKodu = null,
        string? cevapSekli = null,
        IReadOnlyList<BelediyeSoapBasvuruDosyaItem>? files = null)
        => new(
            Tc, "Ayse", "Yilmaz", "1", "Sokak lambasi yanmiyor.", null, [],
            "1", mahalleKodu, sokakKodu, null, null, null, null, null, null,
            cevapSekli, files ?? []);

    private sealed class FakeSettingsProvider(EDevletSettings edevlet) : ISocialMediaSettingsProvider
    {
        public SocialMediaSettings? GetSettings(Guid tenantId) => new() { EDevlet = edevlet };

        public Task SaveSettingsAsync(Guid tenantId, SocialMediaSettings settings, CancellationToken ct = default) => Task.CompletedTask;
    }

    private sealed class FakePushService : INotificationPushService
    {
        public List<(Guid UserId, NotificationPayload Payload)> Sent { get; } = [];

        public Task SendToUserAsync(Guid tenantId, Guid userId, NotificationPayload payload, CancellationToken cancellationToken = default)
        {
            Sent.Add((userId, payload));
            return Task.CompletedTask;
        }

        public Task SendToTenantAsync(Guid tenantId, NotificationPayload payload, CancellationToken cancellationToken = default) => Task.CompletedTask;

        public Task SendWhatsAppMessageToTenantAsync(Guid tenantId, WhatsAppMessagePayload payload, CancellationToken cancellationToken = default) => Task.CompletedTask;

        public Task SendInternalMessageToUserAsync(Guid tenantId, Guid recipientUserId, InternalMessagePayload payload, CancellationToken cancellationToken = default) => Task.CompletedTask;

        public Task SendInternalMessageTypingToUserAsync(Guid tenantId, Guid recipientUserId, InternalMessageTypingPayload payload, CancellationToken cancellationToken = default) => Task.CompletedTask;
    }

    private sealed class FakeHostEnvironment(string contentRoot) : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = "Test";

        public string ApplicationName { get; set; } = "Test";

        public string ContentRootPath { get; set; } = contentRoot;

        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}

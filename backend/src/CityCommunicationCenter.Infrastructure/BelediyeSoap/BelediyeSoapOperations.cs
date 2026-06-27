using System.Text.Json;
using CityCommunicationCenter.Application.Abstractions.BelediyeSoap;
using CityCommunicationCenter.Application.Abstractions.SocialMedia;
using CityCommunicationCenter.Domain.Entities;
using CityCommunicationCenter.Domain.Enums;
using Microsoft.Extensions.Hosting;

namespace CityCommunicationCenter.Infrastructure.BelediyeSoap;

public sealed class BelediyeSoapOperations : IBelediyeSoapOperations
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private static readonly TimeZoneInfo TurkeyTimeZone = ResolveTurkeyTimeZone();

    private readonly IApplicationDbContext _dbContext;
    private readonly ISocialMediaSettingsProvider _settingsProvider;
    private readonly string _uploadsRoot;

    public BelediyeSoapOperations(
        IApplicationDbContext dbContext,
        ISocialMediaSettingsProvider settingsProvider,
        IHostEnvironment hostEnvironment)
    {
        _dbContext = dbContext;
        _settingsProvider = settingsProvider;
        _uploadsRoot = Path.Combine(hostEnvironment.ContentRootPath, "uploads");
    }

    public async Task<BelediyeSoapAuthResult> AuthenticateAsync(
        string belediyeKodu,
        string kullaniciAdi,
        string sifre,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(belediyeKodu))
        {
            return new BelediyeSoapAuthResult(false, null, belediyeKodu, BelediyeSoapResultCodes.TenantNotFound, BelediyeSoapResultCodes.TenantNotFoundMessage);
        }

        var tenantSetting = await _dbContext.TenantSettings
            .IgnoreQueryFilters()
            .AsNoTracking()
            .FirstOrDefaultAsync(entity => entity.BelediyeKodu == belediyeKodu.Trim(), cancellationToken);

        if (tenantSetting is null)
        {
            return new BelediyeSoapAuthResult(false, null, belediyeKodu, BelediyeSoapResultCodes.TenantNotFound, BelediyeSoapResultCodes.TenantNotFoundMessage);
        }

        var settings = _settingsProvider.GetSettings(tenantSetting.TenantId)?.EDevlet;
        if (settings is null
            || !string.Equals(settings.BelediyeKodu?.Trim(), belediyeKodu.Trim(), StringComparison.Ordinal)
            || !string.Equals(settings.SoapKullaniciAdi?.Trim(), kullaniciAdi.Trim(), StringComparison.Ordinal)
            || !string.Equals(settings.SoapSifre, sifre, StringComparison.Ordinal))
        {
            return new BelediyeSoapAuthResult(false, tenantSetting.TenantId, belediyeKodu, BelediyeSoapResultCodes.AuthFailed, BelediyeSoapResultCodes.AuthFailedMessage);
        }

        return new BelediyeSoapAuthResult(true, tenantSetting.TenantId, belediyeKodu.Trim(), BelediyeSoapResultCodes.Success, BelediyeSoapResultCodes.SuccessMessage);
    }

    public async Task<BelediyeSoapOperationResult<BelediyeSoapGunlukFaaliyetResponse>> GunlukFaaliyetSorgulaAsync(
        Guid tenantId,
        CancellationToken cancellationToken)
    {
        var settings = await RequireSettingsAsync(tenantId, cancellationToken);
        if (settings.Error is not null)
        {
            return BelediyeSoapOperationResult<BelediyeSoapGunlukFaaliyetResponse>.Fail(
                settings.Error.Value.Code,
                settings.Error.Value.Message,
                settings.BelediyeKodu);
        }

        var turkeyNow = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, TurkeyTimeZone);
        var dayStartLocal = turkeyNow.Date;
        var dayEndLocal = dayStartLocal.AddDays(1);
        var dayStartUtc = TimeZoneInfo.ConvertTimeToUtc(dayStartLocal, TurkeyTimeZone);
        var dayEndUtc = TimeZoneInfo.ConvertTimeToUtc(dayEndLocal, TurkeyTimeZone);

        var plans = await _dbContext.EDevletDailyActivityPlans
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Include(plan => plan.ActivityType)
            .Where(plan => plan.TenantId == tenantId
                && plan.Status == EDevletDailyActivityPlanStatus.Active
                && plan.CreatedAtUtc >= dayStartUtc
                && plan.CreatedAtUtc < dayEndUtc)
            .OrderBy(plan => plan.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        var ilce = settings.IlceAdi ?? "Merkez";
        var items = plans.Select(plan => new BelediyeSoapFaaliyetItem(
            plan.ActivityType.Name,
            ilce,
            plan.Neighborhood ?? string.Empty,
            plan.Street ?? string.Empty,
            plan.Description)).ToList();

        return BelediyeSoapOperationResult<BelediyeSoapGunlukFaaliyetResponse>.Success(
            new BelediyeSoapGunlukFaaliyetResponse(items),
            settings.BelediyeKodu!);
    }

    public async Task<BelediyeSoapOperationResult<BelediyeSoapBasvuruTipiResponse>> BasvuruTipiSorgulaAsync(
        Guid tenantId,
        CancellationToken cancellationToken)
    {
        var settings = await RequireSettingsAsync(tenantId, cancellationToken);
        if (settings.Error is not null)
        {
            return BelediyeSoapOperationResult<BelediyeSoapBasvuruTipiResponse>.Fail(
                settings.Error.Value.Code,
                settings.Error.Value.Message,
                settings.BelediyeKodu);
        }

        var items = new List<BelediyeSoapBasvuruTipiItem>
        {
            new("1", "Talep", "Belediyeden talep edilen hizmet veya cozum basvurusu"),
            new("2", "Oneri", "Belediyeye yonelik oneri basvurusu"),
        };

        return BelediyeSoapOperationResult<BelediyeSoapBasvuruTipiResponse>.Success(
            new BelediyeSoapBasvuruTipiResponse(items),
            settings.BelediyeKodu!);
    }

    public async Task<BelediyeSoapOperationResult<BelediyeSoapBasvuruYapResponse>> BasvuruYapAsync(
        Guid tenantId,
        BelediyeSoapBasvuruYapRequest request,
        CancellationToken cancellationToken)
    {
        var settings = await RequireSettingsAsync(tenantId, cancellationToken);
        if (settings.Error is not null)
        {
            return BelediyeSoapOperationResult<BelediyeSoapBasvuruYapResponse>.Fail(
                settings.Error.Value.Code,
                settings.Error.Value.Message,
                settings.BelediyeKodu);
        }

        if (string.IsNullOrWhiteSpace(request.TcKimlikNo) || request.TcKimlikNo.Trim().Length != 11)
        {
            return BelediyeSoapOperationResult<BelediyeSoapBasvuruYapResponse>.Fail(
                BelediyeSoapResultCodes.ValidationFailed,
                "GECERSIZ T.C. KIMLIK NUMARASI",
                settings.BelediyeKodu);
        }

        if (string.IsNullOrWhiteSpace(request.BasvuruDetay))
        {
            return BelediyeSoapOperationResult<BelediyeSoapBasvuruYapResponse>.Fail(
                BelediyeSoapResultCodes.ValidationFailed,
                "BASVURU DETAYI ZORUNLUDUR",
                settings.BelediyeKodu);
        }

        var utcNow = DateTimeOffset.UtcNow;
        var year = utcNow.Year;
        var nextNumber = await _dbContext.EDevletBasvurular
            .IgnoreQueryFilters()
            .Where(entity => entity.TenantId == tenantId && entity.BasvuruNumberYear == year)
            .MaxAsync(entity => (int?)entity.BasvuruNumber, cancellationToken) ?? 0;
        nextNumber += 1;
        var takipNo = FormatTakipNo(year, nextNumber);

        var basvuru = new EDevletBasvuru
        {
            BasvuruId = Guid.NewGuid(),
            TenantId = tenantId,
            TakipNo = takipNo,
            BasvuruNumber = nextNumber,
            BasvuruNumberYear = year,
            CitizenTcKimlikNo = request.TcKimlikNo.Trim(),
            CitizenFirstName = request.Adi.Trim(),
            CitizenLastName = request.Soyadi.Trim(),
            BasvuruTipi = NormalizeBasvuruTipi(request.BasvuruTipi),
            Description = request.BasvuruDetay.Trim(),
            Email = NullIfWhiteSpace(request.Eposta),
            PhoneNumbersJson = request.TelefonListesi.Count > 0
                ? JsonSerializer.Serialize(request.TelefonListesi, JsonOptions)
                : null,
            IlceKodu = NullIfWhiteSpace(request.IlceKodu),
            IlceAdi = settings.IlceAdi,
            MahalleKodu = NullIfWhiteSpace(request.MahalleKodu),
            MahalleAdi = NullIfWhiteSpace(request.MahalleKodu),
            SokakCaddeKodu = NullIfWhiteSpace(request.SokakCaddeKodu),
            SokakCaddeAdi = NullIfWhiteSpace(request.SokakCaddeKodu),
            DisKapiNo = NullIfWhiteSpace(request.DisKapiNo),
            IcKapiNo = NullIfWhiteSpace(request.IcKapiNo),
            OpenAddress = NullIfWhiteSpace(request.BasvuranAcikAdres),
            NviAdresNo = NullIfWhiteSpace(request.BasvuranNviAdresNo),
            Latitude = ParseCoordinate(request.Enlem),
            Longitude = ParseCoordinate(request.Boylam),
            CevapSekli = NullIfWhiteSpace(request.CevapSekli),
            Status = EDevletBasvuruStatus.PendingReview,
            CreatedAtUtc = utcNow,
        };

        _dbContext.EDevletBasvurular.Add(basvuru);
        await SaveBasvuruAttachmentsAsync(basvuru, request.DosyaListesi, cancellationToken);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return BelediyeSoapOperationResult<BelediyeSoapBasvuruYapResponse>.Success(
            new BelediyeSoapBasvuruYapResponse(takipNo),
            settings.BelediyeKodu!);
    }

    public async Task<BelediyeSoapOperationResult<BelediyeSoapBasvuruDurumResponse>> BasvuruDurumSorgulaAsync(
        Guid tenantId,
        string tcKimlikNo,
        CancellationToken cancellationToken)
    {
        var settings = await RequireSettingsAsync(tenantId, cancellationToken);
        if (settings.Error is not null)
        {
            return BelediyeSoapOperationResult<BelediyeSoapBasvuruDurumResponse>.Fail(
                settings.Error.Value.Code,
                settings.Error.Value.Message,
                settings.BelediyeKodu);
        }

        var normalizedTc = tcKimlikNo.Trim();
        var basvurular = await _dbContext.EDevletBasvurular
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Include(entity => entity.Job)
            .Where(entity => entity.TenantId == tenantId && entity.CitizenTcKimlikNo == normalizedTc)
            .OrderByDescending(entity => entity.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        var items = basvurular
            .Select(entity => new BelediyeSoapBasvuruDurumItem(
                entity.CreatedAtUtc,
                entity.TakipNo,
                "e-Devlet Kapisi",
                BelediyeBasvuruStatusMapper.Map(entity),
                entity.Description,
                entity.BasvuruTipi))
            .ToList();

        return BelediyeSoapOperationResult<BelediyeSoapBasvuruDurumResponse>.Success(
            new BelediyeSoapBasvuruDurumResponse(items),
            settings.BelediyeKodu!);
    }

    public async Task<BelediyeSoapOperationResult<BelediyeSoapBasvuruDetayResponse>> BasvuruDetaySorgulaAsync(
        Guid tenantId,
        string tcKimlikNo,
        string basvuruNumarasi,
        CancellationToken cancellationToken)
    {
        var settings = await RequireSettingsAsync(tenantId, cancellationToken);
        if (settings.Error is not null)
        {
            return BelediyeSoapOperationResult<BelediyeSoapBasvuruDetayResponse>.Fail(
                settings.Error.Value.Code,
                settings.Error.Value.Message,
                settings.BelediyeKodu);
        }

        var basvuru = await _dbContext.EDevletBasvurular
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Include(entity => entity.Job)
                .ThenInclude(job => job!.Departments)
            .Include(entity => entity.Job)
                .ThenInclude(job => job!.Tasks)
            .FirstOrDefaultAsync(
                entity => entity.TenantId == tenantId
                    && entity.CitizenTcKimlikNo == tcKimlikNo.Trim()
                    && entity.TakipNo == basvuruNumarasi.Trim(),
                cancellationToken);

        if (basvuru is null)
        {
            return BelediyeSoapOperationResult<BelediyeSoapBasvuruDetayResponse>.Fail(
                BelediyeSoapResultCodes.NotFound,
                BelediyeSoapResultCodes.NotFoundMessage,
                settings.BelediyeKodu);
        }

        var phones = DeserializePhones(basvuru.PhoneNumbersJson)
            .Select(phone => new BelediyeSoapTelefonItem("CEP", phone))
            .ToList();

        var surecListesi = BuildSurecListesi(basvuru);
        var notListesi = BuildNotListesi(basvuru);

        return BelediyeSoapOperationResult<BelediyeSoapBasvuruDetayResponse>.Success(
            new BelediyeSoapBasvuruDetayResponse(
                basvuru.TakipNo,
                basvuru.CreatedAtUtc,
                string.Empty,
                basvuru.BasvuruTipi,
                basvuru.IlceAdi ?? settings.IlceAdi ?? string.Empty,
                basvuru.MahalleAdi ?? string.Empty,
                basvuru.SokakCaddeAdi ?? string.Empty,
                basvuru.DisKapiNo ?? string.Empty,
                basvuru.IcKapiNo ?? string.Empty,
                basvuru.OpenAddress ?? string.Empty,
                basvuru.Email ?? string.Empty,
                phones,
                basvuru.Description,
                basvuru.CevapSekli ?? string.Empty,
                surecListesi,
                BelediyeBasvuruStatusMapper.Map(basvuru),
                basvuru.Job?.CompletedAtUtc,
                basvuru.Job?.Status == JobStatus.Completed ? "Basvurunuz tamamlanmistir." : string.Empty,
                notListesi),
            settings.BelediyeKodu!);
    }

    public async Task<BelediyeSoapOperationResult<string>> AyarOkuAsync(
        Guid tenantId,
        string ayar,
        CancellationToken cancellationToken)
    {
        var settings = await RequireSettingsAsync(tenantId, cancellationToken);
        if (settings.Error is not null)
        {
            return BelediyeSoapOperationResult<string>.Fail(
                settings.Error.Value.Code,
                settings.Error.Value.Message,
                settings.BelediyeKodu);
        }

        var value = ayar.Trim().ToUpperInvariant() switch
        {
            "BILGILENDIRMETEXT" or "BILGILENDIRMETEXTI" or "BILGILENDIRME" => settings.BilgilendirmeMetni
                ?? "Basvurunuz alinmis olup operator onayindan sonra isleme alinacaktir.",
            "CEVAPSEKLI" => "SMS,E-POSTA,EDEVLET",
            _ => string.Empty,
        };

        return BelediyeSoapOperationResult<string>.Success(value, settings.BelediyeKodu!);
    }

    public async Task<BelediyeSoapOperationResult<IReadOnlyList<BelediyeSoapDetailItem>>> AyarOkuListeAsync(
        Guid tenantId,
        string ayar,
        CancellationToken cancellationToken)
    {
        var single = await AyarOkuAsync(tenantId, ayar, cancellationToken);
        if (!single.IsSuccess)
        {
            return BelediyeSoapOperationResult<IReadOnlyList<BelediyeSoapDetailItem>>.Fail(
                single.SonucKodu,
                single.SonucAciklamasi,
                single.BelediyeKodu);
        }

        var items = single.Data!
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(item => new BelediyeSoapDetailItem("deger", item))
            .ToList();

        return BelediyeSoapOperationResult<IReadOnlyList<BelediyeSoapDetailItem>>.Success(items, single.BelediyeKodu!);
    }

    public async Task<BelediyeSoapOperationResult<BelediyeSoapIlceResponse>> IlceSorgulaAsync(
        Guid tenantId,
        CancellationToken cancellationToken)
    {
        var settings = await RequireSettingsAsync(tenantId, cancellationToken);
        if (settings.Error is not null)
        {
            return BelediyeSoapOperationResult<BelediyeSoapIlceResponse>.Fail(
                settings.Error.Value.Code,
                settings.Error.Value.Message,
                settings.BelediyeKodu);
        }

        var ilceAdi = settings.IlceAdi ?? "Merkez";
        var items = new List<BelediyeSoapIlceItem>
        {
            new("1", ilceAdi),
        };

        return BelediyeSoapOperationResult<BelediyeSoapIlceResponse>.Success(
            new BelediyeSoapIlceResponse(items),
            settings.BelediyeKodu!);
    }

    public async Task<BelediyeSoapOperationResult<BelediyeSoapMahalleResponse>> MahalleSorgulaAsync(
        Guid tenantId,
        string ilceKodu,
        CancellationToken cancellationToken)
    {
        var settings = await RequireSettingsAsync(tenantId, cancellationToken);
        if (settings.Error is not null)
        {
            return BelediyeSoapOperationResult<BelediyeSoapMahalleResponse>.Fail(
                settings.Error.Value.Code,
                settings.Error.Value.Message,
                settings.BelediyeKodu);
        }

        var mahalleler = await _dbContext.Jobs
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(job => job.TenantId == tenantId && job.Neighborhood != null && job.Neighborhood != string.Empty)
            .Select(job => job.Neighborhood!)
            .Distinct()
            .OrderBy(name => name)
            .Take(500)
            .ToListAsync(cancellationToken);

        var items = mahalleler
            .Select((name, index) => new BelediyeSoapMahalleItem((index + 1).ToString(), name))
            .ToList();

        return BelediyeSoapOperationResult<BelediyeSoapMahalleResponse>.Success(
            new BelediyeSoapMahalleResponse(items),
            settings.BelediyeKodu!);
    }

    public async Task<BelediyeSoapOperationResult<BelediyeSoapSokakCaddeResponse>> SokakCaddeSorgulaAsync(
        Guid tenantId,
        string ilceKodu,
        string mahalleKodu,
        CancellationToken cancellationToken)
    {
        var settings = await RequireSettingsAsync(tenantId, cancellationToken);
        if (settings.Error is not null)
        {
            return BelediyeSoapOperationResult<BelediyeSoapSokakCaddeResponse>.Fail(
                settings.Error.Value.Code,
                settings.Error.Value.Message,
                settings.BelediyeKodu);
        }

        var streets = await _dbContext.Jobs
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(job => job.TenantId == tenantId && job.Street != null && job.Street != string.Empty)
            .Select(job => job.Street!)
            .Distinct()
            .OrderBy(name => name)
            .Take(500)
            .ToListAsync(cancellationToken);

        var items = streets
            .Select((name, index) => new BelediyeSoapSokakCaddeItem((index + 1).ToString(), name))
            .ToList();

        return BelediyeSoapOperationResult<BelediyeSoapSokakCaddeResponse>.Success(
            new BelediyeSoapSokakCaddeResponse(items),
            settings.BelediyeKodu!);
    }

    private async Task SaveBasvuruAttachmentsAsync(
        EDevletBasvuru basvuru,
        IReadOnlyList<BelediyeSoapBasvuruDosyaItem> files,
        CancellationToken cancellationToken)
    {
        if (files.Count == 0)
        {
            return;
        }

        var directory = Path.Combine(_uploadsRoot, basvuru.TenantId.ToString(), "edevlet-basvuru", basvuru.BasvuruId.ToString());
        Directory.CreateDirectory(directory);

        foreach (var file in files.Take(5))
        {
            if (file.Dosya.Length == 0)
            {
                continue;
            }

            var extension = string.IsNullOrWhiteSpace(file.DosyaUzanti)
                ? "bin"
                : file.DosyaUzanti.Trim('.');
            var storedFileName = $"{Guid.NewGuid():N}.{extension}";
            var fullPath = Path.Combine(directory, storedFileName);
            await File.WriteAllBytesAsync(fullPath, file.Dosya, cancellationToken);

            basvuru.Attachments.Add(new EDevletBasvuruAttachment
            {
                AttachmentId = Guid.NewGuid(),
                TenantId = basvuru.TenantId,
                BasvuruId = basvuru.BasvuruId,
                DosyaCesidi = file.DosyaCesidi,
                DosyaUzanti = extension,
                BelgeTarihi = file.BelgeTarihi,
                BelgeSayisi = file.BelgeSayisi,
                StoredFileName = storedFileName,
                OriginalFileName = $"{file.DosyaCesidi}.{extension}",
                ContentType = ResolveContentType(extension),
                SizeBytes = file.Dosya.LongLength,
                CreatedAtUtc = DateTimeOffset.UtcNow,
            });
        }
    }

    private async Task<(string? BelediyeKodu, string? IlceAdi, string? BilgilendirmeMetni, (string Code, string Message)? Error)> RequireSettingsAsync(
        Guid tenantId,
        CancellationToken cancellationToken)
    {
        var tenantSetting = await _dbContext.TenantSettings
            .IgnoreQueryFilters()
            .AsNoTracking()
            .FirstOrDefaultAsync(entity => entity.TenantId == tenantId, cancellationToken);

        var settings = _settingsProvider.GetSettings(tenantId)?.EDevlet;
        if (tenantSetting?.BelediyeKodu is null || settings?.SoapKullaniciAdi is null || settings.SoapSifre is null)
        {
            return (settings?.BelediyeKodu, settings?.IlceAdi, settings?.BilgilendirmeMetni, (BelediyeSoapResultCodes.TenantNotFound, "BELEDIYE SOAP AYARLARI TAMAMLANMAMIS"));
        }

        return (tenantSetting.BelediyeKodu, settings.IlceAdi, settings.BilgilendirmeMetni, null);
    }

    private static IReadOnlyList<BelediyeSoapSurecItem> BuildSurecListesi(EDevletBasvuru basvuru)
    {
        if (basvuru.Status == EDevletBasvuruStatus.PendingReview)
        {
            return
            [
                new BelediyeSoapSurecItem(
                    "Operator Onayi",
                    basvuru.CreatedAtUtc,
                    null,
                    "BASVURU ALINDI",
                    "Basvurunuz operator onayina sunulmustur."),
            ];
        }

        if (basvuru.Job is null)
        {
            return Array.Empty<BelediyeSoapSurecItem>();
        }

        var job = basvuru.Job;
        var items = new List<BelediyeSoapSurecItem>
        {
            new(
                "Operator Onayi",
                basvuru.CreatedAtUtc,
                basvuru.UpdatedAtUtc,
                "ONAYLANDI",
                "Basvuru operator tarafindan is akisina alindi."),
        };

        foreach (var department in job.Departments.OrderBy(entity => entity.RequestedAtUtc))
        {
            items.Add(new BelediyeSoapSurecItem(
                department.DepartmentId.ToString(),
                department.RequestedAtUtc ?? basvuru.CreatedAtUtc,
                department.DecidedAtUtc,
                department.ApprovalStatus.ToString().ToUpperInvariant(),
                department.Notes ?? string.Empty));
        }

        return items;
    }

    private static IReadOnlyList<BelediyeSoapBasvuruNotItem> BuildNotListesi(EDevletBasvuru basvuru)
    {
        if (basvuru.Job?.ManagerNote is not { Length: > 0 } note)
        {
            return Array.Empty<BelediyeSoapBasvuruNotItem>();
        }

        return
        [
            new BelediyeSoapBasvuruNotItem(1, basvuru.Job.UpdatedAtUtc ?? basvuru.CreatedAtUtc, note),
        ];
    }

    private static IReadOnlyList<string> DeserializePhones(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return Array.Empty<string>();
        }

        try
        {
            return JsonSerializer.Deserialize<List<string>>(json, JsonOptions) ?? [];
        }
        catch (JsonException)
        {
            return Array.Empty<string>();
        }
    }

    private static string FormatTakipNo(int year, int number) => $"ED-{year}-{number}";

    private static string NormalizeBasvuruTipi(string value)
        => value.Trim() switch
        {
            "1" => "Talep",
            "2" => "Oneri",
            _ => value.Trim(),
        };

    private static double? ParseCoordinate(string? value)
        => double.TryParse(value, out var parsed) ? parsed : null;

    private static string? NullIfWhiteSpace(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string ResolveContentType(string extension)
        => extension.ToLowerInvariant() switch
        {
            "pdf" => "application/pdf",
            "jpg" or "jpeg" => "image/jpeg",
            "png" => "image/png",
            _ => "application/octet-stream",
        };

    private static TimeZoneInfo ResolveTurkeyTimeZone()
    {
        foreach (var id in new[] { "Europe/Istanbul", "Turkey Standard Time" })
        {
            try
            {
                return TimeZoneInfo.FindSystemTimeZoneById(id);
            }
            catch (TimeZoneNotFoundException)
            {
            }
            catch (InvalidTimeZoneException)
            {
            }
        }

        return TimeZoneInfo.Utc;
    }
}

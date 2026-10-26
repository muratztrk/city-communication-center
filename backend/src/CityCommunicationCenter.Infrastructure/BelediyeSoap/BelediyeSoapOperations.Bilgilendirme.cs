using System.Text.RegularExpressions;
using CityCommunicationCenter.Application.Abstractions.BelediyeSoap;
using CityCommunicationCenter.Domain.Entities;

namespace CityCommunicationCenter.Infrastructure.BelediyeSoap;

// e-Devlet "Bilgilendirilme Istegi" hizmeti (SDD 3.1.3, Bilgilendirme Istegi Yap/Sorgula/Iptal ve tur sorgulari).
// Su an yalnizca kayit tutulur; kayitlara mesaj gonderimi bu katmanin disindadir.
public sealed partial class BelediyeSoapOperations
{
    private const int MaxAdLength = 30;
    private const int MaxEpostaLength = 200;

    public async Task<BelediyeSoapOperationResult<BelediyeSoapBilgilendirmeTurResponse>> BilgilendirmeTurleriSorgulaAsync(
        Guid tenantId,
        bool sms,
        CancellationToken cancellationToken)
    {
        var settings = await RequireSettingsAsync(tenantId, cancellationToken);
        if (settings.Error is not null)
        {
            return BelediyeSoapOperationResult<BelediyeSoapBilgilendirmeTurResponse>.Fail(
                settings.Error.Value.Code, settings.Error.Value.Message, settings.BelediyeKodu);
        }

        var options = LoadBilgilendirmeTurleri(tenantId);
        var items = (sms ? options.Sms : options.Eposta)
            .Select(tur => new BelediyeSoapBilgilendirmeTurItem(tur.Kod, tur.Ad, tur.Aciklama))
            .ToList();

        return BelediyeSoapOperationResult<BelediyeSoapBilgilendirmeTurResponse>.Success(
            new BelediyeSoapBilgilendirmeTurResponse(items),
            settings.BelediyeKodu!);
    }

    public async Task<BelediyeSoapOperationResult<bool>> BilgilendirmeIstegiYapAsync(
        Guid tenantId,
        string tcKimlikNo,
        BelediyeSoapBilgilendirmeIstegiYapRequest request,
        CancellationToken cancellationToken)
    {
        var settings = await RequireSettingsAsync(tenantId, cancellationToken);
        if (settings.Error is not null)
        {
            return BelediyeSoapOperationResult<bool>.Fail(settings.Error.Value.Code, settings.Error.Value.Message, settings.BelediyeKodu);
        }

        BelediyeSoapOperationResult<bool> Invalid(string message)
            => BelediyeSoapOperationResult<bool>.Fail(BelediyeSoapResultCodes.ValidationFailed, message, settings.BelediyeKodu);

        var tc = tcKimlikNo.Trim();
        if (tc.Length != 11 || !tc.All(char.IsDigit))
        {
            return BelediyeSoapOperationResult<bool>.Fail(
                BelediyeSoapResultCodes.InvalidParameter, BelediyeSoapResultCodes.InvalidParameterMessage("tcKimlikNo"), settings.BelediyeKodu);
        }

        var adi = request.Adi.Trim();
        var soyadi = request.Soyadi.Trim();
        if (adi.Length == 0 || adi.Length > MaxAdLength || soyadi.Length == 0 || soyadi.Length > MaxAdLength)
        {
            return Invalid($"AD VE SOYAD 1 ILE {MaxAdLength} KARAKTER OLMALIDIR");
        }

        var eposta = request.Eposta.Trim();
        if (eposta.Length > MaxEpostaLength || !EpostaPattern().IsMatch(eposta))
        {
            return Invalid("GECERSIZ E-POSTA ADRESI");
        }

        var telefon = new string(request.CepTelefonNo.Where(char.IsDigit).ToArray());
        if (telefon.Length is < 7 or > 15)
        {
            return Invalid("GECERSIZ CEP TELEFONU");
        }

        var ulkeKodu = new string(request.CepUlkeKodu.Where(char.IsDigit).ToArray());
        if (ulkeKodu.Length > 4)
        {
            return Invalid("GECERSIZ ULKE KODU");
        }

        var turler = LoadBilgilendirmeTurleri(tenantId);
        var smsKodlari = new List<string>();
        foreach (var kod in request.SmsKategoriKodlari.Where(value => !string.IsNullOrWhiteSpace(value)))
        {
            var tur = turler.FindSms(kod);
            if (tur is null)
            {
                return BelediyeSoapOperationResult<bool>.Fail(
                    BelediyeSoapResultCodes.InvalidParameter, BelediyeSoapResultCodes.InvalidParameterMessage("secilenSMSBilgilendirmeKategoriListesi"), settings.BelediyeKodu);
            }

            if (!smsKodlari.Contains(tur.Kod, StringComparer.Ordinal))
            {
                smsKodlari.Add(tur.Kod);
            }
        }

        var epostaKodlari = new List<string>();
        foreach (var kod in request.EpostaKategoriKodlari.Where(value => !string.IsNullOrWhiteSpace(value)))
        {
            var tur = turler.FindEposta(kod);
            if (tur is null)
            {
                return BelediyeSoapOperationResult<bool>.Fail(
                    BelediyeSoapResultCodes.InvalidParameter, BelediyeSoapResultCodes.InvalidParameterMessage("secilenEpostaBilgilendirmeKategoriListesi"), settings.BelediyeKodu);
            }

            if (!epostaKodlari.Contains(tur.Kod, StringComparer.Ordinal))
            {
                epostaKodlari.Add(tur.Kod);
            }
        }

        if (smsKodlari.Count == 0 && epostaKodlari.Count == 0)
        {
            return Invalid("EN AZ BIR BILGILENDIRME KATEGORISI SECILMELIDIR");
        }

        var mahalleAdlari = await LoadMahalleNamesAsync(tenantId, cancellationToken);
        var mahalleler = new List<BilgilendirmeMahalle>();
        foreach (var kod in request.MahalleKodlari.Where(value => !string.IsNullOrWhiteSpace(value)))
        {
            var ad = mahalleAdlari.FirstOrDefault(name => string.Equals(BelediyeAddressCodes.Encode(name), kod.Trim(), StringComparison.Ordinal));
            if (ad is null)
            {
                return BelediyeSoapOperationResult<bool>.Fail(
                    BelediyeSoapResultCodes.InvalidParameter, BelediyeSoapResultCodes.InvalidParameterMessage("ilgilenilenMahalleListesi"), settings.BelediyeKodu);
            }

            if (!mahalleler.Any(item => item.Kod == kod.Trim()))
            {
                mahalleler.Add(new BilgilendirmeMahalle(kod.Trim(), ad));
            }
        }

        var utcNow = DateTimeOffset.UtcNow;
        var kayit = await _dbContext.BilgilendirmeIstekleri
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(entity => entity.TenantId == tenantId && entity.CitizenTcKimlikNo == tc, cancellationToken);
        if (kayit is null)
        {
            kayit = new BilgilendirmeIstegi
            {
                BilgilendirmeIstegiId = Guid.NewGuid(),
                TenantId = tenantId,
                CitizenTcKimlikNo = tc,
                CreatedAtUtc = utcNow,
            };
            _dbContext.BilgilendirmeIstekleri.Add(kayit);
        }
        else
        {
            kayit.UpdatedAtUtc = utcNow;
        }

        kayit.Adi = adi;
        kayit.Soyadi = soyadi;
        kayit.Eposta = eposta;
        kayit.CepUlkeKodu = ulkeKodu;
        kayit.CepTelefonNo = telefon;
        kayit.BelediyeIletisimBilgisiniGuncelle = request.BelediyeIletisimBilgisiniGuncelle;
        kayit.SetMahalleler(mahalleler);
        kayit.SetSmsKategoriKodlari(smsKodlari);
        kayit.SetEpostaKategoriKodlari(epostaKodlari);
        kayit.IsActive = true;
        kayit.CancelledAtUtc = null;

        await _dbContext.SaveChangesAsync(cancellationToken);
        return BelediyeSoapOperationResult<bool>.Success(true, settings.BelediyeKodu!);
    }

    public async Task<BelediyeSoapOperationResult<BelediyeSoapKayitliBilgilendirmeIstegi?>> BilgilendirmeIstegiSorgulaAsync(
        Guid tenantId,
        string tcKimlikNo,
        CancellationToken cancellationToken)
    {
        var settings = await RequireSettingsAsync(tenantId, cancellationToken);
        if (settings.Error is not null)
        {
            return BelediyeSoapOperationResult<BelediyeSoapKayitliBilgilendirmeIstegi?>.Fail(
                settings.Error.Value.Code, settings.Error.Value.Message, settings.BelediyeKodu);
        }

        var tc = tcKimlikNo.Trim();
        var kayit = await _dbContext.BilgilendirmeIstekleri
            .IgnoreQueryFilters()
            .AsNoTracking()
            .FirstOrDefaultAsync(
                entity => entity.TenantId == tenantId && entity.CitizenTcKimlikNo == tc && entity.IsActive,
                cancellationToken);

        // Aktif kayit yoksa basarili sonuc ve bos (nil) kayit doner.
        if (kayit is null)
        {
            return BelediyeSoapOperationResult<BelediyeSoapKayitliBilgilendirmeIstegi?>.Success(null, settings.BelediyeKodu!);
        }

        var turler = LoadBilgilendirmeTurleri(tenantId);
        var sms = kayit.GetSmsKategoriKodlari()
            .Select(turler.FindSms)
            .OfType<BilgilendirmeTur>()
            .Select(tur => new BelediyeSoapBilgilendirmeTurItem(tur.Kod, tur.Ad, tur.Aciklama))
            .ToList();
        var eposta = kayit.GetEpostaKategoriKodlari()
            .Select(turler.FindEposta)
            .OfType<BilgilendirmeTur>()
            .Select(tur => new BelediyeSoapBilgilendirmeTurItem(tur.Kod, tur.Ad, tur.Aciklama))
            .ToList();

        return BelediyeSoapOperationResult<BelediyeSoapKayitliBilgilendirmeIstegi?>.Success(
            new BelediyeSoapKayitliBilgilendirmeIstegi(
                kayit.Eposta,
                kayit.CepUlkeKodu,
                kayit.CepTelefonNo,
                kayit.GetMahalleler().Select(item => new BelediyeSoapMahalleItem(item.Kod, item.Ad)).ToList(),
                sms,
                eposta),
            settings.BelediyeKodu!);
    }

    public async Task<BelediyeSoapOperationResult<bool>> BilgilendirmeIstegiIptalAsync(
        Guid tenantId,
        string tcKimlikNo,
        CancellationToken cancellationToken)
    {
        var settings = await RequireSettingsAsync(tenantId, cancellationToken);
        if (settings.Error is not null)
        {
            return BelediyeSoapOperationResult<bool>.Fail(settings.Error.Value.Code, settings.Error.Value.Message, settings.BelediyeKodu);
        }

        var tc = tcKimlikNo.Trim();
        var kayit = await _dbContext.BilgilendirmeIstekleri
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(
                entity => entity.TenantId == tenantId && entity.CitizenTcKimlikNo == tc && entity.IsActive,
                cancellationToken);
        if (kayit is null)
        {
            return BelediyeSoapOperationResult<bool>.Fail(
                BelediyeSoapResultCodes.NotFound,
                BelediyeSoapResultCodes.NotFoundMessage,
                settings.BelediyeKodu);
        }

        kayit.IsActive = false;
        kayit.CancelledAtUtc = DateTimeOffset.UtcNow;
        kayit.UpdatedAtUtc = kayit.CancelledAtUtc;
        await _dbContext.SaveChangesAsync(cancellationToken);
        return BelediyeSoapOperationResult<bool>.Success(true, settings.BelediyeKodu!);
    }

    private BilgilendirmeTurleriOptions LoadBilgilendirmeTurleri(Guid tenantId)
        => BilgilendirmeTurleriOptions.Parse(_settingsProvider.GetSettings(tenantId)?.EDevlet?.BilgilendirmeTurleri);

    [GeneratedRegex(@"^[^@\s]+@[^@\s]+\.[^@\s]+$")]
    private static partial Regex EpostaPattern();
}

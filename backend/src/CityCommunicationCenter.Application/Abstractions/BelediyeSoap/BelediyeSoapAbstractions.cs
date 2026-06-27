namespace CityCommunicationCenter.Application.Abstractions.BelediyeSoap;

public interface IBelediyeSoapOperations
{
    Task<BelediyeSoapAuthResult> AuthenticateAsync(
        string belediyeKodu,
        string kullaniciAdi,
        string sifre,
        CancellationToken cancellationToken);

    Task<BelediyeSoapOperationResult<BelediyeSoapGunlukFaaliyetResponse>> GunlukFaaliyetSorgulaAsync(
        Guid tenantId,
        CancellationToken cancellationToken);

    Task<BelediyeSoapOperationResult<BelediyeSoapBasvuruTipiResponse>> BasvuruTipiSorgulaAsync(
        Guid tenantId,
        CancellationToken cancellationToken);

    Task<BelediyeSoapOperationResult<BelediyeSoapBasvuruYapResponse>> BasvuruYapAsync(
        Guid tenantId,
        BelediyeSoapBasvuruYapRequest request,
        CancellationToken cancellationToken);

    Task<BelediyeSoapOperationResult<BelediyeSoapBasvuruDurumResponse>> BasvuruDurumSorgulaAsync(
        Guid tenantId,
        string tcKimlikNo,
        CancellationToken cancellationToken);

    Task<BelediyeSoapOperationResult<BelediyeSoapBasvuruDetayResponse>> BasvuruDetaySorgulaAsync(
        Guid tenantId,
        string tcKimlikNo,
        string basvuruNumarasi,
        CancellationToken cancellationToken);

    Task<BelediyeSoapOperationResult<string>> AyarOkuAsync(
        Guid tenantId,
        string ayar,
        CancellationToken cancellationToken);

    Task<BelediyeSoapOperationResult<IReadOnlyList<BelediyeSoapDetailItem>>> AyarOkuListeAsync(
        Guid tenantId,
        string ayar,
        CancellationToken cancellationToken);

    Task<BelediyeSoapOperationResult<BelediyeSoapIlceResponse>> IlceSorgulaAsync(
        Guid tenantId,
        CancellationToken cancellationToken);

    Task<BelediyeSoapOperationResult<BelediyeSoapMahalleResponse>> MahalleSorgulaAsync(
        Guid tenantId,
        string ilceKodu,
        CancellationToken cancellationToken);

    Task<BelediyeSoapOperationResult<BelediyeSoapSokakCaddeResponse>> SokakCaddeSorgulaAsync(
        Guid tenantId,
        string ilceKodu,
        string mahalleKodu,
        CancellationToken cancellationToken);
}

public sealed record BelediyeSoapAuthResult(
    bool IsSuccess,
    Guid? TenantId,
    string? BelediyeKodu,
    string SonucKodu,
    string SonucAciklamasi);

public sealed record BelediyeSoapOperationResult<T>(
    bool IsSuccess,
    T? Data,
    string SonucKodu,
    string SonucAciklamasi,
    string? BelediyeKodu = null)
{
    public static BelediyeSoapOperationResult<T> Success(T data, string belediyeKodu) =>
        new(true, data, BelediyeSoapResultCodes.Success, BelediyeSoapResultCodes.SuccessMessage, belediyeKodu);

    public static BelediyeSoapOperationResult<T> Fail(string sonucKodu, string sonucAciklamasi, string? belediyeKodu = null) =>
        new(false, default, sonucKodu, sonucAciklamasi, belediyeKodu);
}

public static class BelediyeSoapResultCodes
{
    public const string Success = "0000";
    public const string SuccessMessage = "ISLEM BASARILI";
    public const string AuthFailed = "0001";
    public const string AuthFailedMessage = "KULLANICI ADI VEYA SIFRE HATALI";
    public const string TenantNotFound = "0002";
    public const string TenantNotFoundMessage = "BELEDIYE KODU BULUNAMADI";
    public const string ValidationFailed = "0003";
    public const string NotFound = "0004";
    public const string NotFoundMessage = "KAYIT BULUNAMADI";
}

public sealed record BelediyeSoapGunlukFaaliyetResponse(
    IReadOnlyList<BelediyeSoapFaaliyetItem> FaaliyetListesi);

public sealed record BelediyeSoapFaaliyetItem(
    string FaaliyetTipi,
    string Ilce,
    string Mahalle,
    string SokakCadde,
    string Aciklama);

public sealed record BelediyeSoapBasvuruTipiResponse(
    IReadOnlyList<BelediyeSoapBasvuruTipiItem> BasvuruTipiListesi);

public sealed record BelediyeSoapBasvuruTipiItem(string Kod, string Adi, string Aciklama);

public sealed record BelediyeSoapBasvuruYapRequest(
    string TcKimlikNo,
    string Adi,
    string Soyadi,
    string BasvuruTipi,
    string BasvuruDetay,
    string? Eposta,
    IReadOnlyList<string> TelefonListesi,
    string? IlceKodu,
    string? MahalleKodu,
    string? SokakCaddeKodu,
    string? DisKapiNo,
    string? IcKapiNo,
    string? BasvuranAcikAdres,
    string? BasvuranNviAdresNo,
    string? Enlem,
    string? Boylam,
    string? CevapSekli,
    IReadOnlyList<BelediyeSoapBasvuruDosyaItem> DosyaListesi);

public sealed record BelediyeSoapBasvuruDosyaItem(
    string DosyaCesidi,
    string DosyaUzanti,
    string? BelgeTarihi,
    string? BelgeSayisi,
    byte[] Dosya);

public sealed record BelediyeSoapBasvuruYapResponse(string BasvuruTakipNo);

public sealed record BelediyeSoapBasvuruDurumResponse(
    IReadOnlyList<BelediyeSoapBasvuruDurumItem> BasvuruDurumListesi);

public sealed record BelediyeSoapBasvuruDurumItem(
    DateTimeOffset BasvuruTarihi,
    string BasvuruNumarasi,
    string BasvuruPlatform,
    string BasvuruDurumu,
    string BasvuruMetni,
    string BasvuruTipi);

public sealed record BelediyeSoapBasvuruDetayResponse(
    string BasvuruNumarasi,
    DateTimeOffset BasvuruTarihi,
    string AboneNo,
    string BasvuruTipi,
    string IlceAdi,
    string MahalleAdi,
    string SokakCaddeAdi,
    string DisKapiNo,
    string IcKapiNo,
    string BasvuranAcikAdres,
    string Eposta,
    IReadOnlyList<BelediyeSoapTelefonItem> TelefonListesi,
    string BasvuruIstek,
    string CevapSekli,
    IReadOnlyList<BelediyeSoapSurecItem> BasvuruSurecListesi,
    string BasvuruDurumu,
    DateTimeOffset? BasvuruCevapTarihi,
    string BasvuruCevapMetin,
    IReadOnlyList<BelediyeSoapBasvuruNotItem> BasvuruNotListesi);

public sealed record BelediyeSoapTelefonItem(string TelefonTipi, string TelefonNumarasi);

public sealed record BelediyeSoapSurecItem(
    string AtananBirim,
    DateTimeOffset AtanmaTarihi,
    DateTimeOffset? BirimCevapTarihi,
    string Durumu,
    string Aciklama);

public sealed record BelediyeSoapBasvuruNotItem(int NotSiraNumarasi, DateTimeOffset NotTarihi, string NotMetin);

public sealed record BelediyeSoapDetailItem(string Anahtar, string Deger);

public sealed record BelediyeSoapIlceResponse(IReadOnlyList<BelediyeSoapIlceItem> IlceListesi);

public sealed record BelediyeSoapIlceItem(string IlceKodu, string IlceAdi);

public sealed record BelediyeSoapMahalleResponse(IReadOnlyList<BelediyeSoapMahalleItem> MahalleListesi);

public sealed record BelediyeSoapMahalleItem(string MahalleKodu, string MahalleAdi);

public sealed record BelediyeSoapSokakCaddeResponse(IReadOnlyList<BelediyeSoapSokakCaddeItem> SokakCaddeListesi);

public sealed record BelediyeSoapSokakCaddeItem(string SokakCaddeKodu, string SokakCaddeAdi);

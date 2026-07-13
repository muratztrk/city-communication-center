namespace CityCommunicationCenter.Application.Features.Admin;

public static class CitizenAutoReplyTemplateDefaults
{
    public const string ProcessingReceived = "{VatandaşTalepNo} no'lu {VatandaşTalepBaşlığı} talebinizin durumu İşleme Alındı. {GönderilenBirim}";
    public const string InProgress = "{VatandaşTalepNo} no'lu {VatandaşTalepBaşlığı} talebinizin durumu Yapılmakta. {GönderilenBirim}";
    public const string Completed = "{VatandaşTalepNo} no'lu {VatandaşTalepBaşlığı} talebinizin durumu Tamamlandı. {GönderilenBirim}";
    public const string Cancelled = "{VatandaşTalepNo} no'lu {VatandaşTalepBaşlığı} talebinizin durumu İptal Edildi. {GönderilenBirim}";
}

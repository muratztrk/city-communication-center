namespace CityCommunicationCenter.Application.Features.Admin;

public static class CitizenAutoReplyTemplateDefaults
{
    public const string ProcessingReceived = "{VatandaşTalepNo} no'lu {VatandaşTalepBaşlığı} talebinizin durumu İşleme Alındı.";
    public const string InProgress = "{VatandaşTalepNo} no'lu {VatandaşTalepBaşlığı} talebinizin durumu Yapılmakta.";
    public const string Completed = "{VatandaşTalepNo} no'lu {VatandaşTalepBaşlığı} talebinizin durumu Tamamlandı.";
    public const string Cancelled = "{VatandaşTalepNo} no'lu {VatandaşTalepBaşlığı} talebinizin durumu İptal Edildi.";
}

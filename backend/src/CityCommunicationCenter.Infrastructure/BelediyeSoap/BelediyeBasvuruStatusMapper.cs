using CityCommunicationCenter.Domain.Entities;
using CityCommunicationCenter.Domain.Enums;

namespace CityCommunicationCenter.Infrastructure.BelediyeSoap;

internal static class BelediyeBasvuruStatusMapper
{
    public static string Map(EDevletBasvuru basvuru)
    {
        if (basvuru.Status == EDevletBasvuruStatus.PendingReview)
        {
            return "BASVURU ALINDI";
        }

        if (basvuru.Status == EDevletBasvuruStatus.Rejected)
        {
            return "REDDEDILDI";
        }

        if (basvuru.Job is null)
        {
            return "ISLEMDE";
        }

        return basvuru.Job.Status switch
        {
            JobStatus.PendingOwnerApproval or JobStatus.PendingExternalApproval => "DEGERLENDIRME ASAMASINDA",
            JobStatus.Active => "ISLEMDE",
            JobStatus.Completed => "TAMAMLANDI",
            JobStatus.Rejected => "REDDEDILDI",
            JobStatus.Cancelled => "IPTAL EDILDI",
            JobStatus.RevisionRequested => "REVIZYON BEKLENIYOR",
            _ => "ISLEMDE",
        };
    }
}

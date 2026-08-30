using CityCommunicationCenter.Application.Features.Admin;
using CityCommunicationCenter.Application.Features.Social;
using CityCommunicationCenter.Domain.Entities;
using CityCommunicationCenter.Domain.Enums;

namespace CityCommunicationCenter.Application.Tests.Features.Social;

public sealed class CitizenJobStatusMessageTests
{
    [Fact]
    public void ParseOrDefault_AddsTargetDepartmentToken_ToExistingSavedTemplates()
    {
        const string json = """
            {
              "ProcessingReceived": "{VatandaşTalepNo} talebiniz İşleme Alındı.",
              "InProgress": "{VatandaşTalepNo} talebiniz Yapılmakta.",
              "Completed": "{VatandaşTalepNo} talebiniz Tamamlandı.",
              "Cancelled": "{VatandaşTalepNo} talebiniz İptal Edildi."
            }
            """;

        var templates = CitizenAutoReplyTemplateJson.ParseOrDefault(json);

        Assert.Contains("{GönderilenBirim}", templates.ProcessingReceived);
        Assert.Contains("{GönderilenBirim}", templates.InProgress);
        Assert.Contains("{GönderilenBirim}", templates.Completed);
        Assert.Contains("{GönderilenBirim}", templates.Cancelled);
        Assert.EndsWith("{GönderilenBirim}", templates.ProcessingReceived);
    }

    [Fact]
    public void ParseOrDefault_PreservesTextAfterTargetDepartmentTokenVerbatim()
    {
        // Token sonrası otomatik boşluk eklenmez/silinmez; yalnız legacy token adı
        // kanonikleştirilir (card #1598 2. reopen).
        const string json = """
            {
              "ProcessingReceived": "İşleme Alındı. {GönderilenBirim}'ne iletilmiştir.",
              "InProgress": "Yapılmakta. {Gönderilen Birim}   ekiplerce inceleniyor.",
              "Completed": "Tamamlandı. {GönderilenBirim} ekiplerce incelendi.",
              "Cancelled": "İptal Edildi. {GönderilenBirim}"
            }
            """;

        var templates = CitizenAutoReplyTemplateJson.ParseOrDefault(json);

        Assert.Contains("{GönderilenBirim}'ne iletilmiştir.", templates.ProcessingReceived);
        Assert.Contains("{GönderilenBirim}   ekiplerce inceleniyor.", templates.InProgress);
        Assert.Contains("{GönderilenBirim} ekiplerce incelendi.", templates.Completed);
        Assert.Contains("{GönderilenBirim}", templates.Cancelled);
        Assert.EndsWith("{İptal Notu}", templates.Cancelled);
    }

    [Fact]
    public void ParseOrDefault_PreservesAfterHoursManagerSmsWhitespace()
    {
        const string json = """
            {
              "ProcessingReceived": "{VatandaşTalepNo} İşleme Alındı. {GönderilenBirim}",
              "InProgress": "{VatandaşTalepNo} Yapılmakta. {GönderilenBirim}",
              "Completed": "{VatandaşTalepNo} Tamamlandı. {GönderilenBirim}",
              "Cancelled": "{VatandaşTalepNo} İptal Edildi. {GönderilenBirim}",
              "AfterHoursManagerSms": "Satır 1\n  girintili\n"
            }
            """;

        var templates = CitizenAutoReplyTemplateJson.ParseOrDefault(json);

        Assert.Equal("Satır 1\n  girintili\n", templates.AfterHoursManagerSms);
    }

    [Fact]
    public void BuildStatusMessage_ReplacesTargetDepartmentToken()
    {
        var receivedAt = new DateTimeOffset(2026, 7, 13, 10, 0, 0, TimeSpan.Zero);
        var message = new SocialMessage
        {
            CitizenRequestNumber = 42,
            CitizenRequestNumberYear = 2026,
            ReceivedAtUtc = receivedAt,
        };
        var job = new Job
        {
            Title = "Yol bakım",
            Status = JobStatus.Active,
        };

        var content = CitizenJobStatusLabelHelper.BuildStatusMessage(
            message,
            job,
            1,
            receivedAt,
            "{VatandaşTalepNo} no'lu {VatandaşTalepBaşlığı} talebiniz {VatandaşTalepDurumu}. {GönderilenBirim} ekiplerince inceleniyor.",
            "Fen İşleri Müdürlüğü");

        Assert.Equal(
            "VT-2026-42 no'lu Yol bakım talebiniz Yapılmakta. Fen İşleri Müdürlüğü ekiplerince inceleniyor.",
            content);
    }

    [Theory]
    [InlineData("{GönderilenBirim}'ne iletilmiştir.", "Fen İşleri Müdürlüğü'ne iletilmiştir.")]
    [InlineData("{GönderilenBirim} ekiplerce inceleniyor.", "Fen İşleri Müdürlüğü ekiplerce inceleniyor.")]
    [InlineData("{GönderilenBirim}   ekiplerce inceleniyor.", "Fen İşleri Müdürlüğü   ekiplerce inceleniyor.")]
    [InlineData("{Gönderilen Birim}'ne iletilmiştir.", "Fen İşleri Müdürlüğü'ne iletilmiştir.")]
    public void BuildStatusMessage_PreservesTemplateTextAfterTargetDepartmentVerbatim(
        string templateSuffix,
        string expectedEnding)
    {
        // Otomatik ayraç eklenmez: bitişik yazılan ek ("'ne iletilmiştir.") bitişik kalır,
        // kullanıcının yazdığı boşluklar aynen korunur (card #1598 2. reopen).
        var receivedAt = new DateTimeOffset(2026, 7, 13, 10, 0, 0, TimeSpan.Zero);
        var content = CitizenJobStatusLabelHelper.BuildStatusMessage(
            new SocialMessage
            {
                CitizenRequestNumber = 42,
                CitizenRequestNumberYear = 2026,
                ReceivedAtUtc = receivedAt,
            },
            new Job { Title = "Yol bakım", Status = JobStatus.Active },
            1,
            receivedAt,
            $"{{VatandaşTalepNo}} talebiniz. {templateSuffix}",
            "Fen İşleri Müdürlüğü");

        Assert.EndsWith(expectedEnding, content);
    }

    [Fact]
    public void ParseOrDefault_AddsTerminalNoteTokens_ToCompletedAndCancelled()
    {
        const string json = """
            {
              "ProcessingReceived": "{VatandaşTalepNo} İşleme Alındı. {GönderilenBirim}",
              "InProgress": "{VatandaşTalepNo} Yapılmakta. {GönderilenBirim}",
              "Completed": "{VatandaşTalepNo} Tamamlandı. {GönderilenBirim}",
              "Cancelled": "{VatandaşTalepNo} İptal Edildi. {GönderilenBirim}"
            }
            """;

        var templates = CitizenAutoReplyTemplateJson.ParseOrDefault(json);

        Assert.DoesNotContain("{Tamamlama Notu}", templates.ProcessingReceived);
        Assert.DoesNotContain("{İptal Notu}", templates.InProgress);
        Assert.Contains("{Tamamlama Notu}", templates.Completed);
        Assert.Contains("{İptal Notu}", templates.Cancelled);
        Assert.EndsWith("{Tamamlama Notu}", templates.Completed);
        Assert.EndsWith("{İptal Notu}", templates.Cancelled);
    }

    [Fact]
    public void BuildStatusMessage_ReplacesCompletionNoteToken_AndKeepsTextAfter()
    {
        var receivedAt = new DateTimeOffset(2026, 7, 13, 10, 0, 0, TimeSpan.Zero);
        var content = CitizenJobStatusLabelHelper.BuildStatusMessage(
            new SocialMessage
            {
                CitizenRequestNumber = 42,
                CitizenRequestNumberYear = 2026,
                ReceivedAtUtc = receivedAt,
            },
            new Job { Title = "Yol bakım", Status = JobStatus.Completed },
            1,
            receivedAt,
            "{VatandaşTalepNo} talebiniz \"Tamamlandı\". {GönderilenBirim}\n\n{Tamamlama Notu} teşekkürler.",
            "Fen İşleri Müdürlüğü",
            "sahada tamamlandı.");

        Assert.Equal(
            "VT-2026-42 talebiniz \"Tamamlandı\". Fen İşleri Müdürlüğü\n\nsahada tamamlandı. teşekkürler.",
            content);
    }

    [Fact]
    public void BuildStatusMessage_EmptyNote_RemovesToken()
    {
        var receivedAt = new DateTimeOffset(2026, 7, 13, 10, 0, 0, TimeSpan.Zero);
        var content = CitizenJobStatusLabelHelper.BuildStatusMessage(
            new SocialMessage
            {
                CitizenRequestNumber = 7,
                CitizenRequestNumberYear = 2026,
                ReceivedAtUtc = receivedAt,
            },
            new Job { Title = "Park", Status = JobStatus.Cancelled },
            0,
            receivedAt,
            "İptal. {GönderilenBirim}\n\n{İptal Notu}",
            "Fen İşleri Müdürlüğü",
            "");

        Assert.Equal("İptal. Fen İşleri Müdürlüğü", content);
        Assert.DoesNotContain("{İptal Notu}", content);
    }

    [Fact]
    public void BuildStatusMessage_NullNote_LeavesTokenForLaterApply()
    {
        var receivedAt = new DateTimeOffset(2026, 7, 13, 10, 0, 0, TimeSpan.Zero);
        var content = CitizenJobStatusLabelHelper.BuildStatusMessage(
            new SocialMessage
            {
                CitizenRequestNumber = 42,
                CitizenRequestNumberYear = 2026,
                ReceivedAtUtc = receivedAt,
            },
            new Job { Title = "Yol bakım", Status = JobStatus.Completed },
            1,
            receivedAt,
            "{VatandaşTalepNo} talebiniz \"Tamamlandı\". {GönderilenBirim}\n\n{Tamamlama Notu}",
            "Fen İşleri Müdürlüğü");

        Assert.Contains("{Tamamlama Notu}", content);
        Assert.Equal(
            "VT-2026-42 talebiniz \"Tamamlandı\". Fen İşleri Müdürlüğü\n\nsahada tamamlandı.",
            CitizenJobStatusLabelHelper.ApplyTerminalNote(content, "sahada tamamlandı."));
    }
}

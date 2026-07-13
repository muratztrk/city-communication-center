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
        Assert.EndsWith("{GönderilenBirim} ", templates.ProcessingReceived);
    }

    [Fact]
    public void ParseOrDefault_AddsSingleSpaceBetweenTargetDepartmentTokenAndSuffix()
    {
        const string json = """
            {
              "ProcessingReceived": "İşleme Alındı. {GönderilenBirim}ekiplerce inceleniyor.",
              "InProgress": "Yapılmakta. {Gönderilen Birim}   ekiplerce inceleniyor.",
              "Completed": "Tamamlandı. {GönderilenBirim} ekiplerce incelendi.",
              "Cancelled": "İptal Edildi. {GönderilenBirim}"
            }
            """;

        var templates = CitizenAutoReplyTemplateJson.ParseOrDefault(json);

        Assert.Contains("{GönderilenBirim} ekiplerce inceleniyor.", templates.ProcessingReceived);
        Assert.Contains("{GönderilenBirim} ekiplerce inceleniyor.", templates.InProgress);
        Assert.Contains("{GönderilenBirim} ekiplerce incelendi.", templates.Completed);
        Assert.EndsWith("{GönderilenBirim} ", templates.Cancelled);
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
    [InlineData("{GönderilenBirim}ekiplerce inceleniyor.")]
    [InlineData("{GönderilenBirim}   ekiplerce inceleniyor.")]
    [InlineData("{Gönderilen Birim}ekiplerce inceleniyor.")]
    public void BuildStatusMessage_AlwaysSeparatesTargetDepartmentFromSuffix(string templateSuffix)
    {
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

        Assert.EndsWith("Fen İşleri Müdürlüğü ekiplerce inceleniyor.", content);
    }
}

using CityCommunicationCenter.Application.Features.Jobs;

namespace CityCommunicationCenter.Application.Tests.Features.Jobs;

public sealed class AfterHoursSmsTemplateRendererTests
{
    [Fact]
    public void Render_replaces_tokens()
    {
        var body = AfterHoursSmsTemplateRenderer.Render(
            "{VatandaşTalepNo} — {VatandaşTalepBaşlığı}",
            "VT-2026-42",
            "Park lambası");

        Assert.Equal("VT-2026-42 — Park lambası", body);
    }

    [Fact]
    public void Render_appends_request_number_when_template_has_no_token()
    {
        var body = AfterHoursSmsTemplateRenderer.Render(
            "Mesai dışı talep oluşturulmuştur.",
            "VT-2026-115",
            "Sad");

        Assert.Contains("VT-2026-115", body);
        Assert.Contains("Sad", body);
    }

    [Fact]
    public void Render_replaces_task_tokens()
    {
        var body = AfterHoursSmsTemplateRenderer.Render(
            "{GörevNo} no'lu {GörevBaşlığı} atandı.",
            "VT-2026-42",
            "Park lambası",
            "G-2026-9",
            "Kaldırım onarımı");

        Assert.Equal("G-2026-9 no'lu Kaldırım onarımı atandı.", body);
        Assert.DoesNotContain("VT-2026-42", body);
        Assert.DoesNotContain("Park lambası", body);
    }
}

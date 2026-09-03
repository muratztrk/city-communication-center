using CityCommunicationCenter.Shared.FileStorage;

namespace CityCommunicationCenter.Application.Tests.FileStorage;

public sealed class AttachmentNasPathTests
{
    [Fact]
    public void BuildRelativePath_MirrorsLocalUploadLayout()
    {
        var tenantId = Guid.Parse("b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e");
        var entityId = Guid.Parse("11111111-2222-3333-4444-555555555555");

        var path = AttachmentNasPath.BuildRelativePath(tenantId, "Job", entityId, "abc.pdf");

        Assert.Equal(
            "b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e/Job/11111111-2222-3333-4444-555555555555/abc.pdf",
            path);
    }

    [Fact]
    public void ToSmbPath_UsesBackslashes()
    {
        var smbPath = AttachmentNasPath.ToSmbPath("tenant/Job/guid/file.pdf");

        Assert.Equal(@"tenant\Job\guid\file.pdf", smbPath);
    }
}

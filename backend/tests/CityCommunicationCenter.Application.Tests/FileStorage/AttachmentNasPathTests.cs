using CityCommunicationCenter.Application.Features.Attachments;
using CityCommunicationCenter.Domain.Enums;
using CityCommunicationCenter.Shared.FileStorage;

namespace CityCommunicationCenter.Application.Tests.FileStorage;

public sealed class AttachmentNasPathTests
{
    [Fact]
    public void BuildRelativePath_UsesRequestFolderAndOriginalFileName()
    {
        var path = AttachmentNasPath.BuildRelativePath("VT-2026-42", "Fotoğraf.jpg");

        Assert.Equal("VT-2026-42/Fotoğraf.jpg", path);
    }

    [Fact]
    public void BuildRelativePath_SanitizesInvalidCharacters()
    {
        var path = AttachmentNasPath.BuildRelativePath("T-2026-7", "rapor:1.pdf");

        Assert.Equal("T-2026-7/rapor_1.pdf", path);
    }

    [Fact]
    public void AllocateUniqueFileName_AppendsCounterForDuplicates()
    {
        var existing = new[] { "belge.pdf", "belge (2).pdf" };

        var allocated = AttachmentNasPath.AllocateUniqueFileName("belge.pdf", existing);

        Assert.Equal("belge (3).pdf", allocated);
    }

    [Fact]
    public void BuildLegacyRelativePath_PreservesOldLayout()
    {
        var tenantId = Guid.Parse("b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e");
        var entityId = Guid.Parse("11111111-2222-3333-4444-555555555555");

        var path = AttachmentNasPath.BuildLegacyRelativePath(tenantId, "Job", entityId, "abc.pdf");

        Assert.Equal(
            "b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e/Job/11111111-2222-3333-4444-555555555555/abc.pdf",
            path);
    }

    [Fact]
    public void ToSmbPath_UsesBackslashes()
    {
        var smbPath = AttachmentNasPath.ToSmbPath("VT-2026-42/belge.pdf");

        Assert.Equal(@"VT-2026-42\belge.pdf", smbPath);
    }

    [Fact]
    public void ApplyRootFolder_PrefixesRelativePath()
    {
        var path = AttachmentNasPath.ApplyRootFolder("VT-2026-42/belge.pdf", "testtim");

        Assert.Equal("testtim/VT-2026-42/belge.pdf", path);
        Assert.Equal(@"testtim\VT-2026-42\belge.pdf", AttachmentNasPath.ToSmbPath(path));
    }
}

public sealed class JobRequestNumberFormatterTests
{
    [Fact]
    public void Format_CitizenRequest_UsesVtPrefix()
    {
        var formatted = JobRequestNumberFormatter.Format(
            JobRequestType.Citizen,
            JobSourceType.CitizenRequest,
            jobNumber: 99,
            jobNumberYear: 2026,
            citizenRequestNumber: 42,
            citizenRequestNumberYear: 2026);

        Assert.Equal("VT-2026-42", formatted);
    }

    [Fact]
    public void Format_InternalUnit_UsesTPrefix()
    {
        var formatted = JobRequestNumberFormatter.Format(
            JobRequestType.InternalUnit,
            JobSourceType.Manual,
            jobNumber: 15,
            jobNumberYear: 2026,
            citizenRequestNumber: null,
            citizenRequestNumberYear: null);

        Assert.Equal("T-2026-15", formatted);
    }
}

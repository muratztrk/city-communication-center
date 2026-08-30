using CityCommunicationCenter.Application.Features.CitizenMessageApprovals;
using CityCommunicationCenter.Domain.Entities;
using CityCommunicationCenter.Domain.Enums;
using CityCommunicationCenter.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using WorkflowTaskStatus = CityCommunicationCenter.Domain.Enums.TaskStatus;

namespace CityCommunicationCenter.Application.Tests.Features.CitizenMessageApprovals;

public sealed class CitizenMessageApprovalNoteResolverTests
{
    private static readonly Guid TenantId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static readonly Guid DepartmentId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");

    [Fact]
    public async Task Phone_operator_sms_note_edit_after_release_is_outbound_not_completion()
    {
        await using var db = CreateDbContext();
        var jobId = Guid.NewGuid();
        var taskId = Guid.NewGuid();
        var releasedAt = DateTimeOffset.UtcNow.AddMinutes(-10);
        db.AddRange(
            BuildCompletedJob(jobId, releasedAt),
            BuildCompletedTask(jobId, taskId, "operator notu"),
            BuildAudit(jobId, "CitizenMessageApprovalReleased", "yonetici notu", releasedAt),
            BuildAudit(jobId, "CitizenMessageApprovalCompletionNoteEdited", "operator notu", releasedAt.AddMinutes(5)));
        await db.SaveChangesAsync();

        var job = await db.Jobs.SingleAsync(j => j.JobId == jobId);
        var released = await CitizenMessageApprovalNoteResolver.ResolveReleasedApprovalNoteAsync(
            db, TenantId, jobId, CancellationToken.None);
        var outbound = await CitizenMessageApprovalNoteResolver.ResolveOutboundDisplayNoteAsync(
            db, TenantId, job, SocialChannel.Phone, Guid.NewGuid(), responseContent: null, CancellationToken.None);

        Assert.Equal("yonetici notu", released);
        Assert.Equal("operator notu", outbound);
    }

    [Fact]
    public async Task Phone_missing_released_audit_keeps_staff_completion_when_operator_overwrote_notes()
    {
        await using var db = CreateDbContext();
        var jobId = Guid.NewGuid();
        var taskId = Guid.NewGuid();
        var completedAt = DateTimeOffset.UtcNow.AddMinutes(-8);
        db.AddRange(
            BuildCompletedJob(jobId, DateTimeOffset.UtcNow.AddMinutes(-5)),
            BuildCompletedTask(jobId, taskId, "operator notu"),
            new AuditLog
            {
                AuditLogId = Guid.NewGuid(),
                TenantId = TenantId,
                EntityType = nameof(WorkTask),
                EntityId = taskId.ToString(),
                Action = "TaskCompleted",
                EventTimeUtc = completedAt,
                Notes = "personel notu",
                Details = "personel notu",
            },
            BuildAudit(jobId, "CitizenMessageApprovalCompletionNoteEdited", "operator notu", completedAt.AddMinutes(6)));
        await db.SaveChangesAsync();

        var job = await db.Jobs.SingleAsync(j => j.JobId == jobId);
        var released = await CitizenMessageApprovalNoteResolver.ResolveReleasedApprovalNoteAsync(
            db, TenantId, jobId, CancellationToken.None);
        var outbound = await CitizenMessageApprovalNoteResolver.ResolveOutboundDisplayNoteAsync(
            db, TenantId, job, SocialChannel.Phone, Guid.NewGuid(), responseContent: null, CancellationToken.None);

        Assert.Equal("personel notu", released);
        Assert.Equal("operator notu", outbound);
    }

    [Fact]
    public async Task Phone_manager_note_edit_before_release_is_not_outbound()
    {
        await using var db = CreateDbContext();
        var jobId = Guid.NewGuid();
        var releasedAt = DateTimeOffset.UtcNow.AddMinutes(-3);
        db.AddRange(
            BuildCompletedJob(jobId, releasedAt),
            BuildCompletedTask(jobId, Guid.NewGuid(), "yonetici notu"),
            BuildAudit(jobId, "CitizenMessageApprovalCompletionNoteEdited", "yonetici notu", releasedAt.AddMinutes(-2)),
            BuildAudit(jobId, "CitizenMessageApprovalReleased", "yonetici notu", releasedAt));
        await db.SaveChangesAsync();

        var job = await db.Jobs.SingleAsync(j => j.JobId == jobId);
        var outbound = await CitizenMessageApprovalNoteResolver.ResolveOutboundDisplayNoteAsync(
            db, TenantId, job, SocialChannel.Phone, Guid.NewGuid(), responseContent: null, CancellationToken.None);

        Assert.Null(outbound);
    }

    [Fact]
    public void ExtractTrailingTerminalNote_takes_last_blank_line_segment()
    {
        var sms = "VT-2026-1 no'lu Başlık talebinizin durumu \"Tamamlandı\".\n\nFen İşleri Müdürlüğü\n\nSahada tamamlandı.";
        Assert.Equal("Sahada tamamlandı.", CitizenMessageApprovalNoteResolver.ExtractTrailingTerminalNote(sms));
    }

    [Fact]
    public void ExtractTrailingTerminalNote_strips_auto_template_work_done_label()
    {
        var sms = "VT-2026-1 no'lu Başlık talebinizin durumu \"Tamamlandı\".\n\nYapılan İş: Uuuuuu";
        Assert.Equal("Uuuuuu", CitizenMessageApprovalNoteResolver.ExtractTrailingTerminalNote(sms));
    }

    [Fact]
    public void ExtractTrailingTerminalNote_strips_label_when_crlf_separates_segments()
    {
        var sms = "VT-2026-1 no'lu Başlık talebinizin durumu \"Tamamlandı\".\r\n\r\nYapılan İş: Uuuuuu";
        Assert.Equal("Uuuuuu", CitizenMessageApprovalNoteResolver.ExtractTrailingTerminalNote(sms));
    }

    [Fact]
    public void StripAutoTemplateNoteLabel_removes_work_done_prefix()
    {
        Assert.Equal("Uuuuuu", CitizenMessageApprovalNoteResolver.StripAutoTemplateNoteLabel("Yapılan İş: Uuuuuu"));
        Assert.Equal("Kapandı", CitizenMessageApprovalNoteResolver.StripAutoTemplateNoteLabel("İptal Nedeni: Kapandı"));
    }

    private static Job BuildCompletedJob(Guid jobId, DateTimeOffset releasedAt) => new()
    {
        JobId = jobId,
        TenantId = TenantId,
        Title = "Çağrı",
        Description = "Test",
        OwnerDepartmentId = DepartmentId,
        Status = JobStatus.Completed,
        RequestType = JobRequestType.Citizen,
        SourceType = JobSourceType.SocialMessage,
        CitizenTerminalMessageReleasedAtUtc = releasedAt,
        CompletionPercentage = 100,
    };

    private static WorkTask BuildCompletedTask(Guid jobId, Guid taskId, string notes) => new()
    {
        TaskId = taskId,
        TenantId = TenantId,
        JobId = jobId,
        Title = "Görev",
        Description = "Test",
        AssignedDepartmentId = DepartmentId,
        CurrentStatus = WorkflowTaskStatus.Completed,
        CompletedAtUtc = DateTimeOffset.UtcNow.AddMinutes(-20),
        Notes = notes,
        CompletionPercentage = 100,
    };

    private static AuditLog BuildAudit(Guid jobId, string action, string note, DateTimeOffset at) => new()
    {
        AuditLogId = Guid.NewGuid(),
        TenantId = TenantId,
        EntityType = nameof(Job),
        EntityId = jobId.ToString(),
        Action = action,
        EventTimeUtc = at,
        Notes = note,
        Details = note,
    };

    private static CityCommunicationCenterDbContext CreateDbContext() => new(
        new DbContextOptionsBuilder<CityCommunicationCenterDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);
}

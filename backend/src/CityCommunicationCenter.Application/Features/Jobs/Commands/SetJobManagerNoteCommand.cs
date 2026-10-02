using CityCommunicationCenter.Application.Abstractions;

namespace CityCommunicationCenter.Application.Features.Jobs;

/// <summary>
/// Birim müdürü/sorumlusunun talebe kendi "Yönetici Notu"nu eklemesi, değiştirmesi (Note dolu) veya
/// silmesi (Note boş). Her yönetici yalnız kendi notunu yönetir; farklı birimlerdeki yöneticiler de
/// aynı talebe not ekleyebilir (card 453 / #6abf44d1).
/// </summary>
public sealed record SetJobManagerNoteCommand(
    Guid JobId,
    Guid? ActorUserId,
    string? Note) : ICommand<bool>;

public sealed class SetJobManagerNoteCommandValidator : AbstractValidator<SetJobManagerNoteCommand>
{
    public SetJobManagerNoteCommandValidator()
    {
        RuleFor(command => command.Note)
            .MaximumLength(100)
            .WithMessage("Yönetici notu en fazla 100 karakter olabilir.");
    }
}

public sealed class SetJobManagerNoteCommandHandler : ICommandHandler<SetJobManagerNoteCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public SetJobManagerNoteCommandHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<bool> Handle(SetJobManagerNoteCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        var actor = await JobWorkflowAuthorization.RequireActorAsync(
            _dbContext, request.ActorUserId, tenantId, cancellationToken);

        if (actor.RoleCode is not (RoleCode.Manager or RoleCode.Reporter or RoleCode.SystemAdmin))
        {
            throw new ForbiddenAccessException("Yönetici notu ekleme yetkiniz yok.");
        }

        var job = await _dbContext.Jobs.FirstOrDefaultAsync(
            item => item.JobId == request.JobId && item.TenantId == tenantId,
            cancellationToken);
        if (job is null)
        {
            return false;
        }

        if (job.Status is JobStatus.Completed or JobStatus.Cancelled)
        {
            throw new ValidationException([
                new FluentValidation.Results.ValidationFailure(
                    nameof(request.JobId),
                    "Tamamlanmış veya iptal edilmiş taleplere yönetici notu eklenemez.")
            ]);
        }

        var note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim();
        var utcNow = DateTimeOffset.UtcNow;

        var allNotes = await _dbContext.JobManagerNotes
            .Where(item => item.JobId == job.JobId)
            .OrderBy(item => item.CreatedAtUtc)
            .ToListAsync(cancellationToken);
        var ownNote = allNotes.FirstOrDefault(item => item.AuthorUserId == actor.UserId);

        if (note is null)
        {
            if (ownNote is not null)
            {
                _dbContext.JobManagerNotes.Remove(ownNote);
                allNotes.Remove(ownNote);
            }
        }
        else if (ownNote is null)
        {
            var created = new JobManagerNote
            {
                NoteId = Guid.NewGuid(),
                TenantId = tenantId,
                JobId = job.JobId,
                AuthorUserId = actor.UserId,
                AuthorDisplayName = actor.DisplayName,
                Text = note,
                CreatedAtUtc = utcNow,
                CreatedByUserId = actor.UserId,
            };
            _dbContext.JobManagerNotes.Add(created);
            allNotes.Add(created);
        }
        else
        {
            ownNote.Text = note;
            ownNote.AuthorDisplayName = actor.DisplayName;
            ownNote.UpdatedAtUtc = utcNow;
            ownNote.UpdatedByUserId = actor.UserId;
        }

        // Job.ManagerNote, notları okuyan salt-okunur tüketiciler (görev detayı, yazdır, Belediye SOAP)
        // için "Ad · tarih / not" biçiminde birleşik metin olarak tutulur.
        job.ManagerNote = JobManagerNoteFormatter.Combine(allNotes);
        job.UpdatedAtUtc = utcNow;
        job.UpdatedByUserId = actor.UserId;

        // Göreve atanmış kullanıcı, yönetici notu eklendiğinde bildirim akışında bu
        // değişikliği görebilsin. Bildirim sorgusu denetim kayıtlarını kullanır.
        _dbContext.AuditLogs.Add(new AuditLog
        {
            AuditLogId = Guid.NewGuid(),
            TenantId = tenantId,
            EntityType = nameof(Job),
            EntityId = job.JobId.ToString(),
            Action = note is null ? "JobManagerNoteDeleted" : "JobManagerNoteAdded",
            ActorUserId = actor.UserId,
            ActorDisplayName = actor.DisplayName,
            StatusAtEvent = job.Status.ToString(),
            Notes = note,
            Details = note,
            EventTimeUtc = utcNow,
        });

        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }
}

public static class JobManagerNoteFormatter
{
    private static readonly TimeSpan TurkeyOffset = TimeSpan.FromHours(3);

    public static string? Combine(IReadOnlyCollection<JobManagerNote> notes)
    {
        if (notes.Count == 0)
        {
            return null;
        }

        return string.Join("\n\n", notes.Select(note =>
        {
            var when = (note.UpdatedAtUtc ?? note.CreatedAtUtc).ToOffset(TurkeyOffset);
            var author = string.IsNullOrWhiteSpace(note.AuthorDisplayName) ? "Yönetici" : note.AuthorDisplayName;
            return $"{author} · {when:dd.MM.yyyy HH:mm}\n{note.Text}";
        }));
    }
}

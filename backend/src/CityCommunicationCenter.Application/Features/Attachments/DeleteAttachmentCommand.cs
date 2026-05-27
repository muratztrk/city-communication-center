using Microsoft.Extensions.Options;

namespace CityCommunicationCenter.Application.Features.Attachments;

public sealed record DeleteAttachmentCommand(Guid AttachmentId, Guid? ActorUserId) : ICommand<bool>;

public sealed class DeleteAttachmentCommandHandler : ICommandHandler<DeleteAttachmentCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;
    private readonly string _uploadRootPath;

    public DeleteAttachmentCommandHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor,
        IOptions<AttachmentStorageOptions> options)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
        _uploadRootPath = options.Value.UploadRootPath;
    }

    public async ValueTask<bool> Handle(DeleteAttachmentCommand request, CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();

        var attachment = await _dbContext.Attachments
            .FirstOrDefaultAsync(a => a.AttachmentId == request.AttachmentId && a.TenantId == tenantId, cancellationToken);

        if (attachment is null) return false;

        var actor = await ActorAuthorization.RequireActiveActorAsync(_dbContext, request.ActorUserId, tenantId, cancellationToken);

        // Only the uploader, managers, or admins may delete
        if (actor.RoleCode is not (RoleCode.SystemAdmin or RoleCode.Manager)
            && attachment.CreatedByUserId != actor.UserId)
        {
            throw new ForbiddenAccessException("Bu eki silme yetkiniz yok.");
        }

        // Reconstruct physical path: uploadRootPath/{tenantId}/{entityType}/{entityId}/{storedFileName}
        var physicalPath = Path.Combine(
            _uploadRootPath,
            attachment.TenantId.ToString(),
            attachment.EntityType,
            attachment.EntityId.ToString(),
            attachment.StoredFileName);

        if (File.Exists(physicalPath))
        {
            File.Delete(physicalPath);
        }

        _dbContext.Attachments.Remove(attachment);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }
}

namespace CityCommunicationCenter.Application.Features.Me;

public sealed record DeleteUserQuickReplyTemplateCommand(Guid TemplateId) : ICommand<bool>;

public sealed class DeleteUserQuickReplyTemplateCommandHandler
    : ICommandHandler<DeleteUserQuickReplyTemplateCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public DeleteUserQuickReplyTemplateCommandHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<bool> Handle(DeleteUserQuickReplyTemplateCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        var userId = context.UserId ?? throw new ForbiddenAccessException("Oturum gerekli.");

        var template = await _dbContext.UserQuickReplyTemplates
            .FirstOrDefaultAsync(entity =>
                entity.TemplateId == request.TemplateId
                && entity.TenantId == tenantId
                && entity.UserId == userId,
                cancellationToken);

        if (template is null) return false;

        _dbContext.UserQuickReplyTemplates.Remove(template);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }
}

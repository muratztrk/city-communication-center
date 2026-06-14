namespace CityCommunicationCenter.Application.Features.Social;

public sealed record DeleteWhatsAppTemplateCommand(Guid TemplateId) : ICommand<bool>;

public sealed class DeleteWhatsAppTemplateCommandHandler : ICommandHandler<DeleteWhatsAppTemplateCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public DeleteWhatsAppTemplateCommandHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<bool> Handle(DeleteWhatsAppTemplateCommand request, CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();

        var template = await _dbContext.WhatsAppTemplates
            .FirstOrDefaultAsync(t => t.TemplateId == request.TemplateId && t.TenantId == tenantId, cancellationToken);

        if (template is null) return false;

        _dbContext.WhatsAppTemplates.Remove(template);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }
}

namespace CityCommunicationCenter.Application.Features.Me;

public sealed record SaveUserQuickReplyTemplateCommand(
    Guid? TemplateId,
    string Name,
    string Content) : ICommand<UserQuickReplyTemplateResponse>;

public sealed class SaveUserQuickReplyTemplateCommandValidator : AbstractValidator<SaveUserQuickReplyTemplateCommand>
{
    public SaveUserQuickReplyTemplateCommandValidator()
    {
        RuleFor(c => c.Name).NotEmpty().WithMessage("Şablon adı gereklidir.");
        RuleFor(c => c.Content).NotEmpty().WithMessage("Şablon içeriği gereklidir.");
    }
}

public sealed class SaveUserQuickReplyTemplateCommandHandler
    : ICommandHandler<SaveUserQuickReplyTemplateCommand, UserQuickReplyTemplateResponse>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public SaveUserQuickReplyTemplateCommandHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<UserQuickReplyTemplateResponse> Handle(
        SaveUserQuickReplyTemplateCommand request,
        CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        var userId = context.UserId ?? throw new ForbiddenAccessException("Oturum gerekli.");
        var name = request.Name.Trim();
        var content = request.Content.Trim();

        if (request.TemplateId.HasValue)
        {
            var existing = await _dbContext.UserQuickReplyTemplates
                .FirstOrDefaultAsync(entity =>
                    entity.TemplateId == request.TemplateId.Value
                    && entity.TenantId == tenantId
                    && entity.UserId == userId,
                    cancellationToken)
                ?? throw new ForbiddenAccessException("Bu şablon düzenlenemez.");

            existing.Name = name;
            existing.Content = content;
            existing.UpdatedByUserId = userId;
            existing.UpdatedAtUtc = DateTimeOffset.UtcNow;
            await _dbContext.SaveChangesAsync(cancellationToken);
            return new UserQuickReplyTemplateResponse(existing.TemplateId, existing.Name, existing.Content);
        }

        var template = new UserQuickReplyTemplate
        {
            TemplateId = Guid.NewGuid(),
            TenantId = tenantId,
            UserId = userId,
            Name = name,
            Content = content,
            CreatedByUserId = userId,
            UpdatedByUserId = userId,
        };
        _dbContext.UserQuickReplyTemplates.Add(template);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return new UserQuickReplyTemplateResponse(template.TemplateId, template.Name, template.Content);
    }
}

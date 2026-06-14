using System.Text.Json;

namespace CityCommunicationCenter.Application.Features.Social;

/// <summary>Create (TemplateId == null) or update (TemplateId provided) a template.</summary>
public sealed record SaveWhatsAppTemplateCommand(
    Guid? TemplateId,
    Guid ActorUserId,
    WhatsAppMessageTemplateRequest Data) : ICommand<Guid>;

public sealed class SaveWhatsAppTemplateCommandHandler : ICommandHandler<SaveWhatsAppTemplateCommand, Guid>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public SaveWhatsAppTemplateCommandHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<Guid> Handle(SaveWhatsAppTemplateCommand request, CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();
        var keywordsJson = JsonSerializer.Serialize(request.Data.Keywords ?? []);

        if (request.TemplateId.HasValue)
        {
            var existing = await _dbContext.WhatsAppTemplates
                .FirstOrDefaultAsync(t => t.TemplateId == request.TemplateId.Value && t.TenantId == tenantId, cancellationToken);

            if (existing is null)
                throw new KeyNotFoundException($"Template {request.TemplateId} not found.");

            existing.Name = request.Data.Name.Trim();
            existing.Content = request.Data.Content.Trim();
            existing.IsActive = request.Data.IsActive;
            existing.Channel = request.Data.Channel;
            existing.IsGeneral = request.Data.IsGeneral;
            existing.AutoReply = request.Data.AutoReply;
            existing.ReplyDelaySecs = request.Data.ReplyDelaySecs;
            existing.HasKeyword = request.Data.HasKeyword;
            existing.QueryType = request.Data.QueryType;
            existing.KeywordsJson = keywordsJson;
            existing.UpdatedByUserId = request.ActorUserId;

            await _dbContext.SaveChangesAsync(cancellationToken);
            return existing.TemplateId;
        }
        else
        {
            var template = new WhatsAppMessageTemplate
            {
                TemplateId = Guid.NewGuid(),
                TenantId = tenantId,
                Name = request.Data.Name.Trim(),
                Content = request.Data.Content.Trim(),
                IsActive = request.Data.IsActive,
                Channel = request.Data.Channel,
                IsGeneral = request.Data.IsGeneral,
                AutoReply = request.Data.AutoReply,
                ReplyDelaySecs = request.Data.ReplyDelaySecs,
                HasKeyword = request.Data.HasKeyword,
                QueryType = request.Data.QueryType,
                KeywordsJson = keywordsJson,
                CreatedByUserId = request.ActorUserId,
            };
            _dbContext.WhatsAppTemplates.Add(template);
            await _dbContext.SaveChangesAsync(cancellationToken);
            return template.TemplateId;
        }
    }
}

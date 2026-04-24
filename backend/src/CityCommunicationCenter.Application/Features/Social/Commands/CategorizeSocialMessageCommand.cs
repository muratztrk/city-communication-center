
namespace CityCommunicationCenter.Application.Features.Social;

public sealed record CategorizeSocialMessageCommand(Guid MessageId, Guid? ActorUserId, string Category, IReadOnlyCollection<string> Tags) : ICommand<bool>;

public sealed class CategorizeSocialMessageCommandValidator : AbstractValidator<CategorizeSocialMessageCommand>
{
    public CategorizeSocialMessageCommandValidator()
    {
        RuleFor(command => command.Category)
            .NotEmpty()
            .WithMessage("Kategori zorunludur.");
    }
}

public sealed class CategorizeSocialMessageCommandHandler : ICommandHandler<CategorizeSocialMessageCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public CategorizeSocialMessageCommandHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<bool> Handle(CategorizeSocialMessageCommand request, CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();
        var actor = await ActorAuthorization.RequireActiveActorAsync(_dbContext, request.ActorUserId, tenantId, cancellationToken);
        var message = await _dbContext.SocialMessages.FirstOrDefaultAsync(
            entity => entity.SocialMessageId == request.MessageId && entity.TenantId == tenantId,
            cancellationToken);
        if (message is null)
        {
            return false;
        }

        message.Category = request.Category.Trim();
        message.Tags = string.Join(';', request.Tags);
        message.Status = SocialMessageStatus.Categorized;
        message.UpdatedByUserId = actor.UserId;
        message.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _dbContext.SaveChangesAsync(cancellationToken);

        return true;
    }
}
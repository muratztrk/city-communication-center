
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

public sealed class CategorizeSocialMessageCommandHandler : IRequestHandler<CategorizeSocialMessageCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;

    public CategorizeSocialMessageCommandHandler(IApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<bool> Handle(CategorizeSocialMessageCommand request, CancellationToken cancellationToken)
    {
        var message = await _dbContext.SocialMessages.FirstOrDefaultAsync(entity => entity.SocialMessageId == request.MessageId, cancellationToken);
        if (message is null)
        {
            return false;
        }

        message.Category = request.Category.Trim();
        message.Tags = string.Join(';', request.Tags);
        message.Status = SocialMessageStatus.Categorized;
        message.UpdatedByUserId = request.ActorUserId;
        message.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _dbContext.SaveChangesAsync(cancellationToken);

        return true;
    }
}
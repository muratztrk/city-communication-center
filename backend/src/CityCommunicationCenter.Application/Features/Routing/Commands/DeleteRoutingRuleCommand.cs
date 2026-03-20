
namespace CityCommunicationCenter.Application.Features.Routing;

public sealed record DeleteRoutingRuleCommand(Guid RuleId) : ICommand<bool>;

public sealed class DeleteRoutingRuleCommandHandler : IRequestHandler<DeleteRoutingRuleCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;

    public DeleteRoutingRuleCommandHandler(IApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<bool> Handle(DeleteRoutingRuleCommand request, CancellationToken cancellationToken)
    {
        var existing = await _dbContext.RoutingRules.FirstOrDefaultAsync(entity => entity.RuleId == request.RuleId, cancellationToken);
        if (existing is null)
        {
            return false;
        }

        _dbContext.RoutingRules.Remove(existing);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }
}
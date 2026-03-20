
namespace CityCommunicationCenter.Application.Features.Routing;

public sealed record UpdateRoutingRuleCommand(Guid RuleId, string RuleName, string Keywords, Guid TargetDepartmentId, int Priority, bool IsActive) : ICommand<bool>;

public sealed class UpdateRoutingRuleCommandValidator : AbstractValidator<UpdateRoutingRuleCommand>
{
    public UpdateRoutingRuleCommandValidator()
    {
        RuleFor(command => command.RuleName)
            .NotEmpty()
            .WithMessage("Kural adi zorunludur.");
        RuleFor(command => command.Keywords)
            .NotEmpty()
            .WithMessage("Anahtar kelime listesi zorunludur.");
        RuleFor(command => command.TargetDepartmentId)
            .NotEmpty();
    }
}

public sealed class UpdateRoutingRuleCommandHandler : IRequestHandler<UpdateRoutingRuleCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;

    public UpdateRoutingRuleCommandHandler(IApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<bool> Handle(UpdateRoutingRuleCommand request, CancellationToken cancellationToken)
    {
        var existing = await _dbContext.RoutingRules.FirstOrDefaultAsync(entity => entity.RuleId == request.RuleId, cancellationToken);
        if (existing is null)
        {
            return false;
        }

        existing.RuleName = request.RuleName.Trim();
        existing.Keywords = request.Keywords.Trim();
        existing.TargetDepartmentId = request.TargetDepartmentId;
        existing.Priority = request.Priority;
        existing.IsActive = request.IsActive;

        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }
}
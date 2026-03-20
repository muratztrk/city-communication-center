
namespace CityCommunicationCenter.Application.Features.Routing;

public sealed record CreateRoutingRuleCommand(string RuleName, string Keywords, Guid TargetDepartmentId, int Priority) : ICommand<RoutingRuleResponse>;

public sealed class CreateRoutingRuleCommandValidator : AbstractValidator<CreateRoutingRuleCommand>
{
    public CreateRoutingRuleCommandValidator()
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

public sealed class CreateRoutingRuleCommandHandler : IRequestHandler<CreateRoutingRuleCommand, RoutingRuleResponse>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public CreateRoutingRuleCommandHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async Task<RoutingRuleResponse> Handle(CreateRoutingRuleCommand request, CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().TenantId!.Value;
        var rule = new RoutingRule
        {
            RuleId = Guid.NewGuid(),
            TenantId = tenantId,
            RuleName = request.RuleName.Trim(),
            Keywords = request.Keywords.Trim(),
            TargetDepartmentId = request.TargetDepartmentId,
            Priority = request.Priority,
            IsActive = true
        };

        _dbContext.RoutingRules.Add(rule);
        await _dbContext.SaveChangesAsync(cancellationToken);
        var departmentName = await _dbContext.Departments
            .Where(entity => entity.DepartmentId == rule.TargetDepartmentId)
            .Select(entity => entity.Name)
            .FirstOrDefaultAsync(cancellationToken);

        return new RoutingRuleResponse(
            rule.RuleId,
            rule.RuleName,
            rule.Keywords,
            rule.TargetDepartmentId,
            departmentName ?? "Bilinmeyen",
            rule.Priority,
            rule.IsActive);
    }
}
namespace CityCommunicationCenter.Application.Features.Support;

public sealed record SubmitSupportRequestCommand(
    string Subject,
    string Message,
    string? PageContext) : ICommand<Guid>;

public sealed class SubmitSupportRequestCommandValidator : AbstractValidator<SubmitSupportRequestCommand>
{
    public SubmitSupportRequestCommandValidator()
    {
        RuleFor(command => command.Subject)
            .NotEmpty().WithMessage("Konu zorunludur.")
            .MaximumLength(200).WithMessage("Konu en fazla 200 karakter olabilir.");
        RuleFor(command => command.Message)
            .NotEmpty().WithMessage("Mesaj zorunludur.")
            .MaximumLength(4000).WithMessage("Mesaj en fazla 4000 karakter olabilir.");
        RuleFor(command => command.PageContext)
            .MaximumLength(500).WithMessage("Sayfa bilgisi en fazla 500 karakter olabilir.");
    }
}

public sealed class SubmitSupportRequestCommandHandler : ICommandHandler<SubmitSupportRequestCommand, Guid>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public SubmitSupportRequestCommandHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<Guid> Handle(SubmitSupportRequestCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();

        var supportRequest = new SupportRequest
        {
            SupportRequestId = Guid.NewGuid(),
            TenantId = tenantId,
            Subject = request.Subject.Trim(),
            Message = request.Message.Trim(),
            PageContext = request.PageContext?.Trim(),
            CreatedByUserId = context.UserId,
        };

        _dbContext.SupportRequests.Add(supportRequest);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return supportRequest.SupportRequestId;
    }
}

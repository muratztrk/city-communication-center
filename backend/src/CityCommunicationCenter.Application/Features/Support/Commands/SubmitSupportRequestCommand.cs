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
    private readonly ILumespecSupportClient _lumespecSupportClient;

    public SubmitSupportRequestCommandHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor,
        ILumespecSupportClient lumespecSupportClient)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
        _lumespecSupportClient = lumespecSupportClient;
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

        var tenantName = await _dbContext.Tenants
            .Where(tenant => tenant.TenantId == tenantId)
            .Select(tenant => tenant.DisplayName != string.Empty ? tenant.DisplayName : tenant.MunicipalityName)
            .FirstOrDefaultAsync(cancellationToken);

        var requester = context.UserId.HasValue
            ? await _dbContext.Users
                .Where(user => user.UserId == context.UserId.Value)
                .Select(user => new { user.DisplayName, user.Email })
                .FirstOrDefaultAsync(cancellationToken)
            : null;

        var centralTicket = await _lumespecSupportClient.CreateTicketAsync(
            new CreateCentralSupportTicketRequest(
                supportRequest.SupportRequestId,
                tenantId,
                tenantName,
                context.UserId,
                requester?.DisplayName ?? "CCC Kullanıcısı",
                requester?.Email,
                supportRequest.Subject,
                supportRequest.Message,
                supportRequest.PageContext),
            cancellationToken);

        if (centralTicket is not null)
        {
            supportRequest.CentralTicketNo = centralTicket.TicketNo;
            supportRequest.CentralStatus = centralTicket.Status;
            supportRequest.CentralSyncedAtUtc = DateTimeOffset.UtcNow;
            supportRequest.CentralSyncError = null;
            await _dbContext.SaveChangesAsync(cancellationToken);
        }
        else
        {
            supportRequest.CentralSyncError = "Merkezi Lumespec destek sistemine gönderilemedi.";
            await _dbContext.SaveChangesAsync(cancellationToken);
        }

        return supportRequest.SupportRequestId;
    }
}

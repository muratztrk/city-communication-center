namespace CityCommunicationCenter.Application.Features.Auth;

public sealed record RevokeMobileSessionCommand(Guid UserId, Guid TenantId) : ICommand<Unit>;

public sealed class RevokeMobileSessionCommandHandler : ICommandHandler<RevokeMobileSessionCommand, Unit>
{
    private readonly IApplicationDbContext _dbContext;

    public RevokeMobileSessionCommandHandler(IApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async ValueTask<Unit> Handle(RevokeMobileSessionCommand request, CancellationToken cancellationToken)
    {
        var user = await _dbContext.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(entity => entity.UserId == request.UserId && entity.TenantId == request.TenantId, cancellationToken);
        if (user is null)
        {
            return Unit.Value;
        }

        user.MobileSessionId = null;
        await _dbContext.SaveChangesAsync(cancellationToken);
        return Unit.Value;
    }
}

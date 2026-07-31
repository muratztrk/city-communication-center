namespace CityCommunicationCenter.Application.Features.Auth;

public sealed record AuthenticateUserCommand(
    string Username,
    string Password,
    string TenantId,
    bool ConfirmEndExistingSession = false) : ICommand<AuthenticatedTokenPayload?>;

public sealed class AuthenticateUserCommandValidator : AbstractValidator<AuthenticateUserCommand>
{
    public AuthenticateUserCommandValidator()
    {
        RuleFor(command => command.Username)
            .NotEmpty()
            .WithMessage("Kullanici adi zorunludur.");
        RuleFor(command => command.Password)
            .NotEmpty()
            .WithMessage("Sifre zorunludur.");
        RuleFor(command => command.TenantId)
            .NotEmpty()
            .Must(value => Guid.TryParse(value, out _))
            .WithMessage("Gecerli bir belediye secimi yapilmalidir.");
    }
}

public sealed class AuthenticateUserCommandHandler : ICommandHandler<AuthenticateUserCommand, AuthenticatedTokenPayload?>
{
    private readonly IUserAuthenticationService _userAuthenticationService;
    private readonly IApplicationDbContext _dbContext;

    public AuthenticateUserCommandHandler(
        IUserAuthenticationService userAuthenticationService,
        IApplicationDbContext dbContext)
    {
        _userAuthenticationService = userAuthenticationService;
        _dbContext = dbContext;
    }

    public async ValueTask<AuthenticatedTokenPayload?> Handle(AuthenticateUserCommand request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.TenantId, out var tenantId))
        {
            return null;
        }

        var user = await _userAuthenticationService.AuthenticateAsync(tenantId, request.Username.Trim(), request.Password, cancellationToken);
        if (user is null)
        {
            return null;
        }

        var entity = await _dbContext.Users
            .FirstOrDefaultAsync(u => u.UserId == user.UserId && u.TenantId == user.TenantId, cancellationToken);
        if (entity is null)
        {
            return null;
        }

        // Açık oturum varken yeni login — önce onay (#6a6c805e).
        if (entity.ActiveSessionId.HasValue && !request.ConfirmEndExistingSession)
        {
            throw new ExistingSessionConflictException();
        }

        var activeSessionId = Guid.NewGuid();
        entity.ActiveSessionId = activeSessionId;
        entity.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _dbContext.SaveChangesAsync(cancellationToken);

        return new AuthenticatedTokenPayload(
            user.UserId,
            user.TenantId,
            user.DepartmentId,
            user.Username,
            user.DisplayName,
            user.Email,
            user.RoleCode,
            user.AdditionalRoleCodes,
            user.TenantName,
            user.AuthenticationMode,
            activeSessionId);
    }
}

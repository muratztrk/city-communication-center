using System.Security.Cryptography;
using FluentValidation.Results;
using Microsoft.Extensions.Localization;

namespace CityCommunicationCenter.Application.Features.Auth;

public sealed record ResetLocalUserPasswordCommand(
    string TenantId,
    string Email) : ICommand<Unit>;

public sealed class ResetLocalUserPasswordCommandValidator : AbstractValidator<ResetLocalUserPasswordCommand>
{
    public ResetLocalUserPasswordCommandValidator(IStringLocalizer<ApplicationResource> localizer)
    {
        RuleFor(command => command.TenantId)
            .NotEmpty()
            .Must(value => Guid.TryParse(value, out _))
            .WithMessage(localizer["ValidationTenantRequired"]);

        RuleFor(command => command.Email)
            .NotEmpty()
            .EmailAddress()
            .WithMessage(localizer["ValidationPasswordResetEmailRequired"]);
    }
}

public sealed class ResetLocalUserPasswordCommandHandler : ICommandHandler<ResetLocalUserPasswordCommand, Unit>
{
    // Karışıklık yaratabilecek karakterler (O/0, l/1 vb.) hariç tutuldu.
    private const string LowercaseChars = "abcdefghijkmnpqrstuvwxyz";
    private const string UppercaseChars = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    private const string DigitChars = "23456789";
    private const string SpecialChars = "!@#$%*?-_";
    private const int GeneratedPasswordLength = 14;

    private readonly IApplicationDbContext _dbContext;
    private readonly ILocalUserPasswordService _localUserPasswordService;
    private readonly IPasswordResetEmailSender _emailSender;
    private readonly IStringLocalizer<ApplicationResource> _localizer;

    public ResetLocalUserPasswordCommandHandler(
        IApplicationDbContext dbContext,
        ILocalUserPasswordService localUserPasswordService,
        IPasswordResetEmailSender emailSender,
        IStringLocalizer<ApplicationResource> localizer)
    {
        _dbContext = dbContext;
        _localUserPasswordService = localUserPasswordService;
        _emailSender = emailSender;
        _localizer = localizer;
    }

    public async ValueTask<Unit> Handle(ResetLocalUserPasswordCommand request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.TenantId, out var tenantId) || tenantId == Guid.Empty)
        {
            throw new ValidationException(
            [
                new ValidationFailure(nameof(request.TenantId), _localizer["ValidationTenantRequired"])
            ]);
        }

        var email = request.Email.Trim();
        var normalizedEmail = email.ToLowerInvariant();

        // İstek kimlik doğrulaması yapılmadan geldiği için global tenant filtresine güvenmeyip
        // tenant'ı açıkça filtreliyoruz.
        var matchingUsers = await _dbContext.Users
            .IgnoreQueryFilters()
            .Where(user =>
                user.TenantId == tenantId
                && user.IsActive
                && user.Email != null
                && user.Email.ToLower() == normalizedEmail)
            .ToListAsync(cancellationToken);

        // Hesap numaralandırmasını önlemek için: eşleşen kullanıcı yoksa sessizce başarı dön.
        if (matchingUsers.Count == 0)
        {
            return Unit.Value;
        }

        var localUser = matchingUsers.FirstOrDefault(user => user.UserSource == UserSource.Manual);
        if (localUser is null)
        {
            // Kullanıcı var ama yerel değil (ör. LDAP) → kartta istenen uyarı.
            throw new ValidationException(
            [
                new ValidationFailure(nameof(request.Email), _localizer["ValidationPasswordResetNotLocal"])
            ]);
        }

        var newPassword = GeneratePassword();

        // Önce e-postayı göndermeyi dene; başarısızsa parolayı DEĞİŞTİRME (kullanıcı kilitlenmesin).
        var delivered = await _emailSender.SendNewPasswordAsync(
            tenantId,
            localUser.Email!,
            localUser.DisplayName,
            newPassword,
            cancellationToken);

        if (!delivered)
        {
            throw new ValidationException(
            [
                new ValidationFailure(nameof(request.Email), _localizer["ValidationPasswordResetEmailFailed"])
            ]);
        }

        localUser.PasswordHash = _localUserPasswordService.HashPassword(localUser, newPassword);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return Unit.Value;
    }

    // PasswordPolicy'i karşılaması için her kategoriden en az bir karakter garanti edilir.
    private static string GeneratePassword()
    {
        var all = LowercaseChars + UppercaseChars + DigitChars + SpecialChars;
        var chars = new List<char>(GeneratedPasswordLength)
        {
            LowercaseChars[RandomNumberGenerator.GetInt32(LowercaseChars.Length)],
            UppercaseChars[RandomNumberGenerator.GetInt32(UppercaseChars.Length)],
            DigitChars[RandomNumberGenerator.GetInt32(DigitChars.Length)],
            SpecialChars[RandomNumberGenerator.GetInt32(SpecialChars.Length)],
        };

        while (chars.Count < GeneratedPasswordLength)
        {
            chars.Add(all[RandomNumberGenerator.GetInt32(all.Length)]);
        }

        // Sabit kategori sıralamasını bozmak için kriptografik Fisher-Yates karıştırma.
        for (var i = chars.Count - 1; i > 0; i--)
        {
            var j = RandomNumberGenerator.GetInt32(i + 1);
            (chars[i], chars[j]) = (chars[j], chars[i]);
        }

        return new string(chars.ToArray());
    }
}

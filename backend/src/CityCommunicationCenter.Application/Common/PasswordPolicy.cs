namespace CityCommunicationCenter.Application.Common;

/// <summary>
/// Local-user password complexity policy: at least 8 characters with an
/// uppercase letter, a lowercase letter, a digit and a special character.
/// </summary>
public static class PasswordPolicy
{
    public const int MinimumLength = 8;

    public static bool IsStrong(string? password)
    {
        if (string.IsNullOrWhiteSpace(password) || password.Length < MinimumLength)
        {
            return false;
        }

        var hasUpper = false;
        var hasLower = false;
        var hasDigit = false;
        var hasSpecial = false;

        foreach (var ch in password)
        {
            if (char.IsUpper(ch)) hasUpper = true;
            else if (char.IsLower(ch)) hasLower = true;
            else if (char.IsDigit(ch)) hasDigit = true;
            else hasSpecial = true;
        }

        return hasUpper && hasLower && hasDigit && hasSpecial;
    }
}

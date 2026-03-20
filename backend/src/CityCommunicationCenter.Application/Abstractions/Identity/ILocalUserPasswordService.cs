namespace CityCommunicationCenter.Application.Abstractions.Identity;

public interface ILocalUserPasswordService
{
    string HashPassword(ApplicationUser user, string password);

    bool VerifyPassword(ApplicationUser user, string password);
}
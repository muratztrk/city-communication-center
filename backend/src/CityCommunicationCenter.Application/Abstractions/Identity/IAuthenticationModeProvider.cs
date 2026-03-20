namespace CityCommunicationCenter.Application.Abstractions.Identity;

public interface IAuthenticationModeProvider
{
    string GetBootstrapAuthMode();
}
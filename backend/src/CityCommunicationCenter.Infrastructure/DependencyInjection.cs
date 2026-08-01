using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Application.Abstractions.BelediyeSoap;
using CityCommunicationCenter.Infrastructure.BelediyeSoap;
using CityCommunicationCenter.Infrastructure.Persistence.Interceptors;
using CityCommunicationCenter.Infrastructure.Services;
using CityCommunicationCenter.Infrastructure.Sms;
using CityCommunicationCenter.Infrastructure.SocialMedia;
using CityCommunicationCenter.Infrastructure.Tenancy;

namespace CityCommunicationCenter.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructureServices(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.Configure<TenantResolutionOptions>(
            configuration.GetSection(TenantResolutionOptions.SectionName));
        services.Configure<AuthenticationOptions>(
            configuration.GetSection(AuthenticationOptions.SectionName));

        services.AddHttpContextAccessor();
        services.AddMemoryCache();
        services.AddScoped<ITenantContextAccessor, HttpTenantContextAccessor>();
        
        var connectionString = configuration.GetConnectionString("CityCommunicationCenter");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException("Connection string 'CityCommunicationCenter' must be configured.");
        }

        services.AddSingleton<AuditLogSyslogInterceptor>();
        services.AddDbContext<CityCommunicationCenterDbContext>((serviceProvider, options) =>
        {
            options.UseNpgsql(connectionString);
            options.AddInterceptors(serviceProvider.GetRequiredService<AuditLogSyslogInterceptor>());
        });
        services.AddScoped<IApplicationDbContext>(serviceProvider => serviceProvider.GetRequiredService<CityCommunicationCenterDbContext>());

        // Social Media Services
        services.AddHttpClient();
        services.AddScoped<ISocialMediaSettingsProvider, DatabaseSocialMediaSettingsProvider>();
        services.AddScoped<ISocialMediaClientFactory, SocialMediaClientFactory>();
        services.AddScoped<ISocialMediaService, SocialMediaService>();
        services.AddSingleton<IWhatsAppTemplateAutoReplyService, WhatsAppTemplateAutoReplyService>();

        // Routing Service
        services.AddScoped<IRoutingService, RoutingService>();
        services.AddScoped<ITenantAppearanceService, TenantAppearanceService>();
        services.AddScoped<ITenantWorkingHoursService, TenantWorkingHoursService>();
        services.AddScoped<ITenantSmsSettingsService, TenantSmsSettingsService>();

        // SMS gateway: sağlayıcıya göre seçilen gönderici + ayrı timeout'lu HttpClient.
        // RemoveAllLoggers ŞART: jeTTMesaj API'si parolayı query string'de taşıyor ve
        // HttpClient'ın varsayılan logger'ı istek URI'sini olduğu gibi loga yazıyor.
        services.AddHttpClient(SmsHttpClient.Name, client => client.Timeout = TimeSpan.FromSeconds(30))
            .RemoveAllLoggers();
        services.AddScoped<ISmsProviderSender, JettMesajSmsSender>();
        services.AddScoped<ISmsProviderSender, AsistelSmsSender>();
        services.AddScoped<ISmsGateway, SmsGateway>();
        services.AddScoped<ICitizenJobStatusNotifier, CitizenJobStatusNotifier>();
        services.AddScoped<ITenantFileStorageSettingsService, TenantFileStorageSettingsService>();
        services.AddScoped<ISyslogForwarderService, SyslogForwarderService>();
        services.AddScoped<ISlaCalculatorService, SlaCalculatorService>();
        services.AddScoped<ITenantLdapSettingsService, TenantLdapSettingsService>();
        services.AddScoped<ITenantAuthenticationPolicyService, TenantAuthenticationPolicyService>();
        services.AddScoped<ILdapAuthenticationService, LdapAuthenticationService>();
        services.AddScoped<IAuthenticationExchangeTicketService, AuthenticationExchangeTicketService>();
        services.AddScoped<IInteractiveAuthenticationService, InteractiveAuthenticationService>();
        services.AddSingleton<ILocalUserPasswordService, LocalUserPasswordService>();
        services.AddScoped<IPasswordResetEmailSender, SocialEmailPasswordResetSender>();
        services.AddScoped<IUserAuthenticationService, UserAuthenticationService>();
        services.AddScoped<IAuthenticationModeProvider, UserAuthenticationService>();
        services.AddScoped<IUserManagementConfigurationProvider, UserAuthenticationService>();

        services.AddScoped<IBelediyeSoapOperations, BelediyeSoapOperations>();

        return services;
    }
}

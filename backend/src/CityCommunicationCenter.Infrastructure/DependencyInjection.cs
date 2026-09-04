using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Application.Abstractions.BelediyeSoap;
using CityCommunicationCenter.Application.Abstractions.Identity;
using CityCommunicationCenter.Infrastructure.BelediyeSoap;
using CityCommunicationCenter.Infrastructure.FileStorage;
using CityCommunicationCenter.Infrastructure.Licensing;
using CityCommunicationCenter.Infrastructure.Persistence.Interceptors;
using CityCommunicationCenter.Infrastructure.Services;
using CityCommunicationCenter.Infrastructure.Sms;
using CityCommunicationCenter.Infrastructure.SocialMedia;
using CityCommunicationCenter.Infrastructure.Security;
using CityCommunicationCenter.Infrastructure.Options;
using CityCommunicationCenter.Infrastructure.Tenancy;
using Microsoft.Extensions.Options;

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
        services.Configure<LicensingOptions>(
            configuration.GetSection(LicensingOptions.SectionName));
        services.Configure<GoogleMapsOptions>(configuration.GetSection(GoogleMapsOptions.SectionName));
        services.Configure<RecaptchaOptions>(
            configuration.GetSection(RecaptchaOptions.SectionName));
        services.Configure<SmsOptions>(configuration.GetSection(SmsOptions.SectionName));

        services.AddHttpContextAccessor();
        services.AddMemoryCache();
        services.AddScoped<ITenantContextAccessor, HttpTenantContextAccessor>();
        
        var connectionString = configuration.GetConnectionString("CityCommunicationCenter");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException("Connection string 'CityCommunicationCenter' must be configured.");
        }

        services.AddSingleton<AuditLogSyslogInterceptor>();
        services.AddSingleton<IInternalTypingStateCache, InternalTypingStateCache>();
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
        services.AddScoped<ISmsOutboundLogWriter, SmsOutboundLogWriter>();
        services.AddScoped<ICitizenJobStatusNotifier, CitizenJobStatusNotifier>();
        services.AddScoped<IAfterHoursJobSmsNotifier, AfterHoursJobSmsNotifier>();
        services.AddScoped<ITenantFileStorageSettingsService, TenantFileStorageSettingsService>();
        services.AddScoped<INasConnectivityTester, SmbNasConnectivityTester>();
        services.AddScoped<INasAttachmentStorage, SmbNasAttachmentStorage>();
        services.AddScoped<IAttachmentContentProvider, AttachmentContentProvider>();
        services.AddScoped<ISyslogForwarderService, SyslogForwarderService>();
        services.AddScoped<ISlaCalculatorService, SlaCalculatorService>();
        services.AddScoped<ITenantLdapSettingsService, TenantLdapSettingsService>();
        services.AddScoped<ITenantAuthenticationPolicyService, TenantAuthenticationPolicyService>();
        services.AddScoped<ILdapAuthenticationService, LdapAuthenticationService>();
        services.AddScoped<IAuthenticationExchangeTicketService, AuthenticationExchangeTicketService>();
        services.AddScoped<IInteractiveAuthenticationService, InteractiveAuthenticationService>();
        services.AddScoped<IRequestNetworkEvaluator, RequestNetworkEvaluator>();
        services.AddSingleton<IRecaptchaVerificationService, RecaptchaVerificationService>();
        services.AddHttpClient(nameof(RecaptchaVerificationService), client => client.Timeout = TimeSpan.FromSeconds(10));
        services.AddSingleton<ILocalUserPasswordService, LocalUserPasswordService>();
        services.AddScoped<IPasswordResetEmailSender, SocialEmailPasswordResetSender>();
        services.AddScoped<IUserAuthenticationService, UserAuthenticationService>();
        services.AddScoped<IAuthenticationModeProvider, UserAuthenticationService>();
        services.AddScoped<IUserManagementConfigurationProvider, UserAuthenticationService>();

        services.AddScoped<IBelediyeSoapOperations, BelediyeSoapOperations>();

        services.AddHttpClient(IzmirCbsAddressCatalog.HttpClientName, client =>
        {
            client.Timeout = TimeSpan.FromSeconds(15);
            client.DefaultRequestHeaders.TryAddWithoutValidation(
                "User-Agent",
                "Mozilla/5.0 CityCommunicationCenter");
        });
        services.AddScoped<IIzmirCbsAddressCatalog, IzmirCbsAddressCatalog>();

        services.AddHttpClient(GoogleMapsLinkResolver.HttpClientName, client =>
        {
            client.Timeout = TimeSpan.FromSeconds(8);
            client.DefaultRequestHeaders.TryAddWithoutValidation(
                "User-Agent",
                "Mozilla/5.0 CityCommunicationCenter");
        }).ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false });
        services.AddScoped<IGoogleMapsLinkResolver, GoogleMapsLinkResolver>();
        services.AddHttpClient(GoogleMapsGeocodingService.HttpClientName, client =>
        {
            client.Timeout = TimeSpan.FromSeconds(8);
            client.BaseAddress = new Uri("https://maps.googleapis.com/");
        });
        services.AddScoped<IGoogleMapsGeocodingService, GoogleMapsGeocodingService>();

        // Lisans modülleri: lumespec-license'a (bkz. ~/Works/lumespec-license) tenant+modül başına soru sorar.
        services.AddHttpClient(LicenseHttpClient.Name, (serviceProvider, client) =>
        {
            var licensingOptions = serviceProvider.GetRequiredService<IOptions<LicensingOptions>>().Value;
            client.Timeout = TimeSpan.FromSeconds(Math.Max(1, licensingOptions.TimeoutSeconds));
        });
        services.AddSingleton<ILicenseTokenVerifier, LicenseTokenVerifier>();
        services.AddSingleton<IRemoteLicenseTokenClient, RemoteLicenseTokenClient>();
        services.AddScoped<ILicenseModuleStatusService, LicenseModuleStatusService>();

        return services;
    }
}

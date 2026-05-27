using System.Threading.RateLimiting;
using System.Globalization;
using System.Net;
using CityCommunicationCenter.Application;
using CityCommunicationCenter.Api.Hubs;
using CityCommunicationCenter.Api.Services;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using CityCommunicationCenter.Api.Middleware;
using CityCommunicationCenter.Infrastructure;
using CityCommunicationCenter.Infrastructure.Persistence;
using Microsoft.AspNetCore.Localization;
using OpenIddict.Validation.AspNetCore;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);
const string OpenCorsPolicy = "OpenCorsPolicy";

Directory.CreateDirectory(Path.Combine(builder.Environment.ContentRootPath, "logs"));

builder.Host.UseSerilog((context, services, loggerConfiguration) => loggerConfiguration
    .ReadFrom.Configuration(context.Configuration)
    .ReadFrom.Services(services)
    .Enrich.FromLogContext());

builder.Services.AddLocalization(options => options.ResourcesPath = "Resources");

var supportedCultures = new[]
{
    new CultureInfo("tr"),
    new CultureInfo("en")
};

builder.Services.Configure<RequestLocalizationOptions>(options =>
{
    options.DefaultRequestCulture = new RequestCulture("tr");
    options.SupportedCultures = supportedCultures;
    options.SupportedUICultures = supportedCultures;
    options.RequestCultureProviders =
    [
        new QueryStringRequestCultureProvider(),
        new CookieRequestCultureProvider(),
        new AcceptLanguageHeaderRequestCultureProvider()
    ];
});

builder.Services.AddCors(options =>
{
    options.AddPolicy(OpenCorsPolicy, policy =>
    {
        var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>();
        if (allowedOrigins is { Length: > 0 })
        {
            policy.WithOrigins(allowedOrigins);
        }
        else if (builder.Environment.IsDevelopment())
        {
            policy.SetIsOriginAllowed(_ => true);
        }
        else
        {
            throw new InvalidOperationException("Cors:AllowedOrigins must be configured in non-development environments.");
        }

        policy.AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

var permitLimit = builder.Configuration.GetValue("RateLimiting:PermitLimit", 120);
var windowSeconds = builder.Configuration.GetValue("RateLimiting:WindowSeconds", 60);
var queueLimit = builder.Configuration.GetValue("RateLimiting:QueueLimit", 0);

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = permitLimit,
                Window = TimeSpan.FromSeconds(windowSeconds),
                QueueLimit = queueLimit,
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                AutoReplenishment = true,
            }));
});

var tokenSigningKey = builder.Configuration["Authentication:SigningKey"];
if (string.IsNullOrWhiteSpace(tokenSigningKey))
{
    throw new InvalidOperationException("Authentication:SigningKey must be configured.");
}

var tokenIssuer = builder.Configuration["Authentication:Issuer"];
var tokenAudience = builder.Configuration["Authentication:Audience"];
if (string.IsNullOrWhiteSpace(tokenIssuer) || string.IsNullOrWhiteSpace(tokenAudience))
{
    throw new InvalidOperationException("Authentication issuer and audience must be configured.");
}
var dataProtectionKeysDirectory = builder.Configuration["DataProtection:KeysDirectory"];

var dataProtectionBuilder = builder.Services
    .AddDataProtection()
    .SetApplicationName("CityCommunicationCenter");

if (!string.IsNullOrWhiteSpace(dataProtectionKeysDirectory))
{
    Directory.CreateDirectory(dataProtectionKeysDirectory);
    dataProtectionBuilder.PersistKeysToFileSystem(new DirectoryInfo(dataProtectionKeysDirectory));
}

var signingKey = AuthenticationKeyFactory.CreateSigningKey(tokenSigningKey);

builder.Services
    .AddAuthentication(options =>
    {
        options.DefaultAuthenticateScheme = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme;
        options.DefaultChallengeScheme = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme;
        options.DefaultScheme = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme;
    })
    .AddCookie(AuthorizationPolicies.SessionCookieScheme, options =>
    {
        options.Cookie.Name = builder.Configuration["Authentication:SessionCookie:Name"] ?? "__Host-ccc-session";
        options.Cookie.HttpOnly = true;
        options.Cookie.Path = "/";
        options.Cookie.SecurePolicy = ParseCookieSecurePolicy(builder.Configuration["Authentication:SessionCookie:SecurePolicy"]);
        options.Cookie.SameSite = ParseSameSiteMode(builder.Configuration["Authentication:SessionCookie:SameSite"]);
        options.ExpireTimeSpan = TimeSpan.FromMinutes(builder.Configuration.GetValue("Authentication:SessionCookie:ExpireMinutes", 480));
        options.SlidingExpiration = true;
        options.LoginPath = PathString.Empty;
        options.AccessDeniedPath = PathString.Empty;
        options.Events = new CookieAuthenticationEvents
        {
            OnRedirectToLogin = context =>
            {
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                return Task.CompletedTask;
            },
            OnRedirectToAccessDenied = context =>
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                return Task.CompletedTask;
            }
        };
    })
    .AddNegotiate();

builder.Services.AddOpenIddict()
    .AddServer(options =>
    {
        options.SetIssuer(new Uri(tokenIssuer));
        options.SetTokenEndpointUris("/connect/token");

        options.AllowPasswordFlow();
        options.AcceptAnonymousClients();
        options.EnableDegradedMode();
        options.DisableAuthorizationStorage();
        options.DisableTokenStorage();
        options.DisableScopeValidation();
        options.AddEventHandler(OpenIddictPasswordGrantValidationHandler.Descriptor);

        options.DisableAccessTokenEncryption();
        options.SetAccessTokenLifetime(TimeSpan.FromHours(8));
        options.AddEphemeralSigningKey();
        options.AddEphemeralEncryptionKey();
        options.AddSigningKey(signingKey);

        options.UseAspNetCore()
            .EnableTokenEndpointPassthrough();

        if (builder.Environment.IsDevelopment())
        {
            options.UseAspNetCore()
                .DisableTransportSecurityRequirement();
        }
    })
    .AddValidation(options =>
    {
        options.SetIssuer(new Uri(tokenIssuer));
        options.AddAudiences(tokenAudience);
        options.UseLocalServer();
        options.UseAspNetCore();
    });

builder.Services.AddAuthorization(options =>
{
    options.DefaultPolicy = new Microsoft.AspNetCore.Authorization.AuthorizationPolicyBuilder()
        .AddAuthenticationSchemes(OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme, AuthorizationPolicies.SessionCookieScheme)
        .RequireAuthenticatedUser()
        .Build();

    options.AddPolicy(AuthorizationPolicies.TenantMember, policy =>
    {
        policy.AddAuthenticationSchemes(OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme, AuthorizationPolicies.SessionCookieScheme);
        policy.RequireAuthenticatedUser();
        policy.RequireAssertion(context =>
            context.User.HasClaim(claim => claim.Type is "tenant_id" or "tenantId"));
    });

    options.AddPolicy(AuthorizationPolicies.PlatformAdmin, policy =>
    {
        policy.AddAuthenticationSchemes(OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme, AuthorizationPolicies.SessionCookieScheme);
        policy.RequireAuthenticatedUser();
        policy.RequireRole("SystemAdmin");
    });
});

builder.Services.AddMediator(options =>
{
    options.ServiceLifetime = ServiceLifetime.Scoped;
    options.Assemblies = [typeof(CityCommunicationCenter.Application.DependencyInjection).Assembly];
    options.PipelineBehaviors = [typeof(CityCommunicationCenter.Application.Behaviors.ValidationBehavior<,>)];
});

builder.Services.AddApplicationServices();
builder.Services.AddScoped<InitialPasswordSeeder>();

builder.Services.Configure<Microsoft.AspNetCore.Http.Features.FormOptions>(o =>
{
    o.MultipartBodyLengthLimit = 6_000_000;
});

builder.Services.Configure<CityCommunicationCenter.Application.Features.Attachments.AttachmentStorageOptions>(o =>
    o.UploadRootPath = Path.Combine(builder.Environment.ContentRootPath, "uploads"));

builder.Services
    .AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddOpenApi();
builder.Services.AddInfrastructureServices(builder.Configuration);

builder.Services.AddSignalR();
builder.Services.AddScoped<INotificationPushService, SignalRNotificationPushService>();

var app = builder.Build();

var localizationOptions = app.Services.GetRequiredService<IOptions<RequestLocalizationOptions>>().Value;
app.UseRequestLocalization(localizationOptions);

var forwardedHeadersOptions = new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto | ForwardedHeaders.XForwardedHost
};
ConfigureForwardedHeaderTrust(builder.Configuration, app.Environment, forwardedHeadersOptions);

app.UseForwardedHeaders(forwardedHeadersOptions);

if (builder.Configuration.GetValue("Database:ApplyMigrationsOnStartup", app.Environment.IsDevelopment()))
{
    await using var scope = app.Services.CreateAsyncScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<CityCommunicationCenterDbContext>();
    await dbContext.Database.MigrateAsync();
    var passwordSeeder = scope.ServiceProvider.GetRequiredService<InitialPasswordSeeder>();
    await passwordSeeder.SeedAsync();
}

app.UseRouting();
app.UseCors(OpenCorsPolicy);

// Serve uploaded files as static content
var uploadsPath = Path.Combine(builder.Environment.ContentRootPath, "uploads");
Directory.CreateDirectory(uploadsPath);
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(uploadsPath),
    RequestPath = "/uploads"
});
app.UseMiddleware<ExceptionMiddleware>();
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();
app.UseSerilogRequestLogging(options =>
{
    options.MessageTemplate = "HTTP {RequestMethod} {RequestPath} responded {StatusCode} in {Elapsed:0.0000} ms";
    options.GetLevel = (httpContext, elapsed, exception) =>
    {
        if (httpContext.Request.Path.StartsWithSegments("/health") || httpContext.Request.Path == "/")
        {
            return LogEventLevel.Debug;
        }

        if (exception is not null || httpContext.Response.StatusCode >= StatusCodes.Status500InternalServerError)
        {
            return LogEventLevel.Error;
        }

        if (httpContext.Response.StatusCode >= StatusCodes.Status400BadRequest)
        {
            return LogEventLevel.Warning;
        }

        return elapsed >= 1000
            ? LogEventLevel.Information
            : LogEventLevel.Debug;
    };
    options.EnrichDiagnosticContext = (diagnosticContext, httpContext) =>
    {
        diagnosticContext.Set("RequestHost", httpContext.Request.Host.Value ?? string.Empty);
        diagnosticContext.Set("RequestScheme", httpContext.Request.Scheme);
        diagnosticContext.Set("TraceIdentifier", httpContext.TraceIdentifier);
    };
});
app.MapGet("/", () => Results.Ok(new
{
    product = "City Communication Center",
    architecture = "Modular monolith",
    runtime = ".NET 10",
    status = "Backend foundation ready"
})).AllowAnonymous();

app.MapGet("/health", async (IConfiguration configuration, CancellationToken cancellationToken) =>
{
    var connectionString = configuration.GetConnectionString("CityCommunicationCenter");
    if (string.IsNullOrWhiteSpace(connectionString))
    {
        return Results.Problem("Connection string 'CityCommunicationCenter' is missing.", statusCode: StatusCodes.Status503ServiceUnavailable);
    }

    try
    {
        await using var scope = app.Services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<CityCommunicationCenterDbContext>();
        await dbContext.Database.ExecuteSqlRawAsync("SELECT 1", cancellationToken);

        return Results.Ok(new
        {
            status = "Healthy",
            database = "Reachable"
        });
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "Health check failed: database unreachable.");
        return Results.Problem("Database connectivity check failed.", statusCode: StatusCodes.Status503ServiceUnavailable, title: "Unhealthy");
    }
}).AllowAnonymous().RequireCors(OpenCorsPolicy);

app.MapControllers().RequireCors(OpenCorsPolicy);
app.MapHub<NotificationHub>("/hubs/notifications").RequireCors(OpenCorsPolicy);

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi("/openapi/{documentName}.json").AllowAnonymous();
    app.MapScalarApiReference("/api-docs").AllowAnonymous();
}

app.Run();

static void ConfigureForwardedHeaderTrust(
    IConfiguration configuration,
    IWebHostEnvironment environment,
    ForwardedHeadersOptions options)
{
    var allowUntrustedForwardedHeaders = configuration.GetValue<bool>("ForwardedHeaders:AllowUntrustedForwardedHeaders");
    if (allowUntrustedForwardedHeaders)
    {
        if (!environment.IsDevelopment())
        {
            throw new InvalidOperationException("ForwardedHeaders:AllowUntrustedForwardedHeaders can only be enabled in Development.");
        }

        options.KnownIPNetworks.Clear();
        options.KnownProxies.Clear();
        return;
    }

    var knownProxies = configuration.GetSection("ForwardedHeaders:KnownProxies").Get<string[]>() ?? [];
    var knownNetworks = configuration.GetSection("ForwardedHeaders:KnownNetworks").Get<string[]>() ?? [];

    foreach (var proxy in knownProxies)
    {
        if (IPAddress.TryParse(proxy, out var address))
        {
            options.KnownProxies.Add(address);
        }
    }

    foreach (var network in knownNetworks)
    {
        if (System.Net.IPNetwork.TryParse(network, out var parsedNetwork))
        {
            options.KnownIPNetworks.Add(parsedNetwork);
        }
    }
}

static SameSiteMode ParseSameSiteMode(string? value)
{
    return string.Equals(value, "None", StringComparison.OrdinalIgnoreCase)
        ? SameSiteMode.None
        : string.Equals(value, "Strict", StringComparison.OrdinalIgnoreCase)
            ? SameSiteMode.Strict
            : SameSiteMode.Lax;
}

static CookieSecurePolicy ParseCookieSecurePolicy(string? value)
{
    return string.Equals(value, "None", StringComparison.OrdinalIgnoreCase)
        ? CookieSecurePolicy.None
        : string.Equals(value, "SameAsRequest", StringComparison.OrdinalIgnoreCase)
            ? CookieSecurePolicy.SameAsRequest
            : CookieSecurePolicy.Always;
}

using System.Threading.RateLimiting;
using System.Globalization;
using System.Data;
using System.Data.Common;
using System.Net;
using CityCommunicationCenter.Application;
using CityCommunicationCenter.Api.Hubs;
using CityCommunicationCenter.Api.Services;
using CityCommunicationCenter.Api.Security;
using CityCommunicationCenter.Application.Abstractions;
using Microsoft.AspNetCore.Authentication.Negotiate;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using CityCommunicationCenter.Api.Middleware;
using CityCommunicationCenter.Infrastructure;
using CityCommunicationCenter.Infrastructure.Persistence;
using Microsoft.AspNetCore.Localization;
using OpenIddict.Validation.AspNetCore;

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

    options.FallbackPolicy = new Microsoft.AspNetCore.Authorization.AuthorizationPolicyBuilder()
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

builder.Services.AddApplicationServices();
builder.Services.AddScoped<InitialPasswordSeeder>();

builder.Services
    .AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });

builder.Services.AddEndpointsApiExplorer();
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
ConfigureForwardedHeaderTrust(builder.Configuration, builder.Environment, forwardedHeadersOptions);

app.UseForwardedHeaders(forwardedHeadersOptions);

if (builder.Configuration.GetValue("Database:ApplyMigrationsOnStartup", app.Environment.IsDevelopment()))
{
    await using var scope = app.Services.CreateAsyncScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<CityCommunicationCenterDbContext>();
    await EnsureLegacyInitialMigrationMarkerAsync(dbContext, app.Logger, CancellationToken.None);
    await dbContext.Database.MigrateAsync();
    var passwordSeeder = scope.ServiceProvider.GetRequiredService<InitialPasswordSeeder>();
    await passwordSeeder.SeedAsync();
}

app.UseRouting();
app.UseCors(OpenCorsPolicy);
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

app.Run();

static async Task EnsureLegacyInitialMigrationMarkerAsync(
    CityCommunicationCenterDbContext dbContext,
    Microsoft.Extensions.Logging.ILogger logger,
    CancellationToken cancellationToken)
{
    const string legacyInitialMigrationId = "20260405171637_InitialPostgreSql";
    const string currentInitialMigrationId = "20260420205414_InitialPostgreSql_V2";
    const string fallbackProductVersion = "10.0.3";

    var connection = dbContext.Database.GetDbConnection();
    var shouldCloseConnection = connection.State != ConnectionState.Open;
    if (shouldCloseConnection)
    {
        await connection.OpenAsync(cancellationToken);
    }

    try
    {
        await using var historyTableCommand = connection.CreateCommand();
        historyTableCommand.CommandText = """
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = '__EFMigrationsHistory'
            );
            """;
        var historyTableExists = Convert.ToBoolean(await historyTableCommand.ExecuteScalarAsync(cancellationToken));
        if (!historyTableExists)
        {
            return;
        }

        var hasLegacyMigration = await HasMigrationAsync(connection, legacyInitialMigrationId, cancellationToken);
        var hasCurrentMigration = await HasMigrationAsync(connection, currentInitialMigrationId, cancellationToken);
        if (!hasLegacyMigration || hasCurrentMigration)
        {
            return;
        }

        var productVersion = await GetMigrationProductVersionAsync(connection, legacyInitialMigrationId, cancellationToken)
            ?? fallbackProductVersion;

        await using var insertCommand = connection.CreateCommand();
        insertCommand.CommandText = """
            INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
            VALUES (@migrationId, @productVersion);
            """;
        AddParameter(insertCommand, "@migrationId", currentInitialMigrationId);
        AddParameter(insertCommand, "@productVersion", productVersion);
        await insertCommand.ExecuteNonQueryAsync(cancellationToken);

        logger.LogWarning(
            "Detected legacy migration marker {LegacyMigrationId}. Added compatibility marker {CurrentMigrationId}.",
            legacyInitialMigrationId,
            currentInitialMigrationId);
    }
    finally
    {
        if (shouldCloseConnection)
        {
            await connection.CloseAsync();
        }
    }

    static async Task<bool> HasMigrationAsync(DbConnection connection, string migrationId, CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT EXISTS (
                SELECT 1
                FROM "__EFMigrationsHistory"
                WHERE "MigrationId" = @migrationId
            );
            """;
        AddParameter(command, "@migrationId", migrationId);
        return Convert.ToBoolean(await command.ExecuteScalarAsync(cancellationToken));
    }

    static async Task<string?> GetMigrationProductVersionAsync(
        DbConnection connection,
        string migrationId,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT "ProductVersion"
            FROM "__EFMigrationsHistory"
            WHERE "MigrationId" = @migrationId
            LIMIT 1;
            """;
        AddParameter(command, "@migrationId", migrationId);
        return await command.ExecuteScalarAsync(cancellationToken) as string;
    }

    static void AddParameter(DbCommand command, string name, object? value)
    {
        var parameter = command.CreateParameter();
        parameter.ParameterName = name;
        parameter.Value = value ?? DBNull.Value;
        command.Parameters.Add(parameter);
    }
}

static void ConfigureForwardedHeaderTrust(
    IConfiguration configuration,
    IWebHostEnvironment environment,
    ForwardedHeadersOptions options)
{
    var allowUntrustedForwardedHeaders = configuration.GetValue<bool>("ForwardedHeaders:AllowUntrustedForwardedHeaders");
    if (allowUntrustedForwardedHeaders && environment.IsDevelopment())
    {
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

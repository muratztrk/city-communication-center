using System.Threading.RateLimiting;
using CityCommunicationCenter.Application;
using CityCommunicationCenter.Api.Services;
using CityCommunicationCenter.Api.Security;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using CityCommunicationCenter.Api.Middleware;
using CityCommunicationCenter.Infrastructure;
using CityCommunicationCenter.Infrastructure.Persistence;
using OpenIddict.Validation.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

Directory.CreateDirectory(Path.Combine(builder.Environment.ContentRootPath, "logs"));

builder.Host.UseSerilog((context, services, loggerConfiguration) => loggerConfiguration
    .ReadFrom.Configuration(context.Configuration)
    .ReadFrom.Services(services)
    .Enrich.FromLogContext());

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? ["http://localhost:5173", "http://localhost:3000"];

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
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

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme;
    options.DefaultScheme = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme;
});

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
    options.FallbackPolicy = new Microsoft.AspNetCore.Authorization.AuthorizationPolicyBuilder()
        .AddAuthenticationSchemes(OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme)
        .RequireAuthenticatedUser()
        .Build();

    options.AddPolicy(AuthorizationPolicies.TenantMember, policy =>
    {
        policy.AddAuthenticationSchemes(OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme);
        policy.RequireAuthenticatedUser();
        policy.RequireAssertion(context =>
            context.User.HasClaim(claim => claim.Type is "tenant_id" or "tenantId"));
    });

    options.AddPolicy(AuthorizationPolicies.PlatformAdmin, policy =>
    {
        policy.AddAuthenticationSchemes(OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme);
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

var app = builder.Build();

var forwardedHeadersOptions = new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
};
forwardedHeadersOptions.KnownIPNetworks.Clear();
forwardedHeadersOptions.KnownProxies.Clear();

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
app.UseCors();
if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}
app.UseMiddleware<ExceptionMiddleware>();
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
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

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
        return Results.Problem(ex.Message, statusCode: StatusCodes.Status503ServiceUnavailable, title: "Database connectivity check failed.");
    }
}).AllowAnonymous();

app.MapControllers();

app.Run();

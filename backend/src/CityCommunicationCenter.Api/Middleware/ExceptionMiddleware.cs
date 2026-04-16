using System.Text.Json;
using CityCommunicationCenter.Application.Common.Exceptions;
using FluentValidation;
using Microsoft.Extensions.Localization;

namespace CityCommunicationCenter.Api.Middleware;

public sealed class ExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionMiddleware> _logger;
    private readonly IStringLocalizer<SharedResource> _localizer;

    public ExceptionMiddleware(RequestDelegate next, ILogger<ExceptionMiddleware> logger, IStringLocalizer<SharedResource> localizer)
    {
        _next = next;
        _logger = logger;
        _localizer = localizer;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (ForbiddenAccessException exception)
        {
            await WriteProblemResponseAsync(
                context,
                StatusCodes.Status403Forbidden,
                _localizer["ForbiddenTitle"],
                string.IsNullOrWhiteSpace(exception.Message)
                    ? _localizer["ForbiddenDetail"]
                    : exception.Message);
        }
        catch (ValidationException exception)
        {
            await WriteValidationResponseAsync(context, exception, _localizer);
        }
        catch (OperationCanceledException)
        {
            context.Response.StatusCode = 499; // Client Closed Request
        }
        catch (Exception exception)
        {
            _logger.LogError(exception, "Unhandled exception occured while processing request.");
            await WriteProblemResponseAsync(
                context,
                StatusCodes.Status500InternalServerError,
                _localizer["UnexpectedErrorTitle"],
                _localizer["UnexpectedErrorDetail"]);
        }
    }

    private static Task WriteValidationResponseAsync(HttpContext context, ValidationException exception, IStringLocalizer<SharedResource> localizer)
    {
        var errors = exception.Errors
            .GroupBy(error => error.PropertyName)
            .ToDictionary(
                group => string.IsNullOrWhiteSpace(group.Key) ? "request" : group.Key,
                group => group.Select(error => error.ErrorMessage).Distinct().ToArray());

        var payload = new
        {
            title = localizer["ValidationTitle"],
            status = StatusCodes.Status400BadRequest,
            detail = errors.Values.SelectMany(messages => messages).FirstOrDefault() ?? localizer["ValidationDetail"],
            errors
        };

        context.Response.StatusCode = StatusCodes.Status400BadRequest;
        context.Response.ContentType = "application/json";
        return context.Response.WriteAsync(JsonSerializer.Serialize(payload));
    }

    private static Task WriteProblemResponseAsync(HttpContext context, int statusCode, string title, string detail)
    {
        var payload = new
        {
            title,
            status = statusCode,
            detail
        };

        context.Response.StatusCode = statusCode;
        context.Response.ContentType = "application/json";
        return context.Response.WriteAsync(JsonSerializer.Serialize(payload));
    }
}
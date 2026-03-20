using System.Text.Json;
using FluentValidation;

namespace CityCommunicationCenter.Api.Middleware;

public sealed class ExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionMiddleware> _logger;

    public ExceptionMiddleware(RequestDelegate next, ILogger<ExceptionMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (ValidationException exception)
        {
            await WriteValidationResponseAsync(context, exception);
        }
        catch (Exception exception)
        {
            _logger.LogError(exception, "Unhandled exception occured while processing request.");
            await WriteProblemResponseAsync(
                context,
                StatusCodes.Status500InternalServerError,
                "Beklenmeyen bir hata olustu.",
                "Istek islenirken beklenmeyen bir hata olustu.");
        }
    }

    private static Task WriteValidationResponseAsync(HttpContext context, ValidationException exception)
    {
        var errors = exception.Errors
            .GroupBy(error => error.PropertyName)
            .ToDictionary(
                group => string.IsNullOrWhiteSpace(group.Key) ? "request" : group.Key,
                group => group.Select(error => error.ErrorMessage).Distinct().ToArray());

        var payload = new
        {
            title = "Dogrulama hatasi.",
            status = StatusCodes.Status400BadRequest,
            detail = errors.Values.SelectMany(messages => messages).FirstOrDefault() ?? "Gonderilen istek dogrulanamadi.",
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
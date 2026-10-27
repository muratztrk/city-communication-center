using System.Globalization;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.RegularExpressions;
using CityCommunicationCenter.Application.Common.Exceptions;
using FluentValidation;
using Microsoft.Extensions.Localization;

namespace CityCommunicationCenter.Api.Middleware;

public sealed partial class ExceptionMiddleware
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping
    };

    [GeneratedRegex(@"\[\[U\+([0-9A-Fa-f]{4,6})\]\]", RegexOptions.CultureInvariant)]
    private static partial Regex WafEmojiTokenRegex();

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
            await DecodeWafSafeJsonRequestBodyAsync(context);
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

        // string-ctor ValidationException Errors boş bırakır — Message'ı detail'e taşı (card #1784).
        // Boş ErrorMessage'ları atla (FirstOrDefault aksi halde "" döner ve Message'ı ezer — card #1824).
        var detailFromErrors = errors.Values
            .SelectMany(messages => messages)
            .FirstOrDefault(message => !string.IsNullOrWhiteSpace(message));
        var detail = !string.IsNullOrWhiteSpace(detailFromErrors)
            ? detailFromErrors
            : !string.IsNullOrWhiteSpace(exception.Message)
                ? exception.Message
                : localizer["ValidationDetail"].Value;

        var payload = new
        {
            title = localizer["ValidationTitle"],
            status = StatusCodes.Status400BadRequest,
            detail,
            errors
        };

        context.Response.StatusCode = StatusCodes.Status400BadRequest;
        context.Response.ContentType = "application/json";
        return context.Response.WriteAsync(JsonSerializer.Serialize(payload, JsonOptions));
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
        return context.Response.WriteAsync(JsonSerializer.Serialize(payload, JsonOptions));
    }

    private static async Task DecodeWafSafeJsonRequestBodyAsync(HttpContext context)
    {
        if (context.Request.ContentLength is 0
            || string.IsNullOrWhiteSpace(context.Request.ContentType)
            || !context.Request.ContentType.Contains("application/json", StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        context.Request.EnableBuffering();
        using var reader = new StreamReader(context.Request.Body, Encoding.UTF8, detectEncodingFromByteOrderMarks: false, leaveOpen: true);
        var raw = await reader.ReadToEndAsync(context.RequestAborted);
        if (!raw.Contains("[[U+", StringComparison.Ordinal))
        {
            context.Request.Body.Position = 0;
            return;
        }

        var decoded = WafEmojiTokenRegex().Replace(raw, static match =>
        {
            if (!int.TryParse(match.Groups[1].Value, NumberStyles.HexNumber, CultureInfo.InvariantCulture, out var codePoint)
                || codePoint is < 0 or > 0x10FFFF
                || codePoint is >= 0xD800 and <= 0xDFFF)
            {
                return match.Value;
            }

            return char.ConvertFromUtf32(codePoint);
        });

        var bytes = Encoding.UTF8.GetBytes(decoded);
        context.Request.Body = new MemoryStream(bytes);
        context.Request.ContentLength = bytes.Length;
    }
}
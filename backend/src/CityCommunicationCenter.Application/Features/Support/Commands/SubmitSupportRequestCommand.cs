using CityCommunicationCenter.Application.Features.Attachments;

namespace CityCommunicationCenter.Application.Features.Support;

public sealed record SubmitSupportRequestFile(
    string FileName,
    string ContentType,
    string ContentBase64);

public sealed record SubmitSupportRequestCommand(
    string Subject,
    string Message,
    string? PageContext,
    string? Priority,
    IReadOnlyList<SubmitSupportRequestFile>? Files) : ICommand<Guid>;

public sealed class SubmitSupportRequestCommandValidator : AbstractValidator<SubmitSupportRequestCommand>
{
    public SubmitSupportRequestCommandValidator()
    {
        RuleFor(command => command.Subject)
            .NotEmpty().WithMessage("Konu zorunludur.")
            .MinimumLength(4).WithMessage("Konu en az 4 karakter olmalıdır.")
            .MaximumLength(200).WithMessage("Konu en fazla 200 karakter olabilir.");
        RuleFor(command => command.Message)
            .NotEmpty().WithMessage("Mesaj zorunludur.")
            .MinimumLength(10).WithMessage("Mesaj en az 10 karakter olmalıdır.")
            .MaximumLength(4000).WithMessage("Mesaj en fazla 4000 karakter olabilir.");
        RuleFor(command => command.PageContext)
            .MaximumLength(500).WithMessage("Sayfa bilgisi en fazla 500 karakter olabilir.");
        RuleFor(command => command.Priority)
            .Must(priority => string.IsNullOrWhiteSpace(priority)
                || priority is "Normal" or "High" or "VeryHigh")
            .WithMessage("Geçersiz öncelik değeri.");
        RuleFor(command => command.Files)
            .Must(files => files is null || files.Count <= 8)
            .WithMessage("En fazla 8 ek dosya yüklenebilir.");
    }
}

public sealed class SubmitSupportRequestCommandHandler : ICommandHandler<SubmitSupportRequestCommand, Guid>
{
    private const long MaxFileBytes = 5 * 1024 * 1024;

    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;
    private readonly ILumespecSupportClient _lumespecSupportClient;
    private readonly IMediator _mediator;

    public SubmitSupportRequestCommandHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor,
        ILumespecSupportClient lumespecSupportClient,
        IMediator mediator)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
        _lumespecSupportClient = lumespecSupportClient;
        _mediator = mediator;
    }

    public async ValueTask<Guid> Handle(SubmitSupportRequestCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();

        var supportRequest = new SupportRequest
        {
            SupportRequestId = Guid.NewGuid(),
            TenantId = tenantId,
            Subject = request.Subject.Trim(),
            Message = request.Message.Trim(),
            PageContext = request.PageContext?.Trim(),
            Priority = string.IsNullOrWhiteSpace(request.Priority) ? "Normal" : request.Priority.Trim(),
            CreatedByUserId = context.UserId,
        };

        _dbContext.SupportRequests.Add(supportRequest);
        await _dbContext.SaveChangesAsync(cancellationToken);

        var tenantName = await _dbContext.Tenants
            .Where(tenant => tenant.TenantId == tenantId)
            .Select(tenant => tenant.DisplayName != string.Empty ? tenant.DisplayName : tenant.MunicipalityName)
            .FirstOrDefaultAsync(cancellationToken);

        var requester = context.UserId.HasValue
            ? await _dbContext.Users
                .Where(user => user.UserId == context.UserId.Value)
                .Select(user => new { user.DisplayName, user.Email, user.Phone, user.DepartmentId })
                .FirstOrDefaultAsync(cancellationToken)
            : null;

        var departmentName = requester is null
            ? null
            : await _dbContext.Departments
                .Where(department => department.DepartmentId == requester.DepartmentId)
                .Select(department => department.Name)
                .FirstOrDefaultAsync(cancellationToken);

        var files = DecodeFiles(request.Files);
        foreach (var file in files)
        {
            await using var stream = new MemoryStream(file.Bytes, writable: false);
            await _mediator.Send(
                new UploadAttachmentCommand(
                    "SupportRequest",
                    supportRequest.SupportRequestId,
                    context.UserId,
                    file.FileName,
                    file.ContentType,
                    file.Bytes.LongLength,
                    stream),
                cancellationToken);
        }

        var priority = supportRequest.Priority;
        var priorityLabel = PriorityLabel(priority);
        var centralDescription = BuildCentralDescription(
            supportRequest.Message,
            priorityLabel,
            requester?.DisplayName,
            requester?.Email,
            requester?.Phone,
            departmentName,
            supportRequest.PageContext,
            files.Select(file => file.FileName).ToList());

        var centralTicket = await _lumespecSupportClient.CreateTicketAsync(
            new CreateCentralSupportTicketRequest(
                supportRequest.SupportRequestId,
                tenantId,
                tenantName,
                context.UserId,
                requester?.DisplayName ?? "CCC Kullanıcısı",
                requester?.Email,
                requester?.Phone,
                departmentName,
                supportRequest.Subject,
                centralDescription,
                supportRequest.PageContext,
                priority,
                priorityLabel,
                files.Select(file => new CentralSupportAttachmentPayload(
                    file.FileName,
                    file.ContentType,
                    Convert.ToBase64String(file.Bytes))).ToList()),
            cancellationToken);

        if (centralTicket is not null)
        {
            supportRequest.CentralTicketNo = centralTicket.TicketNo;
            supportRequest.CentralStatus = centralTicket.Status;
            supportRequest.CentralSyncedAtUtc = DateTimeOffset.UtcNow;
            supportRequest.CentralSyncError = null;
            await _dbContext.SaveChangesAsync(cancellationToken);
        }
        else
        {
            supportRequest.CentralSyncError = "Merkezi Lumespec destek sistemine gönderilemedi.";
            await _dbContext.SaveChangesAsync(cancellationToken);
        }

        return supportRequest.SupportRequestId;
    }

    private static List<DecodedSupportFile> DecodeFiles(IReadOnlyList<SubmitSupportRequestFile>? files)
    {
        if (files is null || files.Count == 0)
        {
            return [];
        }

        var decoded = new List<DecodedSupportFile>(files.Count);
        long total = 0;
        foreach (var file in files)
        {
            if (string.IsNullOrWhiteSpace(file.FileName) || string.IsNullOrWhiteSpace(file.ContentBase64))
            {
                throw new ValidationException("Ek dosya adı ve içeriği zorunludur.");
            }

            byte[] bytes;
            try
            {
                bytes = Convert.FromBase64String(file.ContentBase64);
            }
            catch (FormatException)
            {
                throw new ValidationException("Ek dosya içeriği okunamadı.");
            }

            if (bytes.LongLength > MaxFileBytes)
            {
                throw new ValidationException("Dosya boyutu 5 MB'ı aşamaz.");
            }

            total += bytes.LongLength;
            if (total > MaxFileBytes)
            {
                throw new ValidationException("Dosyaların toplam boyutu 5 MB'ı aşamaz.");
            }

            decoded.Add(new DecodedSupportFile(
                Path.GetFileName(file.FileName.Trim()),
                string.IsNullOrWhiteSpace(file.ContentType) ? "application/octet-stream" : file.ContentType.Trim(),
                bytes));
        }

        return decoded;
    }

    private static string PriorityLabel(string priority) => priority switch
    {
        "VeryHigh" => "Acil",
        "High" => "Yüksek",
        _ => "Normal",
    };

    private static string BuildCentralDescription(
        string message,
        string priorityLabel,
        string? requesterName,
        string? email,
        string? phone,
        string? departmentName,
        string? pageContext,
        IReadOnlyList<string> fileNames)
    {
        var lines = new List<string>
        {
            $"Öncelik: {priorityLabel}",
        };
        if (!string.IsNullOrWhiteSpace(requesterName))
        {
            lines.Add($"Talep eden: {requesterName.Trim()}");
        }
        if (!string.IsNullOrWhiteSpace(email))
        {
            lines.Add($"E-posta: {email.Trim()}");
        }
        if (!string.IsNullOrWhiteSpace(phone))
        {
            lines.Add($"Telefon: {phone.Trim()}");
        }
        if (!string.IsNullOrWhiteSpace(departmentName))
        {
            lines.Add($"Birim: {departmentName.Trim()}");
        }
        if (!string.IsNullOrWhiteSpace(pageContext))
        {
            lines.Add($"Sayfa: {pageContext.Trim()}");
        }

        lines.Add(string.Empty);
        lines.Add(message.Trim());
        if (fileNames.Count > 0)
        {
            lines.Add(string.Empty);
            lines.Add("Ek dosyalar:");
            foreach (var name in fileNames)
            {
                lines.Add($"- {name}");
            }
        }

        var text = string.Join('\n', lines);
        return text.Length <= 4000 ? text : text[..4000];
    }

    private sealed record DecodedSupportFile(string FileName, string ContentType, byte[] Bytes);
}

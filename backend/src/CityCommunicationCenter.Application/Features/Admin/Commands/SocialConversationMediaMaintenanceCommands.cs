using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Application.Features;
using CityCommunicationCenter.Application.Features.Social;
using CityCommunicationCenter.Domain.Enums;
using CityCommunicationCenter.Shared.Contracts;
using CityCommunicationCenter.Shared.FileStorage;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace CityCommunicationCenter.Application.Features.Admin;

public sealed record ProbeSocialConversationMediaStorageQuery(
    Guid TenantId,
    IReadOnlyList<Guid> EntryIds) : IQuery<IReadOnlyList<SocialConversationMediaStorageProbeItemResponse>>;

public sealed record ReararchiveSocialConversationMediaCommand(
    Guid TenantId,
    IReadOnlyList<Guid> EntryIds) : ICommand<IReadOnlyList<SocialConversationMediaRearchiveItemResponse>>;

internal sealed record SocialConversationMediaMaintenanceRow(
    Guid EntryId,
    Guid SocialMessageId,
    string MetaMediaId,
    string? MediaMimeType,
    string CitizenHandle,
    string? CitizenPhone,
    SocialChannel Channel);

public sealed class ProbeSocialConversationMediaStorageQueryHandler
    : IQueryHandler<ProbeSocialConversationMediaStorageQuery, IReadOnlyList<SocialConversationMediaStorageProbeItemResponse>>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly IConversationMediaRemoteArchive _mediaRemoteArchive;
    private readonly string _uploadRootPath;

    public ProbeSocialConversationMediaStorageQueryHandler(
        IApplicationDbContext dbContext,
        IConversationMediaRemoteArchive mediaRemoteArchive,
        IOptions<Attachments.AttachmentStorageOptions> attachmentStorageOptions)
    {
        _dbContext = dbContext;
        _mediaRemoteArchive = mediaRemoteArchive;
        _uploadRootPath = attachmentStorageOptions.Value.UploadRootPath;
    }

    public async ValueTask<IReadOnlyList<SocialConversationMediaStorageProbeItemResponse>> Handle(
        ProbeSocialConversationMediaStorageQuery request,
        CancellationToken cancellationToken)
    {
        var rows = await SocialConversationMediaMaintenanceLoader.LoadAsync(
            _dbContext,
            request.TenantId,
            request.EntryIds,
            cancellationToken);
        var remoteEnabled = await _mediaRemoteArchive.IsEnabledAsync(request.TenantId, cancellationToken);
        var results = new List<SocialConversationMediaStorageProbeItemResponse>();

        foreach (var row in rows)
        {
            var remoteFileNames = ConversationLocalMediaStore.BuildRemoteFileNameCandidates(
                null,
                row.EntryId,
                row.MediaMimeType);
            var localPath = ConversationLocalMediaStore.ResolveEntryFullPath(
                _uploadRootPath,
                request.TenantId,
                row.EntryId);
            var localExists = localPath is not null && File.Exists(localPath);
            var channel = row.Channel.ToString();
            var remoteChecks = new List<SocialConversationMediaRemoteProbeResponse>();

            if (remoteEnabled)
            {
                foreach (var folder in ConversationMediaRemotePathHelper.BuildFolderCandidates(
                             row.CitizenHandle,
                             row.CitizenPhone))
                {
                    foreach (var fileName in remoteFileNames)
                    {
                        var relativePath = AttachmentNasPath.BuildSocialMediaRelativePath(channel, folder, fileName);
                        var bytes = await _mediaRemoteArchive.TryReadAsync(
                            request.TenantId,
                            channel,
                            folder,
                            [fileName],
                            cancellationToken);

                        remoteChecks.Add(new SocialConversationMediaRemoteProbeResponse(
                            relativePath,
                            bytes is { Length: > 0 },
                            bytes?.Length));
                    }
                }
            }

            results.Add(new SocialConversationMediaStorageProbeItemResponse(
                row.EntryId,
                row.SocialMessageId,
                row.MetaMediaId,
                row.MediaMimeType,
                row.CitizenHandle,
                row.CitizenPhone,
                remoteEnabled,
                localExists,
                localPath,
                remoteChecks));
        }

        return results;
    }
}

public sealed class ReararchiveSocialConversationMediaCommandHandler
    : ICommandHandler<ReararchiveSocialConversationMediaCommand, IReadOnlyList<SocialConversationMediaRearchiveItemResponse>>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ISocialMediaClientFactory _clientFactory;
    private readonly IConversationMediaRemoteArchive _mediaRemoteArchive;
    private readonly ILogger<ReararchiveSocialConversationMediaCommandHandler> _logger;
    private readonly string _uploadRootPath;

    public ReararchiveSocialConversationMediaCommandHandler(
        IApplicationDbContext dbContext,
        ISocialMediaClientFactory clientFactory,
        IConversationMediaRemoteArchive mediaRemoteArchive,
        ILogger<ReararchiveSocialConversationMediaCommandHandler> logger,
        IOptions<Attachments.AttachmentStorageOptions> attachmentStorageOptions)
    {
        _dbContext = dbContext;
        _clientFactory = clientFactory;
        _mediaRemoteArchive = mediaRemoteArchive;
        _logger = logger;
        _uploadRootPath = attachmentStorageOptions.Value.UploadRootPath;
    }

    public async ValueTask<IReadOnlyList<SocialConversationMediaRearchiveItemResponse>> Handle(
        ReararchiveSocialConversationMediaCommand request,
        CancellationToken cancellationToken)
    {
        var rows = await SocialConversationMediaMaintenanceLoader.LoadAsync(
            _dbContext,
            request.TenantId,
            request.EntryIds,
            cancellationToken);

        if (_clientFactory.GetClient(SocialChannel.WhatsApp, request.TenantId) is not IWhatsAppMediaClient mediaClient)
        {
            return rows
                .Select(row => new SocialConversationMediaRearchiveItemResponse(
                    row.EntryId,
                    false,
                    false,
                    false,
                    "WhatsApp medya istemcisi yapılandırılmamış."))
                .ToList();
        }

        var probeHandler = new ProbeSocialConversationMediaStorageQueryHandler(
            _dbContext,
            _mediaRemoteArchive,
            Options.Create(new Attachments.AttachmentStorageOptions { UploadRootPath = _uploadRootPath }));
        var probes = await probeHandler.Handle(
            new ProbeSocialConversationMediaStorageQuery(request.TenantId, request.EntryIds),
            cancellationToken);
        var remoteEnabled = await _mediaRemoteArchive.IsEnabledAsync(request.TenantId, cancellationToken);
        var results = new List<SocialConversationMediaRearchiveItemResponse>();

        foreach (var row in rows)
        {
            var probe = probes.FirstOrDefault(item => item.EntryId == row.EntryId);
            if (probe?.RemoteChecks.Any(check => check.Found) == true || probe?.LocalExists == true)
            {
                results.Add(new SocialConversationMediaRearchiveItemResponse(
                    row.EntryId,
                    true,
                    probe.LocalExists,
                    probe.RemoteChecks.Any(check => check.Found),
                    "Dosya zaten yerelde veya uzak arşivde mevcut."));
                continue;
            }

            try
            {
                var download = await mediaClient.DownloadMediaAsync(row.MetaMediaId, cancellationToken);
                if (download is null)
                {
                    results.Add(new SocialConversationMediaRearchiveItemResponse(
                        row.EntryId,
                        false,
                        false,
                        false,
                        "Meta Graph medyası indirilemedi (süre dolmuş veya erişim hatası)."));
                    continue;
                }

                var localMediaId = ConversationLocalMediaStore.BuildLocalMediaIdFromMimeType(
                    request.TenantId,
                    row.EntryId,
                    row.MediaMimeType ?? download.ContentType);
                var localPath = await ConversationLocalMediaStore.SaveAsync(
                    _uploadRootPath,
                    localMediaId,
                    download.Content,
                    cancellationToken);
                var enqueued = false;
                if (remoteEnabled)
                {
                    var fileName = ConversationLocalMediaStore.ResolveRemoteFileName(
                        null,
                        row.EntryId,
                        row.MediaMimeType ?? download.ContentType);
                    // GetMedia uzak okumada socialMessage.CitizenHandle kullanır; webhook ile aynı klasör.
                    var folder = row.CitizenHandle.Trim();
                    await _mediaRemoteArchive.EnqueueAsync(
                        request.TenantId,
                        SocialChannel.WhatsApp.ToString(),
                        folder,
                        localPath,
                        fileName,
                        cancellationToken);
                    enqueued = true;
                }

                results.Add(new SocialConversationMediaRearchiveItemResponse(
                    row.EntryId,
                    true,
                    true,
                    enqueued,
                    enqueued
                        ? "Meta'dan indirildi; uzak arşiv kuyruğuna alındı."
                        : "Meta'dan indirildi; yerel kopya oluşturuldu."));
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                _logger.LogWarning(
                    exception,
                    "Sosyal konuşma medyası yeniden arşivlenemedi. EntryId: {EntryId}",
                    row.EntryId);
                results.Add(new SocialConversationMediaRearchiveItemResponse(
                    row.EntryId,
                    false,
                    false,
                    false,
                    exception.Message));
            }
        }

        return results;
    }
}

internal static class SocialConversationMediaMaintenanceLoader
{
    public static async Task<List<SocialConversationMediaMaintenanceRow>> LoadAsync(
        IApplicationDbContext dbContext,
        Guid tenantId,
        IReadOnlyList<Guid> entryIds,
        CancellationToken cancellationToken)
    {
        if (entryIds.Count == 0)
        {
            return [];
        }

        return await dbContext.ConversationEntries
            .IgnoreQueryFilters()
            .Where(entry => entryIds.Contains(entry.EntryId) && entry.MediaId != null)
            .Join(
                dbContext.SocialMessages.IgnoreQueryFilters().Where(message => message.TenantId == tenantId),
                entry => entry.SocialMessageId,
                message => message.SocialMessageId,
                (entry, message) => new { entry, message })
            .GroupJoin(
                dbContext.CitizenConversations.IgnoreQueryFilters(),
                row => row.message.CitizenConversationId,
                conversation => conversation.CitizenConversationId,
                (row, conversations) => new { row.entry, row.message, conversations })
            .SelectMany(
                row => row.conversations.DefaultIfEmpty(),
                (row, conversation) => new SocialConversationMediaMaintenanceRow(
                    row.entry.EntryId,
                    row.message.SocialMessageId,
                    row.entry.MediaId!,
                    row.entry.MediaMimeType,
                    row.message.CitizenHandle,
                    conversation != null ? conversation.CitizenPhone : null,
                    row.message.Channel))
            .ToListAsync(cancellationToken);
    }

}

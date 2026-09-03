namespace CityCommunicationCenter.Shared.FileStorage;

public static class AttachmentNasPath
{
    public static string BuildRelativePath(
        Guid tenantId,
        string entityType,
        Guid entityId,
        string storedFileName) =>
        $"{tenantId}/{entityType}/{entityId}/{storedFileName}";

    public static string ToSmbPath(string relativePath) =>
        relativePath.Replace('/', '\\');
}

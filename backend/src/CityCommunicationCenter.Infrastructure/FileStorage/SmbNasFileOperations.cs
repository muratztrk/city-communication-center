using SMBLibrary;
using SMBLibrary.Client;

namespace CityCommunicationCenter.Infrastructure.FileStorage;

internal static class SmbNasFileOperations
{
    private const int WriteChunkSize = 64 * 1024;

    public static void UploadFile(ISMBFileStore fileStore, string smbPath, byte[] content)
    {
        EnsureParentDirectories(fileStore, smbPath);

        var status = fileStore.CreateFile(
            out var handle,
            out _,
            smbPath,
            AccessMask.GENERIC_WRITE | AccessMask.DELETE | AccessMask.SYNCHRONIZE,
            SMBLibrary.FileAttributes.Normal,
            ShareAccess.None,
            CreateDisposition.FILE_OVERWRITE_IF,
            CreateOptions.FILE_NON_DIRECTORY_FILE | CreateOptions.FILE_SYNCHRONOUS_IO_ALERT,
            null);

        if (status != NTStatus.STATUS_SUCCESS || handle is null)
        {
            throw new SmbNasSessionException($"NAS dosyası oluşturulamadı ({status}).");
        }

        try
        {
            var offset = 0;
            while (offset < content.Length)
            {
                var toWrite = Math.Min(WriteChunkSize, content.Length - offset);
                var chunk = new byte[toWrite];
                Buffer.BlockCopy(content, offset, chunk, 0, toWrite);
                status = fileStore.WriteFile(out var written, handle, offset, chunk);
                if (status != NTStatus.STATUS_SUCCESS || written <= 0)
                {
                    throw new SmbNasSessionException($"NAS dosyası yazılamadı ({status}).");
                }

                offset += written;
            }
        }
        finally
        {
            fileStore.CloseFile(handle);
        }
    }

    public static void DeleteFile(ISMBFileStore fileStore, string smbPath)
    {
        var status = fileStore.CreateFile(
            out var handle,
            out _,
            smbPath,
            AccessMask.DELETE | AccessMask.SYNCHRONIZE,
            SMBLibrary.FileAttributes.Normal,
            ShareAccess.Delete | ShareAccess.Read | ShareAccess.Write,
            CreateDisposition.FILE_OPEN,
            CreateOptions.FILE_NON_DIRECTORY_FILE | CreateOptions.FILE_SYNCHRONOUS_IO_NONALERT,
            null);

        if (status == NTStatus.STATUS_OBJECT_NAME_NOT_FOUND)
        {
            return;
        }

        if (status != NTStatus.STATUS_SUCCESS || handle is null)
        {
            throw new SmbNasSessionException($"NAS dosyası açılamadı ({status}).");
        }

        try
        {
            fileStore.SetFileInformation(handle, new FileDispositionInformation { DeletePending = true });
        }
        finally
        {
            fileStore.CloseFile(handle);
        }
    }

    private static void EnsureParentDirectories(ISMBFileStore fileStore, string smbPath)
    {
        var parts = smbPath.Split('\\', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length <= 1)
        {
            return;
        }

        var current = string.Empty;
        for (var i = 0; i < parts.Length - 1; i++)
        {
            current = i == 0 ? parts[i] : $"{current}\\{parts[i]}";
            var status = fileStore.CreateFile(
                out var dirHandle,
                out _,
                current,
                AccessMask.GENERIC_WRITE | AccessMask.DELETE | AccessMask.SYNCHRONIZE,
                SMBLibrary.FileAttributes.Directory,
                ShareAccess.Read | ShareAccess.Write,
                CreateDisposition.FILE_OPEN_IF,
                CreateOptions.FILE_DIRECTORY_FILE | CreateOptions.FILE_SYNCHRONOUS_IO_ALERT,
                null);

            if (status != NTStatus.STATUS_SUCCESS || dirHandle is null)
            {
                throw new SmbNasSessionException($"NAS klasörü oluşturulamadı: {current} ({status}).");
            }

            fileStore.CloseFile(dirHandle);
        }
    }
}

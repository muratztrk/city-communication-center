#!/usr/bin/env bash
set -euo pipefail

SQL_HOST="${SQL_HOST:-sqlserver}"
SQL_PORT="${SQL_PORT:-1433}"
SQL_USER="${SQL_USER:-sa}"
SQL_PASSWORD="${SQL_SA_PASSWORD:-}"
DB_NAME="${CCC_DB_NAME:-CityCommunicationCenter}"
BACKUP_PATH="${DB_BACKUP_PATH:-/backup/CityCommunicationCenter.bak}"
INIT_SQL_PATH="${DB_INIT_SQL_PATH:-/docker/sql/init/init.sql}"
WAIT_RETRIES="${SQL_WAIT_RETRIES:-60}"
WAIT_SECONDS="${SQL_WAIT_SECONDS:-2}"
FORCE_RESTORE_RAW="${FORCE_DB_RESTORE:-false}"

force_restore=false
case "${FORCE_RESTORE_RAW,,}" in
    1|true|yes|y)
        force_restore=true
        ;;
esac

if [[ -z "${SQL_PASSWORD}" ]]; then
    echo "SQL_SA_PASSWORD is required."
    exit 1
fi

SQLCMD_BIN="/opt/mssql-tools18/bin/sqlcmd"
if [[ ! -x "${SQLCMD_BIN}" ]]; then
    SQLCMD_BIN="/opt/mssql-tools/bin/sqlcmd"
fi

if [[ ! -x "${SQLCMD_BIN}" ]]; then
    echo "sqlcmd binary not found in container."
    exit 1
fi

sql_query() {
    local query="$1"
    "${SQLCMD_BIN}" -C -S "${SQL_HOST},${SQL_PORT}" -U "${SQL_USER}" -P "${SQL_PASSWORD}" -b -Q "${query}"
}

sql_scalar() {
    local query="$1"
    "${SQLCMD_BIN}" -C -S "${SQL_HOST},${SQL_PORT}" -U "${SQL_USER}" -P "${SQL_PASSWORD}" -h -1 -W -Q "${query}" \
        | tr -d '\r' \
        | sed '/^[[:space:]]*$/d' \
        | head -n 1
}

echo "Waiting for SQL Server at ${SQL_HOST}:${SQL_PORT}..."
ready=false
for attempt in $(seq 1 "${WAIT_RETRIES}"); do
    if sql_query "SELECT 1" >/dev/null 2>&1; then
        ready=true
        break
    fi

    echo "SQL Server not ready yet (${attempt}/${WAIT_RETRIES}), retrying in ${WAIT_SECONDS}s..."
    sleep "${WAIT_SECONDS}"
done

if [[ "${ready}" != "true" ]]; then
    echo "SQL Server did not become ready in time."
    exit 1
fi

db_id="$(sql_scalar "SET NOCOUNT ON; SELECT DB_ID(N'${DB_NAME}');")"
db_exists=false
if [[ -n "${db_id}" && "${db_id}" != "NULL" ]]; then
    db_exists=true
fi

if [[ -f "${BACKUP_PATH}" ]] && { [[ "${db_exists}" == "false" ]] || [[ "${force_restore}" == "true" ]]; }; then
    echo "Restoring database [${DB_NAME}] from backup ${BACKUP_PATH}..."

    read -r -d '' restore_query <<SQL || true
DECLARE @db sysname = N'${DB_NAME}';
DECLARE @backup nvarchar(4000) = N'${BACKUP_PATH}';
DECLARE @dataLogical sysname;
DECLARE @logLogical sysname;

IF DB_ID(@db) IS NOT NULL
BEGIN
    EXEC(N'ALTER DATABASE [' + @db + N'] SET SINGLE_USER WITH ROLLBACK IMMEDIATE');
END;

DECLARE @fileList TABLE
(
    LogicalName sysname,
    PhysicalName nvarchar(260),
    [Type] char(1),
    FileGroupName sysname NULL,
    [Size] numeric(20,0) NULL,
    MaxSize numeric(20,0) NULL,
    FileId bigint NULL,
    CreateLSN numeric(25,0) NULL,
    DropLSN numeric(25,0) NULL,
    UniqueId uniqueidentifier NULL,
    ReadOnlyLSN numeric(25,0) NULL,
    ReadWriteLSN numeric(25,0) NULL,
    BackupSizeInBytes bigint NULL,
    SourceBlockSize int NULL,
    FileGroupId int NULL,
    LogGroupGUID uniqueidentifier NULL,
    DifferentialBaseLSN numeric(25,0) NULL,
    DifferentialBaseGUID uniqueidentifier NULL,
    IsReadOnly bit NULL,
    IsPresent bit NULL,
    TDEThumbprint varbinary(32) NULL,
    SnapshotURL nvarchar(360) NULL
);

INSERT INTO @fileList
EXEC(N'RESTORE FILELISTONLY FROM DISK = ''' + REPLACE(@backup, '''', '''''') + N'''');

SELECT TOP (1) @dataLogical = LogicalName FROM @fileList WHERE [Type] = 'D' ORDER BY FileId;
SELECT TOP (1) @logLogical = LogicalName FROM @fileList WHERE [Type] = 'L' ORDER BY FileId;

IF @dataLogical IS NULL OR @logLogical IS NULL
BEGIN
    THROW 50000, N'Backup logical file names could not be determined.', 1;
END;

DECLARE @restore nvarchar(max) =
N'RESTORE DATABASE [' + @db + N'] FROM DISK = N''' + REPLACE(@backup, '''', '''''') + N''' WITH REPLACE, STATS = 5, ' +
N'MOVE N''' + @dataLogical + N''' TO N''/var/opt/mssql/data/' + @db + N'.mdf'', ' +
N'MOVE N''' + @logLogical + N''' TO N''/var/opt/mssql/data/' + @db + N'_log.ldf'';';

EXEC(@restore);
EXEC(N'ALTER DATABASE [' + @db + N'] SET MULTI_USER');
SQL

    "${SQLCMD_BIN}" -C -S "${SQL_HOST},${SQL_PORT}" -U "${SQL_USER}" -P "${SQL_PASSWORD}" -b -Q "${restore_query}"
    db_exists=true
elif [[ -f "${BACKUP_PATH}" ]]; then
    echo "Backup exists but database already exists; skipping restore. Set FORCE_DB_RESTORE=true to overwrite."
else
    echo "No backup file found at ${BACKUP_PATH}; proceeding without restore."
fi

if [[ "${db_exists}" == "false" ]]; then
    echo "Creating database [${DB_NAME}]..."
    sql_query "IF DB_ID(N'${DB_NAME}') IS NULL CREATE DATABASE [${DB_NAME}];"
fi

if [[ -f "${INIT_SQL_PATH}" ]]; then
    script_name="$(basename "${INIT_SQL_PATH}")"
    echo "Found init SQL script ${script_name}."

    sql_query "USE [${DB_NAME}]; IF OBJECT_ID(N'dbo.__InitHistory', N'U') IS NULL BEGIN CREATE TABLE dbo.__InitHistory (ScriptName nvarchar(260) NOT NULL PRIMARY KEY, AppliedAtUtc datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME()); END;"
    already_applied="$(sql_scalar "USE [${DB_NAME}]; SET NOCOUNT ON; SELECT COUNT(1) FROM dbo.__InitHistory WHERE ScriptName = N'${script_name}';")"

    if [[ -z "${already_applied}" || "${already_applied}" == "0" ]]; then
        echo "Applying init SQL script..."
        "${SQLCMD_BIN}" -C -S "${SQL_HOST},${SQL_PORT}" -U "${SQL_USER}" -P "${SQL_PASSWORD}" -b -d "${DB_NAME}" -i "${INIT_SQL_PATH}"
        sql_query "USE [${DB_NAME}]; INSERT INTO dbo.__InitHistory (ScriptName) VALUES (N'${script_name}');"
    else
        echo "Init SQL script already applied, skipping."
    fi
else
    echo "No init SQL script found at ${INIT_SQL_PATH}; skipping."
fi

echo "Database bootstrap completed."

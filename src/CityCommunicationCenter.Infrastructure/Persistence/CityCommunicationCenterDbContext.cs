using System.Data;
using System.Data.SqlClient;
using CityCommunicationCenter.Domain.Entities;
using CityCommunicationCenter.Domain.Enums;

namespace CityCommunicationCenter.Infrastructure.Persistence;

public sealed class CityCommunicationCenterDbContext : IDisposable
{
    private readonly string _connectionString;
    private readonly int _commandTimeoutSeconds;
    private readonly List<Func<SqlConnection, Task>> _pendingOperations = new();

    public CityCommunicationCenterDbContext(string connectionString, int commandTimeoutSeconds = 30)
    {
        _connectionString = connectionString;
        _commandTimeoutSeconds = commandTimeoutSeconds;
    }

    public SqlDbSet<Tenant> Tenants => new(_connectionString, "Tenants", MapTenant);
    public SqlDbSet<TenantSetting> TenantSettings => new(_connectionString, "TenantSettings", MapTenantSetting);
    public SqlDbSet<Department> Departments => new(_connectionString, "Departments", MapDepartment);
    public SqlDbSet<ApplicationUser> Users => new(_connectionString, "Users", MapUser);
    public SqlDbSet<SocialMessage> SocialMessages => new(_connectionString, "SocialMessages", MapSocialMessage);
    public SqlDbSet<WorkTask> Tasks => new(_connectionString, "Tasks", MapTask);
    public SqlDbSet<Approval> Approvals => new(_connectionString, "Approvals", MapApproval);
    public SqlDbSet<AssignmentHistory> AssignmentHistories => new(_connectionString, "AssignmentHistory", MapAssignmentHistory);
    public SqlDbSet<Notification> Notifications => new(_connectionString, "Notifications", MapNotification);
    public SqlDbSet<AuditLog> AuditLogs => new(_connectionString, "AuditLogs", MapAuditLog);
    public SqlDbSet<RoutingRule> RoutingRules => new(_connectionString, "RoutingRules", MapRoutingRule);

    public void AddPendingOperation(Func<SqlConnection, Task> operation) => _pendingOperations.Add(operation);

    public async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        if (_pendingOperations.Count == 0) return 0;

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);

        foreach (var operation in _pendingOperations)
        {
            await operation(connection);
        }

        var count = _pendingOperations.Count;
        _pendingOperations.Clear();
        return count;
    }

    public void Dispose() => _pendingOperations.Clear();

    private SqlCommand CreateCommand(SqlConnection connection)
    {
        var command = connection.CreateCommand();
        command.CommandTimeout = _commandTimeoutSeconds;
        return command;
    }

    /// <summary>
    /// Adds a parameter using NVarChar for strings to preserve Turkish/Unicode characters.
    /// AddWithValue infers VARCHAR for C# strings which loses non-ASCII chars on Latin1 collations.
    /// </summary>
    private static void AddParam(SqlCommand cmd, string name, object? value)
    {
        if (value is string s)
        {
            var p = cmd.Parameters.Add(name, SqlDbType.NVarChar, Math.Max(s.Length * 2, 4000));
            p.Value = s;
        }
        else
        {
            cmd.Parameters.AddWithValue(name, value ?? DBNull.Value);
        }
    }

    #region Insert Methods

    public async Task InsertAuditLogAsync(AuditLog log, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = CreateCommand(conn);
        cmd.CommandText = @"INSERT INTO dbo.AuditLogs (AuditLogId, TenantId, EntityType, EntityId, Action, ActorUserId, EventTimeUtc, Details)
                            VALUES (@Id, @TenantId, @EntityType, @EntityId, @Action, @ActorUserId, @EventTimeUtc, @Details)";
        AddParam(cmd, "@Id", log.AuditLogId);
        AddParam(cmd, "@TenantId", log.TenantId);
        AddParam(cmd, "@EntityType", log.EntityType);
        AddParam(cmd, "@EntityId", log.EntityId);
        AddParam(cmd, "@Action", log.Action);
        AddParam(cmd, "@ActorUserId", (object?)log.ActorUserId ?? DBNull.Value);
        AddParam(cmd, "@EventTimeUtc", log.EventTimeUtc);
        AddParam(cmd, "@Details", (object?)log.Details ?? DBNull.Value);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task InsertDepartmentAsync(Department dept, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = CreateCommand(conn);
        cmd.CommandText = @"INSERT INTO dbo.Departments (DepartmentId, TenantId, Name, DepartmentType, ParentDepartmentId, ManagerUserId)
                            VALUES (@Id, @TenantId, @Name, @DeptType, @ParentId, @ManagerId)";
        AddParam(cmd, "@Id", dept.DepartmentId);
        AddParam(cmd, "@TenantId", dept.TenantId);
        AddParam(cmd, "@Name", dept.Name);
        AddParam(cmd, "@DeptType", dept.DepartmentType);
        AddParam(cmd, "@ParentId", (object?)dept.ParentDepartmentId ?? DBNull.Value);
        AddParam(cmd, "@ManagerId", (object?)dept.ManagerUserId ?? DBNull.Value);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task InsertNotificationAsync(Notification n, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = CreateCommand(conn);
        cmd.CommandText = @"INSERT INTO dbo.Notifications (NotificationId, TenantId, TaskId, UserId, Channel, DeliveryStatus, Message, SentAtUtc)
                            VALUES (@Id, @TenantId, @TaskId, @UserId, @Channel, @DeliveryStatus, @Message, @SentAtUtc)";
        AddParam(cmd, "@Id", n.NotificationId);
        AddParam(cmd, "@TenantId", n.TenantId);
        AddParam(cmd, "@TaskId", (object?)n.TaskId ?? DBNull.Value);
        AddParam(cmd, "@UserId", n.UserId);
        AddParam(cmd, "@Channel", n.Channel.ToString());
        AddParam(cmd, "@DeliveryStatus", n.DeliveryStatus.ToString());
        AddParam(cmd, "@Message", n.Message);
        AddParam(cmd, "@SentAtUtc", (object?)n.SentAtUtc ?? DBNull.Value);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task InsertSocialMessageAsync(SocialMessage msg, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = CreateCommand(conn);
        cmd.CommandText = @"INSERT INTO dbo.SocialMessages (SocialMessageId, TenantId, Channel, ExternalMessageId, CitizenHandle, Content, Category, Tags, Status, AssignedDepartmentId, TaskId, ReceivedAtUtc)
                            VALUES (@Id, @TenantId, @Channel, @ExtId, @Handle, @Content, @Category, @Tags, @Status, @AssignedDeptId, @TaskId, @ReceivedAt)";
        AddParam(cmd, "@Id", msg.SocialMessageId);
        AddParam(cmd, "@TenantId", msg.TenantId);
        AddParam(cmd, "@Channel", msg.Channel.ToString());
        AddParam(cmd, "@ExtId", msg.ExternalMessageId);
        AddParam(cmd, "@Handle", msg.CitizenHandle);
        AddParam(cmd, "@Content", msg.Content);
        AddParam(cmd, "@Category", (object?)msg.Category ?? DBNull.Value);
        AddParam(cmd, "@Tags", msg.Tags ?? string.Empty);
        AddParam(cmd, "@Status", msg.Status.ToString());
        AddParam(cmd, "@AssignedDeptId", (object?)msg.AssignedDepartmentId ?? DBNull.Value);
        AddParam(cmd, "@TaskId", (object?)msg.TaskId ?? DBNull.Value);
        AddParam(cmd, "@ReceivedAt", msg.ReceivedAtUtc);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task InsertTaskAsync(WorkTask task, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = CreateCommand(conn);
        cmd.CommandText = @"INSERT INTO dbo.Tasks (TaskId, TenantId, Title, Description, TaskType, SourceType, SourceRefId, TargetDepartmentId, AssignedDepartmentId, AssignedUserId, CurrentStatus, Priority, DueDateUtc)
                            VALUES (@Id, @TenantId, @Title, @Desc, @TaskType, @SourceType, @SourceRefId, @TargetDeptId, @AssignedDeptId, @AssignedUserId, @Status, @Priority, @DueDate)";
        AddParam(cmd, "@Id", task.TaskId);
        AddParam(cmd, "@TenantId", task.TenantId);
        AddParam(cmd, "@Title", task.Title);
        AddParam(cmd, "@Desc", task.Description);
        AddParam(cmd, "@TaskType", task.TaskType.ToString());
        AddParam(cmd, "@SourceType", task.SourceType.ToString());
        AddParam(cmd, "@SourceRefId", (object?)task.SourceRefId ?? DBNull.Value);
        AddParam(cmd, "@TargetDeptId", (object?)task.TargetDepartmentId ?? DBNull.Value);
        AddParam(cmd, "@AssignedDeptId", (object?)task.AssignedDepartmentId ?? DBNull.Value);
        AddParam(cmd, "@AssignedUserId", (object?)task.AssignedUserId ?? DBNull.Value);
        AddParam(cmd, "@Status", task.CurrentStatus.ToString());
        AddParam(cmd, "@Priority", task.Priority);
        AddParam(cmd, "@DueDate", (object?)task.DueDateUtc ?? DBNull.Value);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task InsertApprovalAsync(Approval approval, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = CreateCommand(conn);
        cmd.CommandText = @"INSERT INTO dbo.Approvals (ApprovalId, TenantId, TaskId, ApproverUserId, StepOrder, Decision, Comment, DecisionDateUtc)
                            VALUES (@Id, @TenantId, @TaskId, @ApproverUserId, @StepOrder, @Decision, @Comment, @DecisionDate)";
        AddParam(cmd, "@Id", approval.ApprovalId);
        AddParam(cmd, "@TenantId", approval.TenantId);
        AddParam(cmd, "@TaskId", approval.TaskId);
        AddParam(cmd, "@ApproverUserId", approval.ApproverUserId);
        AddParam(cmd, "@StepOrder", approval.StepOrder);
        AddParam(cmd, "@Decision", approval.Decision.ToString());
        AddParam(cmd, "@Comment", (object?)approval.Comment ?? DBNull.Value);
        AddParam(cmd, "@DecisionDate", (object?)approval.DecisionDateUtc ?? DBNull.Value);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task InsertAssignmentHistoryAsync(AssignmentHistory ah, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = CreateCommand(conn);
        cmd.CommandText = @"INSERT INTO dbo.AssignmentHistory (AssignmentId, TenantId, TaskId, FromDepartmentId, ToDepartmentId, FromUserId, ToUserId, ActionType, ActionDateUtc)
                            VALUES (@Id, @TenantId, @TaskId, @FromDeptId, @ToDeptId, @FromUserId, @ToUserId, @ActionType, @ActionDate)";
        AddParam(cmd, "@Id", ah.AssignmentId);
        AddParam(cmd, "@TenantId", ah.TenantId);
        AddParam(cmd, "@TaskId", ah.TaskId);
        AddParam(cmd, "@FromDeptId", (object?)ah.FromDepartmentId ?? DBNull.Value);
        AddParam(cmd, "@ToDeptId", (object?)ah.ToDepartmentId ?? DBNull.Value);
        AddParam(cmd, "@FromUserId", (object?)ah.FromUserId ?? DBNull.Value);
        AddParam(cmd, "@ToUserId", (object?)ah.ToUserId ?? DBNull.Value);
        AddParam(cmd, "@ActionType", ah.ActionType);
        AddParam(cmd, "@ActionDate", ah.ActionDateUtc);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task InsertUserAsync(ApplicationUser user, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = CreateCommand(conn);
        cmd.CommandText = @"INSERT INTO dbo.Users (UserId, TenantId, DepartmentId, DisplayName, Email, ExternalIdentityId, ManagerUserId, RoleCode, IsActive, CreatedByUserId)
                            VALUES (@UserId, @TenantId, @DepartmentId, @DisplayName, @Email, @ExternalIdentityId, @ManagerUserId, @RoleCode, @IsActive, @CreatedByUserId)";
        AddParam(cmd, "@UserId", user.UserId);
        AddParam(cmd, "@TenantId", user.TenantId);
        AddParam(cmd, "@DepartmentId", user.DepartmentId);
        AddParam(cmd, "@DisplayName", user.DisplayName);
        AddParam(cmd, "@Email", (object?)user.Email ?? DBNull.Value);
        AddParam(cmd, "@ExternalIdentityId", (object?)user.ExternalIdentityId ?? DBNull.Value);
        AddParam(cmd, "@ManagerUserId", (object?)user.ManagerUserId ?? DBNull.Value);
        AddParam(cmd, "@RoleCode", user.RoleCode.ToString());
        AddParam(cmd, "@IsActive", user.IsActive);
        AddParam(cmd, "@CreatedByUserId", (object?)user.CreatedByUserId ?? DBNull.Value);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task InsertTenantSettingAsync(TenantSetting ts, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = CreateCommand(conn);
        cmd.CommandText = @"INSERT INTO dbo.TenantSettings (TenantSettingId, TenantId, DisplayName, Theme, Domain, DefaultSlaHours)
                            VALUES (@Id, @TenantId, @DisplayName, @Theme, @Domain, @DefaultSlaHours)";
        AddParam(cmd, "@Id", ts.TenantSettingId);
        AddParam(cmd, "@TenantId", ts.TenantId);
        AddParam(cmd, "@DisplayName", ts.DisplayName);
        AddParam(cmd, "@Theme", (object?)ts.Theme ?? DBNull.Value);
        AddParam(cmd, "@Domain", (object?)ts.Domain ?? DBNull.Value);
        AddParam(cmd, "@DefaultSlaHours", ts.DefaultSlaHours);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task<bool> TryBootstrapTenantAsync(
        Tenant tenant,
        Department adminDepartment,
        ApplicationUser adminUser,
        TenantSetting tenantSetting,
        CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(ct);
        await using var tx = (SqlTransaction)await conn.BeginTransactionAsync(ct);

        await using (var checkCmd = CreateCommand(conn))
        {
            checkCmd.Transaction = tx;
            checkCmd.CommandText = "SELECT COUNT(1) FROM dbo.Tenants WITH (UPDLOCK, HOLDLOCK)";
            var tenantCount = Convert.ToInt32(await checkCmd.ExecuteScalarAsync(ct));
            if (tenantCount > 0)
            {
                await tx.RollbackAsync(ct);
                return false;
            }
        }

        await using (var tenantCmd = CreateCommand(conn))
        {
            tenantCmd.Transaction = tx;
            tenantCmd.CommandText = @"INSERT INTO dbo.Tenants (TenantId, MunicipalityName, DisplayName, DeploymentMode, IsActive, Theme, Domain)
                                      VALUES (@TenantId, @MunicipalityName, @DisplayName, @DeploymentMode, @IsActive, @Theme, @Domain)";
            AddParam(tenantCmd, "@TenantId", tenant.TenantId);
            AddParam(tenantCmd, "@MunicipalityName", tenant.MunicipalityName);
            AddParam(tenantCmd, "@DisplayName", tenant.DisplayName);
            AddParam(tenantCmd, "@DeploymentMode", tenant.DeploymentMode.ToString());
            AddParam(tenantCmd, "@IsActive", tenant.IsActive);
            AddParam(tenantCmd, "@Theme", (object?)tenant.Theme ?? DBNull.Value);
            AddParam(tenantCmd, "@Domain", (object?)tenant.Domain ?? DBNull.Value);
            await tenantCmd.ExecuteNonQueryAsync(ct);
        }

        await using (var departmentCmd = CreateCommand(conn))
        {
            departmentCmd.Transaction = tx;
            departmentCmd.CommandText = @"INSERT INTO dbo.Departments (DepartmentId, TenantId, Name, DepartmentType, ParentDepartmentId, ManagerUserId, CreatedByUserId)
                                          VALUES (@DepartmentId, @TenantId, @Name, @DepartmentType, @ParentDepartmentId, @ManagerUserId, @CreatedByUserId)";
            AddParam(departmentCmd, "@DepartmentId", adminDepartment.DepartmentId);
            AddParam(departmentCmd, "@TenantId", adminDepartment.TenantId);
            AddParam(departmentCmd, "@Name", adminDepartment.Name);
            AddParam(departmentCmd, "@DepartmentType", adminDepartment.DepartmentType);
            AddParam(departmentCmd, "@ParentDepartmentId", (object?)adminDepartment.ParentDepartmentId ?? DBNull.Value);
            AddParam(departmentCmd, "@ManagerUserId", (object?)adminDepartment.ManagerUserId ?? DBNull.Value);
            AddParam(departmentCmd, "@CreatedByUserId", (object?)adminDepartment.CreatedByUserId ?? DBNull.Value);
            await departmentCmd.ExecuteNonQueryAsync(ct);
        }

        await using (var userCmd = CreateCommand(conn))
        {
            userCmd.Transaction = tx;
            userCmd.CommandText = @"INSERT INTO dbo.Users (UserId, TenantId, DepartmentId, DisplayName, Email, ExternalIdentityId, ManagerUserId, RoleCode, IsActive, CreatedByUserId)
                                    VALUES (@UserId, @TenantId, @DepartmentId, @DisplayName, @Email, @ExternalIdentityId, @ManagerUserId, @RoleCode, @IsActive, @CreatedByUserId)";
            AddParam(userCmd, "@UserId", adminUser.UserId);
            AddParam(userCmd, "@TenantId", adminUser.TenantId);
            AddParam(userCmd, "@DepartmentId", adminUser.DepartmentId);
            AddParam(userCmd, "@DisplayName", adminUser.DisplayName);
            AddParam(userCmd, "@Email", (object?)adminUser.Email ?? DBNull.Value);
            AddParam(userCmd, "@ExternalIdentityId", (object?)adminUser.ExternalIdentityId ?? DBNull.Value);
            AddParam(userCmd, "@ManagerUserId", (object?)adminUser.ManagerUserId ?? DBNull.Value);
            AddParam(userCmd, "@RoleCode", adminUser.RoleCode.ToString());
            AddParam(userCmd, "@IsActive", adminUser.IsActive);
            AddParam(userCmd, "@CreatedByUserId", (object?)adminUser.CreatedByUserId ?? DBNull.Value);
            await userCmd.ExecuteNonQueryAsync(ct);
        }

        await using (var managerUpdateCmd = CreateCommand(conn))
        {
            managerUpdateCmd.Transaction = tx;
            managerUpdateCmd.CommandText = @"UPDATE dbo.Departments
                                             SET ManagerUserId = @ManagerUserId
                                             WHERE DepartmentId = @DepartmentId";
            AddParam(managerUpdateCmd, "@ManagerUserId", adminUser.UserId);
            AddParam(managerUpdateCmd, "@DepartmentId", adminDepartment.DepartmentId);
            await managerUpdateCmd.ExecuteNonQueryAsync(ct);
        }

        await using (var settingCmd = CreateCommand(conn))
        {
            settingCmd.Transaction = tx;
            settingCmd.CommandText = @"INSERT INTO dbo.TenantSettings (TenantSettingId, TenantId, DisplayName, Theme, Domain, DefaultSlaHours, AutoRoutingEnabled, CreatedByUserId)
                                       VALUES (@TenantSettingId, @TenantId, @DisplayName, @Theme, @Domain, @DefaultSlaHours, @AutoRoutingEnabled, @CreatedByUserId)";
            AddParam(settingCmd, "@TenantSettingId", tenantSetting.TenantSettingId);
            AddParam(settingCmd, "@TenantId", tenantSetting.TenantId);
            AddParam(settingCmd, "@DisplayName", tenantSetting.DisplayName);
            AddParam(settingCmd, "@Theme", (object?)tenantSetting.Theme ?? DBNull.Value);
            AddParam(settingCmd, "@Domain", (object?)tenantSetting.Domain ?? DBNull.Value);
            AddParam(settingCmd, "@DefaultSlaHours", tenantSetting.DefaultSlaHours);
            AddParam(settingCmd, "@AutoRoutingEnabled", tenantSetting.AutoRoutingEnabled);
            AddParam(settingCmd, "@CreatedByUserId", (object?)tenantSetting.CreatedByUserId ?? DBNull.Value);
            await settingCmd.ExecuteNonQueryAsync(ct);
        }

        await tx.CommitAsync(ct);
        return true;
    }

    #endregion

    #region Update Methods

    public async Task UpdateTaskStatusAsync(Guid taskId, Domain.Enums.TaskStatus status, Guid? updatedBy, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = CreateCommand(conn);
        cmd.CommandText = @"UPDATE dbo.Tasks SET CurrentStatus = @Status, UpdatedAtUtc = @Now, UpdatedByUserId = @UpdatedBy WHERE TaskId = @Id";
        AddParam(cmd, "@Status", status.ToString());
        AddParam(cmd, "@Now", DateTimeOffset.UtcNow);
        AddParam(cmd, "@UpdatedBy", (object?)updatedBy ?? DBNull.Value);
        AddParam(cmd, "@Id", taskId);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task UpdateTaskAssignmentAsync(Guid taskId, Guid? deptId, Guid? userId, Guid? updatedBy, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = CreateCommand(conn);
        cmd.CommandText = @"UPDATE dbo.Tasks SET AssignedDepartmentId = @DeptId, AssignedUserId = @UserId, CurrentStatus = 'Assigned', UpdatedAtUtc = @Now, UpdatedByUserId = @UpdatedBy WHERE TaskId = @Id";
        AddParam(cmd, "@DeptId", (object?)deptId ?? DBNull.Value);
        AddParam(cmd, "@UserId", (object?)userId ?? DBNull.Value);
        AddParam(cmd, "@Now", DateTimeOffset.UtcNow);
        AddParam(cmd, "@UpdatedBy", (object?)updatedBy ?? DBNull.Value);
        AddParam(cmd, "@Id", taskId);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task UpdateTaskCompletedAsync(Guid taskId, Guid? updatedBy, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = CreateCommand(conn);
        cmd.CommandText = @"UPDATE dbo.Tasks SET CurrentStatus = 'Completed', CompletedAtUtc = @Now, UpdatedAtUtc = @Now, UpdatedByUserId = @UpdatedBy WHERE TaskId = @Id";
        AddParam(cmd, "@Now", DateTimeOffset.UtcNow);
        AddParam(cmd, "@UpdatedBy", (object?)updatedBy ?? DBNull.Value);
        AddParam(cmd, "@Id", taskId);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task UpdateTaskClosedAsync(Guid taskId, Guid? updatedBy, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = CreateCommand(conn);
        cmd.CommandText = @"UPDATE dbo.Tasks SET CurrentStatus = 'Closed', ClosedAtUtc = @Now, UpdatedAtUtc = @Now, UpdatedByUserId = @UpdatedBy WHERE TaskId = @Id";
        AddParam(cmd, "@Now", DateTimeOffset.UtcNow);
        AddParam(cmd, "@UpdatedBy", (object?)updatedBy ?? DBNull.Value);
        AddParam(cmd, "@Id", taskId);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task UpdateUserDirectoryProfileAsync(
        Guid userId,
        string? externalIdentityId,
        string? email,
        string? displayName,
        CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = CreateCommand(conn);
        cmd.CommandText = @"UPDATE dbo.Users
                            SET ExternalIdentityId = COALESCE(NULLIF(@ExternalIdentityId, ''), ExternalIdentityId),
                                Email = COALESCE(NULLIF(@Email, ''), Email),
                                DisplayName = COALESCE(NULLIF(@DisplayName, ''), DisplayName),
                                UpdatedAtUtc = @Now
                            WHERE UserId = @UserId";
        AddParam(cmd, "@ExternalIdentityId", (object?)externalIdentityId ?? DBNull.Value);
        AddParam(cmd, "@Email", (object?)email ?? DBNull.Value);
        AddParam(cmd, "@DisplayName", (object?)displayName ?? DBNull.Value);
        AddParam(cmd, "@Now", DateTimeOffset.UtcNow);
        AddParam(cmd, "@UserId", userId);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task UpdateSocialMessageCategoryAsync(Guid msgId, string? category, string tags, Guid? updatedBy, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = CreateCommand(conn);
        cmd.CommandText = @"UPDATE dbo.SocialMessages SET Category = @Category, Tags = @Tags, Status = 'Categorized', UpdatedAtUtc = @Now, UpdatedByUserId = @UpdatedBy WHERE SocialMessageId = @Id";
        AddParam(cmd, "@Category", (object?)category ?? DBNull.Value);
        AddParam(cmd, "@Tags", tags);
        AddParam(cmd, "@Now", DateTimeOffset.UtcNow);
        AddParam(cmd, "@UpdatedBy", (object?)updatedBy ?? DBNull.Value);
        AddParam(cmd, "@Id", msgId);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task UpdateSocialMessageRouteAsync(Guid msgId, Guid? deptId, Guid? updatedBy, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = CreateCommand(conn);
        cmd.CommandText = @"UPDATE dbo.SocialMessages SET AssignedDepartmentId = @DeptId, Status = 'Routed', UpdatedAtUtc = @Now, UpdatedByUserId = @UpdatedBy WHERE SocialMessageId = @Id";
        AddParam(cmd, "@DeptId", (object?)deptId ?? DBNull.Value);
        AddParam(cmd, "@Now", DateTimeOffset.UtcNow);
        AddParam(cmd, "@UpdatedBy", (object?)updatedBy ?? DBNull.Value);
        AddParam(cmd, "@Id", msgId);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task UpdateSocialMessageConvertedAsync(Guid msgId, Guid taskId, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = CreateCommand(conn);
        cmd.CommandText = @"UPDATE dbo.SocialMessages SET TaskId = @TaskId, Status = 'ConvertedToTask' WHERE SocialMessageId = @Id";
        AddParam(cmd, "@TaskId", taskId);
        AddParam(cmd, "@Id", msgId);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task UpsertTenantSettingAsync(TenantSetting ts, Guid? updatedBy, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(ct);
        
        // Check if exists
        await using var checkCmd = CreateCommand(conn);
        checkCmd.CommandText = "SELECT COUNT(1) FROM dbo.TenantSettings WHERE TenantId = @TenantId";
        AddParam(checkCmd, "@TenantId", ts.TenantId);
        var exists = (int)await checkCmd.ExecuteScalarAsync(ct) > 0;

        if (exists)
        {
            await using var cmd = CreateCommand(conn);
            cmd.CommandText = @"UPDATE dbo.TenantSettings SET DisplayName = @DisplayName, Theme = @Theme, Domain = @Domain, DefaultSlaHours = @DefaultSlaHours, UpdatedAtUtc = @Now, UpdatedByUserId = @UpdatedBy WHERE TenantId = @TenantId";
            AddParam(cmd, "@DisplayName", ts.DisplayName);
            AddParam(cmd, "@Theme", (object?)ts.Theme ?? DBNull.Value);
            AddParam(cmd, "@Domain", (object?)ts.Domain ?? DBNull.Value);
            AddParam(cmd, "@DefaultSlaHours", ts.DefaultSlaHours);
            AddParam(cmd, "@Now", DateTimeOffset.UtcNow);
            AddParam(cmd, "@UpdatedBy", (object?)updatedBy ?? DBNull.Value);
            AddParam(cmd, "@TenantId", ts.TenantId);
            await cmd.ExecuteNonQueryAsync(ct);
        }
        else
        {
            await InsertTenantSettingAsync(ts, ct);
        }
    }

    public async Task SetAutoRoutingEnabledAsync(Guid tenantId, bool enabled, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = CreateCommand(conn);
        cmd.CommandText = @"UPDATE dbo.TenantSettings SET AutoRoutingEnabled = @Enabled, UpdatedAtUtc = @Now WHERE TenantId = @TenantId";
        AddParam(cmd, "@Enabled", enabled);
        AddParam(cmd, "@Now", DateTimeOffset.UtcNow);
        AddParam(cmd, "@TenantId", tenantId);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task<string?> GetMenuVisibilityRulesJsonAsync(Guid tenantId, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(ct);
        await EnsureTenantSettingsMenuVisibilityColumnAsync(conn, null, ct);

        await using var cmd = CreateCommand(conn);
        cmd.CommandText = "SELECT MenuVisibilityRulesJson FROM dbo.TenantSettings WHERE TenantId = @TenantId";
        AddParam(cmd, "@TenantId", tenantId);

        var value = await cmd.ExecuteScalarAsync(ct);
        if (value is null || value == DBNull.Value)
        {
            return null;
        }

        return Convert.ToString(value);
    }

    public async Task SetMenuVisibilityRulesJsonAsync(
        Guid tenantId,
        string? menuVisibilityRulesJson,
        Guid? updatedBy,
        CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(ct);
        await EnsureTenantSettingsMenuVisibilityColumnAsync(conn, null, ct);

        await using var checkCmd = CreateCommand(conn);
        checkCmd.CommandText = "SELECT COUNT(1) FROM dbo.TenantSettings WHERE TenantId = @TenantId";
        AddParam(checkCmd, "@TenantId", tenantId);
        var settingsExists = (int)await checkCmd.ExecuteScalarAsync(ct) > 0;

        if (settingsExists)
        {
            await using var updateCmd = CreateCommand(conn);
            updateCmd.CommandText = @"UPDATE dbo.TenantSettings
                                      SET MenuVisibilityRulesJson = @MenuVisibilityRulesJson,
                                          UpdatedAtUtc = @Now,
                                          UpdatedByUserId = @UpdatedByUserId
                                      WHERE TenantId = @TenantId";
            AddParam(updateCmd, "@MenuVisibilityRulesJson", (object?)menuVisibilityRulesJson ?? DBNull.Value);
            AddParam(updateCmd, "@Now", DateTimeOffset.UtcNow);
            AddParam(updateCmd, "@UpdatedByUserId", (object?)updatedBy ?? DBNull.Value);
            AddParam(updateCmd, "@TenantId", tenantId);
            await updateCmd.ExecuteNonQueryAsync(ct);
            return;
        }

        await using var insertCmd = CreateCommand(conn);
        insertCmd.CommandText = @"INSERT INTO dbo.TenantSettings
                                     (TenantSettingId, TenantId, DisplayName, Theme, Domain, DefaultSlaHours, AutoRoutingEnabled, MenuVisibilityRulesJson, CreatedByUserId)
                                  SELECT
                                     NEWID(),
                                     t.TenantId,
                                     t.DisplayName,
                                     t.Theme,
                                     t.Domain,
                                     48,
                                     CAST(0 AS bit),
                                     @MenuVisibilityRulesJson,
                                     @CreatedByUserId
                                  FROM dbo.Tenants t
                                  WHERE t.TenantId = @TenantId";
        AddParam(insertCmd, "@TenantId", tenantId);
        AddParam(insertCmd, "@MenuVisibilityRulesJson", (object?)menuVisibilityRulesJson ?? DBNull.Value);
        AddParam(insertCmd, "@CreatedByUserId", (object?)updatedBy ?? DBNull.Value);
        var inserted = await insertCmd.ExecuteNonQueryAsync(ct);

        if (inserted == 0)
        {
            throw new InvalidOperationException($"Tenant settings could not be created for tenant {tenantId}.");
        }
    }

    #endregion

    #region Routing Rules Methods

    public async Task InsertRoutingRuleAsync(RoutingRule rule, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = CreateCommand(conn);
        cmd.CommandText = @"INSERT INTO dbo.RoutingRules (RuleId, TenantId, RuleName, Keywords, TargetDepartmentId, Priority, IsActive, CreatedAtUtc)
                            VALUES (@RuleId, @TenantId, @RuleName, @Keywords, @TargetDepartmentId, @Priority, @IsActive, @CreatedAtUtc)";
        AddParam(cmd, "@RuleId", rule.RuleId);
        AddParam(cmd, "@TenantId", rule.TenantId);
        AddParam(cmd, "@RuleName", rule.RuleName);
        AddParam(cmd, "@Keywords", rule.Keywords);
        AddParam(cmd, "@TargetDepartmentId", rule.TargetDepartmentId);
        AddParam(cmd, "@Priority", rule.Priority);
        AddParam(cmd, "@IsActive", rule.IsActive);
        AddParam(cmd, "@CreatedAtUtc", rule.CreatedAtUtc);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task UpdateRoutingRuleAsync(RoutingRule rule, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = CreateCommand(conn);
        cmd.CommandText = @"UPDATE dbo.RoutingRules SET RuleName = @RuleName, Keywords = @Keywords, TargetDepartmentId = @TargetDepartmentId, Priority = @Priority, IsActive = @IsActive WHERE RuleId = @RuleId";
        AddParam(cmd, "@RuleName", rule.RuleName);
        AddParam(cmd, "@Keywords", rule.Keywords);
        AddParam(cmd, "@TargetDepartmentId", rule.TargetDepartmentId);
        AddParam(cmd, "@Priority", rule.Priority);
        AddParam(cmd, "@IsActive", rule.IsActive);
        AddParam(cmd, "@RuleId", rule.RuleId);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task DeleteRoutingRuleAsync(Guid ruleId, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = CreateCommand(conn);
        cmd.CommandText = @"DELETE FROM dbo.RoutingRules WHERE RuleId = @RuleId";
        AddParam(cmd, "@RuleId", ruleId);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    #endregion

    #region Query Methods (for reports)

    public async Task<int> CountTasksAsync(Guid tenantId, Domain.Enums.TaskStatus? excludeStatus = null, Domain.Enums.TaskStatus? includeStatus = null, bool? overdue = null, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = CreateCommand(conn);
        
        var sql = "SELECT COUNT(*) FROM dbo.Tasks WHERE TenantId = @TenantId";
        AddParam(cmd, "@TenantId", tenantId);
        
        if (excludeStatus.HasValue)
        {
            sql += " AND CurrentStatus <> @ExcludeStatus";
            AddParam(cmd, "@ExcludeStatus", excludeStatus.Value.ToString());
        }
        if (includeStatus.HasValue)
        {
            sql += " AND CurrentStatus = @IncludeStatus";
            AddParam(cmd, "@IncludeStatus", includeStatus.Value.ToString());
        }
        if (overdue == true)
        {
            sql += " AND DueDateUtc < @Now";
            AddParam(cmd, "@Now", DateTimeOffset.UtcNow);
        }
        
        cmd.CommandText = sql;
        return (int)await cmd.ExecuteScalarAsync(ct);
    }

    public async Task<int> CountSocialMessagesAsync(Guid tenantId, SocialMessageStatus? excludeStatus = null, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = CreateCommand(conn);
        
        var sql = "SELECT COUNT(*) FROM dbo.SocialMessages WHERE TenantId = @TenantId";
        AddParam(cmd, "@TenantId", tenantId);
        
        if (excludeStatus.HasValue)
        {
            sql += " AND Status <> @ExcludeStatus";
            AddParam(cmd, "@ExcludeStatus", excludeStatus.Value.ToString());
        }
        
        cmd.CommandText = sql;
        return (int)await cmd.ExecuteScalarAsync(ct);
    }

    public async Task<int> CountFailedNotificationsAsync(Guid tenantId, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = CreateCommand(conn);
        cmd.CommandText = "SELECT COUNT(*) FROM dbo.Notifications WHERE TenantId = @TenantId AND DeliveryStatus = 'Failed'";
        AddParam(cmd, "@TenantId", tenantId);
        return (int)await cmd.ExecuteScalarAsync(ct);
    }

    public async Task<int> CountTasksDueTodayAsync(Guid tenantId, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(ct);
        var today = DateTime.UtcNow.Date;
        await using var cmd = CreateCommand(conn);
        cmd.CommandText = "SELECT COUNT(*) FROM dbo.Tasks WHERE TenantId = @TenantId AND CAST(DueDateUtc AS DATE) = @Today";
        AddParam(cmd, "@TenantId", tenantId);
        AddParam(cmd, "@Today", today);
        return (int)await cmd.ExecuteScalarAsync(ct);
    }

    public async Task<List<(Guid DeptId, int Count)>> GetWorkloadByDepartmentAsync(Guid tenantId, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = CreateCommand(conn);
        cmd.CommandText = @"SELECT TargetDepartmentId, COUNT(*) as Cnt 
                            FROM dbo.Tasks 
                            WHERE TenantId = @TenantId
                              AND TargetDepartmentId IS NOT NULL
                              AND CurrentStatus NOT IN ('Completed', 'Closed', 'Rejected')
                            GROUP BY TargetDepartmentId";
        AddParam(cmd, "@TenantId", tenantId);
        
        var results = new List<(Guid, int)>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            results.Add((reader.GetGuid(0), reader.GetInt32(1)));
        }
        return results;
    }

    public async Task<List<(string Channel, int Count)>> GetSocialTrendsAsync(Guid tenantId, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = CreateCommand(conn);
        cmd.CommandText = @"SELECT Channel, COUNT(*) as Cnt 
                            FROM dbo.SocialMessages 
                            WHERE TenantId = @TenantId
                            GROUP BY Channel";
        AddParam(cmd, "@TenantId", tenantId);
        
        var results = new List<(string, int)>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            results.Add((reader.GetString(0), reader.GetInt32(1)));
        }
        return results;
    }

    public async Task<List<Approval>> GetApprovalsForTaskAsync(Guid tenantId, Guid taskId, CancellationToken ct = default)
    {
        return await Approvals
            .WhereTenant(tenantId)
            .Where("TaskId = @TaskId", ("@TaskId", taskId))
            .ToListAsync(ct);
    }

    public async Task<List<AssignmentHistory>> GetAssignmentHistoryForTaskAsync(Guid tenantId, Guid taskId, CancellationToken ct = default)
    {
        return await AssignmentHistories
            .WhereTenant(tenantId)
            .Where("TaskId = @TaskId", ("@TaskId", taskId))
            .ToListAsync(ct);
    }

    public async Task<int> GetApprovalCountForTaskAsync(Guid taskId, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = CreateCommand(conn);
        cmd.CommandText = "SELECT COUNT(*) FROM dbo.Approvals WHERE TaskId = @TaskId";
        AddParam(cmd, "@TaskId", taskId);
        return (int)await cmd.ExecuteScalarAsync(ct);
    }

    #endregion

    private async Task EnsureTenantSettingsMenuVisibilityColumnAsync(
        SqlConnection connection,
        SqlTransaction? tx,
        CancellationToken ct)
    {
        await using var cmd = CreateCommand(connection);
        cmd.Transaction = tx;
        cmd.CommandText = @"IF COL_LENGTH('dbo.TenantSettings', 'MenuVisibilityRulesJson') IS NULL
                            BEGIN
                                ALTER TABLE dbo.TenantSettings
                                ADD MenuVisibilityRulesJson NVARCHAR(MAX) NULL;
                            END";
        await cmd.ExecuteNonQueryAsync(ct);
    }

    /// <summary>
    /// Idempotent migration: converts all VARCHAR text columns to NVARCHAR across all tables
    /// so Turkish/Unicode characters are preserved correctly.
    /// </summary>
    public async Task EnsureNVarCharColumnsAsync(CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = CreateCommand(conn);
        cmd.CommandText = @"
            DECLARE @sql NVARCHAR(MAX) = N'';

            -- Drop default constraints on VARCHAR columns first
            SELECT @sql = @sql 
                + N'ALTER TABLE ' + QUOTENAME(t.TABLE_SCHEMA) + N'.' + QUOTENAME(t.TABLE_NAME)
                + N' DROP CONSTRAINT ' + QUOTENAME(dc.name) + N'; '
            FROM INFORMATION_SCHEMA.COLUMNS t
            INNER JOIN sys.columns sc
                ON sc.name = t.COLUMN_NAME
                AND sc.object_id = OBJECT_ID(QUOTENAME(t.TABLE_SCHEMA) + N'.' + QUOTENAME(t.TABLE_NAME))
            INNER JOIN sys.default_constraints dc
                ON dc.parent_object_id = sc.object_id AND dc.parent_column_id = sc.column_id
            WHERE t.DATA_TYPE = 'varchar' AND t.TABLE_SCHEMA = 'dbo';

            -- Alter VARCHAR columns to NVARCHAR
            SELECT @sql = @sql 
                + N'ALTER TABLE ' + QUOTENAME(TABLE_SCHEMA) + N'.' + QUOTENAME(TABLE_NAME)
                + N' ALTER COLUMN ' + QUOTENAME(COLUMN_NAME) + N' NVARCHAR('
                + CASE WHEN CHARACTER_MAXIMUM_LENGTH = -1 THEN N'MAX'
                       WHEN CHARACTER_MAXIMUM_LENGTH > 0 THEN CAST(CHARACTER_MAXIMUM_LENGTH AS NVARCHAR(10))
                       ELSE N'4000' END
                + N')' + CASE WHEN IS_NULLABLE = 'YES' THEN N' NULL' ELSE N' NOT NULL' END + N'; '
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE DATA_TYPE = 'varchar' AND TABLE_SCHEMA = 'dbo';

            IF LEN(@sql) > 0
                EXEC sp_executesql @sql;";
        await cmd.ExecuteNonQueryAsync(ct);
    }

    private static Tenant MapTenant(SqlDataReader r) => new()
    {
        TenantId = r.GetGuid(r.GetOrdinal("TenantId")),
        MunicipalityName = r.GetString(r.GetOrdinal("MunicipalityName")),
        DisplayName = r.GetString(r.GetOrdinal("DisplayName")),
        DeploymentMode = Enum.TryParse<DeploymentMode>(r.GetString(r.GetOrdinal("DeploymentMode")), out var dm) ? dm : DeploymentMode.DedicatedHosted,
        IsActive = r.GetBoolean(r.GetOrdinal("IsActive")),
        Theme = r.IsDBNull(r.GetOrdinal("Theme")) ? null : r.GetString(r.GetOrdinal("Theme")),
        Domain = r.IsDBNull(r.GetOrdinal("Domain")) ? null : r.GetString(r.GetOrdinal("Domain")),
        CreatedAtUtc = r.GetDateTimeOffset(r.GetOrdinal("CreatedAtUtc"))
    };

    private static TenantSetting MapTenantSetting(SqlDataReader r) => new()
    {
        TenantSettingId = r.GetGuid(r.GetOrdinal("TenantSettingId")),
        TenantId = r.GetGuid(r.GetOrdinal("TenantId")),
        DisplayName = r.GetString(r.GetOrdinal("DisplayName")),
        Theme = r.IsDBNull(r.GetOrdinal("Theme")) ? null : r.GetString(r.GetOrdinal("Theme")),
        Domain = r.IsDBNull(r.GetOrdinal("Domain")) ? null : r.GetString(r.GetOrdinal("Domain")),
        DefaultSlaHours = r.GetInt32(r.GetOrdinal("DefaultSlaHours")),
        AutoRoutingEnabled = r.GetBoolean(r.GetOrdinal("AutoRoutingEnabled"))
    };

    private static Department MapDepartment(SqlDataReader r) => new()
    {
        DepartmentId = r.GetGuid(r.GetOrdinal("DepartmentId")),
        TenantId = r.GetGuid(r.GetOrdinal("TenantId")),
        Name = r.GetString(r.GetOrdinal("Name")),
        DepartmentType = r.GetString(r.GetOrdinal("DepartmentType")),
        ParentDepartmentId = r.IsDBNull(r.GetOrdinal("ParentDepartmentId")) ? null : r.GetGuid(r.GetOrdinal("ParentDepartmentId")),
        ManagerUserId = r.IsDBNull(r.GetOrdinal("ManagerUserId")) ? null : r.GetGuid(r.GetOrdinal("ManagerUserId"))
    };

    private static ApplicationUser MapUser(SqlDataReader r) => new()
    {
        UserId = r.GetGuid(r.GetOrdinal("UserId")),
        TenantId = r.GetGuid(r.GetOrdinal("TenantId")),
        DepartmentId = r.GetGuid(r.GetOrdinal("DepartmentId")),
        DisplayName = r.GetString(r.GetOrdinal("DisplayName")),
        Email = r.IsDBNull(r.GetOrdinal("Email")) ? null : r.GetString(r.GetOrdinal("Email")),
        ExternalIdentityId = r.IsDBNull(r.GetOrdinal("ExternalIdentityId")) ? null : r.GetString(r.GetOrdinal("ExternalIdentityId")),
        ManagerUserId = r.IsDBNull(r.GetOrdinal("ManagerUserId")) ? null : r.GetGuid(r.GetOrdinal("ManagerUserId")),
        RoleCode = Enum.TryParse<RoleCode>(r.GetString(r.GetOrdinal("RoleCode")), out var rc) ? rc : RoleCode.Staff,
        IsActive = r.GetBoolean(r.GetOrdinal("IsActive"))
    };

    private static SocialMessage MapSocialMessage(SqlDataReader r) => new()
    {
        SocialMessageId = r.GetGuid(r.GetOrdinal("SocialMessageId")),
        TenantId = r.GetGuid(r.GetOrdinal("TenantId")),
        Channel = Enum.TryParse<SocialChannel>(r.GetString(r.GetOrdinal("Channel")), out var ch) ? ch : SocialChannel.Other,
        ExternalMessageId = r.GetString(r.GetOrdinal("ExternalMessageId")),
        CitizenHandle = r.GetString(r.GetOrdinal("CitizenHandle")),
        Content = r.GetString(r.GetOrdinal("Content")),
        Category = r.IsDBNull(r.GetOrdinal("Category")) ? null : r.GetString(r.GetOrdinal("Category")),
        Tags = r.IsDBNull(r.GetOrdinal("Tags")) ? string.Empty : r.GetString(r.GetOrdinal("Tags")),
        Status = Enum.TryParse<SocialMessageStatus>(r.GetString(r.GetOrdinal("Status")), out var st) ? st : SocialMessageStatus.New,
        AssignedDepartmentId = r.IsDBNull(r.GetOrdinal("AssignedDepartmentId")) ? null : r.GetGuid(r.GetOrdinal("AssignedDepartmentId")),
        TaskId = r.IsDBNull(r.GetOrdinal("TaskId")) ? null : r.GetGuid(r.GetOrdinal("TaskId")),
        ReceivedAtUtc = r.GetDateTimeOffset(r.GetOrdinal("ReceivedAtUtc"))
    };

    private static WorkTask MapTask(SqlDataReader r) => new()
    {
        TaskId = r.GetGuid(r.GetOrdinal("TaskId")),
        TenantId = r.GetGuid(r.GetOrdinal("TenantId")),
        Title = r.GetString(r.GetOrdinal("Title")),
        Description = r.GetString(r.GetOrdinal("Description")),
        TaskType = Enum.TryParse<TaskType>(r.GetString(r.GetOrdinal("TaskType")), out var tt) ? tt : TaskType.InternalRequest,
        SourceType = Enum.TryParse<SourceType>(r.GetString(r.GetOrdinal("SourceType")), out var srt) ? srt : SourceType.Manual,
        SourceRefId = r.IsDBNull(r.GetOrdinal("SourceRefId")) ? null : r.GetGuid(r.GetOrdinal("SourceRefId")),
        TargetDepartmentId = r.IsDBNull(r.GetOrdinal("TargetDepartmentId")) ? null : r.GetGuid(r.GetOrdinal("TargetDepartmentId")),
        AssignedDepartmentId = r.IsDBNull(r.GetOrdinal("AssignedDepartmentId")) ? null : r.GetGuid(r.GetOrdinal("AssignedDepartmentId")),
        AssignedUserId = r.IsDBNull(r.GetOrdinal("AssignedUserId")) ? null : r.GetGuid(r.GetOrdinal("AssignedUserId")),
        CurrentStatus = Enum.TryParse<Domain.Enums.TaskStatus>(r.GetString(r.GetOrdinal("CurrentStatus")), out var cs) ? cs : Domain.Enums.TaskStatus.Draft,
        Priority = r.GetString(r.GetOrdinal("Priority")),
        DueDateUtc = r.IsDBNull(r.GetOrdinal("DueDateUtc")) ? null : r.GetDateTimeOffset(r.GetOrdinal("DueDateUtc")),
        CompletedAtUtc = r.IsDBNull(r.GetOrdinal("CompletedAtUtc")) ? null : r.GetDateTimeOffset(r.GetOrdinal("CompletedAtUtc")),
        ClosedAtUtc = r.IsDBNull(r.GetOrdinal("ClosedAtUtc")) ? null : r.GetDateTimeOffset(r.GetOrdinal("ClosedAtUtc"))
    };

    private static Approval MapApproval(SqlDataReader r) => new()
    {
        ApprovalId = r.GetGuid(r.GetOrdinal("ApprovalId")),
        TenantId = r.GetGuid(r.GetOrdinal("TenantId")),
        TaskId = r.GetGuid(r.GetOrdinal("TaskId")),
        ApproverUserId = r.GetGuid(r.GetOrdinal("ApproverUserId")),
        StepOrder = r.GetInt32(r.GetOrdinal("StepOrder")),
        Decision = Enum.TryParse<ApprovalDecision>(r.GetString(r.GetOrdinal("Decision")), out var ad) ? ad : ApprovalDecision.Pending,
        Comment = r.IsDBNull(r.GetOrdinal("Comment")) ? null : r.GetString(r.GetOrdinal("Comment")),
        DecisionDateUtc = r.IsDBNull(r.GetOrdinal("DecisionDateUtc")) ? null : r.GetDateTimeOffset(r.GetOrdinal("DecisionDateUtc"))
    };

    private static AssignmentHistory MapAssignmentHistory(SqlDataReader r) => new()
    {
        AssignmentId = r.GetGuid(r.GetOrdinal("AssignmentId")),
        TenantId = r.GetGuid(r.GetOrdinal("TenantId")),
        TaskId = r.GetGuid(r.GetOrdinal("TaskId")),
        FromDepartmentId = r.IsDBNull(r.GetOrdinal("FromDepartmentId")) ? null : r.GetGuid(r.GetOrdinal("FromDepartmentId")),
        ToDepartmentId = r.IsDBNull(r.GetOrdinal("ToDepartmentId")) ? null : r.GetGuid(r.GetOrdinal("ToDepartmentId")),
        FromUserId = r.IsDBNull(r.GetOrdinal("FromUserId")) ? null : r.GetGuid(r.GetOrdinal("FromUserId")),
        ToUserId = r.IsDBNull(r.GetOrdinal("ToUserId")) ? null : r.GetGuid(r.GetOrdinal("ToUserId")),
        ActionType = r.GetString(r.GetOrdinal("ActionType")),
        ActionDateUtc = r.GetDateTimeOffset(r.GetOrdinal("ActionDateUtc"))
    };

    private static Notification MapNotification(SqlDataReader r) => new()
    {
        NotificationId = r.GetGuid(r.GetOrdinal("NotificationId")),
        TenantId = r.GetGuid(r.GetOrdinal("TenantId")),
        TaskId = r.IsDBNull(r.GetOrdinal("TaskId")) ? null : r.GetGuid(r.GetOrdinal("TaskId")),
        UserId = r.GetGuid(r.GetOrdinal("UserId")),
        Channel = Enum.TryParse<NotificationChannel>(r.GetString(r.GetOrdinal("Channel")), out var nc) ? nc : NotificationChannel.InApp,
        DeliveryStatus = Enum.TryParse<NotificationDeliveryStatus>(r.GetString(r.GetOrdinal("DeliveryStatus")), out var ds) ? ds : NotificationDeliveryStatus.Pending,
        Message = r.GetString(r.GetOrdinal("Message")),
        SentAtUtc = r.IsDBNull(r.GetOrdinal("SentAtUtc")) ? null : r.GetDateTimeOffset(r.GetOrdinal("SentAtUtc"))
    };

    private static AuditLog MapAuditLog(SqlDataReader r) => new()
    {
        AuditLogId = r.GetGuid(r.GetOrdinal("AuditLogId")),
        TenantId = r.GetGuid(r.GetOrdinal("TenantId")),
        EntityType = r.GetString(r.GetOrdinal("EntityType")),
        EntityId = r.GetString(r.GetOrdinal("EntityId")),
        Action = r.GetString(r.GetOrdinal("Action")),
        ActorUserId = r.IsDBNull(r.GetOrdinal("ActorUserId")) ? null : r.GetGuid(r.GetOrdinal("ActorUserId")),
        EventTimeUtc = r.GetDateTimeOffset(r.GetOrdinal("EventTimeUtc")),
        Details = r.IsDBNull(r.GetOrdinal("Details")) ? null : r.GetString(r.GetOrdinal("Details"))
    };

    private static RoutingRule MapRoutingRule(SqlDataReader r) => new()
    {
        RuleId = r.GetGuid(r.GetOrdinal("RuleId")),
        TenantId = r.GetGuid(r.GetOrdinal("TenantId")),
        RuleName = r.GetString(r.GetOrdinal("RuleName")),
        Keywords = r.GetString(r.GetOrdinal("Keywords")),
        TargetDepartmentId = r.GetGuid(r.GetOrdinal("TargetDepartmentId")),
        Priority = r.GetInt32(r.GetOrdinal("Priority")),
        IsActive = r.GetBoolean(r.GetOrdinal("IsActive")),
        CreatedAtUtc = r.GetDateTimeOffset(r.GetOrdinal("CreatedAtUtc"))
    };
}

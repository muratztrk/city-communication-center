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

    #region Insert Methods

    public async Task InsertAuditLogAsync(AuditLog log, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = CreateCommand(conn);
        cmd.CommandText = @"INSERT INTO dbo.AuditLogs (AuditLogId, TenantId, EntityType, EntityId, Action, ActorUserId, EventTimeUtc, Details)
                            VALUES (@Id, @TenantId, @EntityType, @EntityId, @Action, @ActorUserId, @EventTimeUtc, @Details)";
        cmd.Parameters.AddWithValue("@Id", log.AuditLogId);
        cmd.Parameters.AddWithValue("@TenantId", log.TenantId);
        cmd.Parameters.AddWithValue("@EntityType", log.EntityType);
        cmd.Parameters.AddWithValue("@EntityId", log.EntityId);
        cmd.Parameters.AddWithValue("@Action", log.Action);
        cmd.Parameters.AddWithValue("@ActorUserId", (object?)log.ActorUserId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@EventTimeUtc", log.EventTimeUtc);
        cmd.Parameters.AddWithValue("@Details", (object?)log.Details ?? DBNull.Value);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task InsertDepartmentAsync(Department dept, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = CreateCommand(conn);
        cmd.CommandText = @"INSERT INTO dbo.Departments (DepartmentId, TenantId, Name, DepartmentType, ParentDepartmentId, ManagerUserId)
                            VALUES (@Id, @TenantId, @Name, @DeptType, @ParentId, @ManagerId)";
        cmd.Parameters.AddWithValue("@Id", dept.DepartmentId);
        cmd.Parameters.AddWithValue("@TenantId", dept.TenantId);
        cmd.Parameters.AddWithValue("@Name", dept.Name);
        cmd.Parameters.AddWithValue("@DeptType", dept.DepartmentType);
        cmd.Parameters.AddWithValue("@ParentId", (object?)dept.ParentDepartmentId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@ManagerId", (object?)dept.ManagerUserId ?? DBNull.Value);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task InsertNotificationAsync(Notification n, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = CreateCommand(conn);
        cmd.CommandText = @"INSERT INTO dbo.Notifications (NotificationId, TenantId, TaskId, UserId, Channel, DeliveryStatus, Message, SentAtUtc)
                            VALUES (@Id, @TenantId, @TaskId, @UserId, @Channel, @DeliveryStatus, @Message, @SentAtUtc)";
        cmd.Parameters.AddWithValue("@Id", n.NotificationId);
        cmd.Parameters.AddWithValue("@TenantId", n.TenantId);
        cmd.Parameters.AddWithValue("@TaskId", (object?)n.TaskId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@UserId", n.UserId);
        cmd.Parameters.AddWithValue("@Channel", n.Channel.ToString());
        cmd.Parameters.AddWithValue("@DeliveryStatus", n.DeliveryStatus.ToString());
        cmd.Parameters.AddWithValue("@Message", n.Message);
        cmd.Parameters.AddWithValue("@SentAtUtc", (object?)n.SentAtUtc ?? DBNull.Value);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task InsertSocialMessageAsync(SocialMessage msg, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = CreateCommand(conn);
        cmd.CommandText = @"INSERT INTO dbo.SocialMessages (SocialMessageId, TenantId, Channel, ExternalMessageId, CitizenHandle, Content, Category, Tags, Status, AssignedDepartmentId, TaskId, ReceivedAtUtc)
                            VALUES (@Id, @TenantId, @Channel, @ExtId, @Handle, @Content, @Category, @Tags, @Status, @AssignedDeptId, @TaskId, @ReceivedAt)";
        cmd.Parameters.AddWithValue("@Id", msg.SocialMessageId);
        cmd.Parameters.AddWithValue("@TenantId", msg.TenantId);
        cmd.Parameters.AddWithValue("@Channel", msg.Channel.ToString());
        cmd.Parameters.AddWithValue("@ExtId", msg.ExternalMessageId);
        cmd.Parameters.AddWithValue("@Handle", msg.CitizenHandle);
        cmd.Parameters.AddWithValue("@Content", msg.Content);
        cmd.Parameters.AddWithValue("@Category", (object?)msg.Category ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@Tags", msg.Tags ?? string.Empty);
        cmd.Parameters.AddWithValue("@Status", msg.Status.ToString());
        cmd.Parameters.AddWithValue("@AssignedDeptId", (object?)msg.AssignedDepartmentId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@TaskId", (object?)msg.TaskId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@ReceivedAt", msg.ReceivedAtUtc);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task InsertTaskAsync(WorkTask task, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = CreateCommand(conn);
        cmd.CommandText = @"INSERT INTO dbo.Tasks (TaskId, TenantId, Title, Description, TaskType, SourceType, SourceRefId, TargetDepartmentId, AssignedDepartmentId, AssignedUserId, CurrentStatus, Priority, DueDateUtc)
                            VALUES (@Id, @TenantId, @Title, @Desc, @TaskType, @SourceType, @SourceRefId, @TargetDeptId, @AssignedDeptId, @AssignedUserId, @Status, @Priority, @DueDate)";
        cmd.Parameters.AddWithValue("@Id", task.TaskId);
        cmd.Parameters.AddWithValue("@TenantId", task.TenantId);
        cmd.Parameters.AddWithValue("@Title", task.Title);
        cmd.Parameters.AddWithValue("@Desc", task.Description);
        cmd.Parameters.AddWithValue("@TaskType", task.TaskType.ToString());
        cmd.Parameters.AddWithValue("@SourceType", task.SourceType.ToString());
        cmd.Parameters.AddWithValue("@SourceRefId", (object?)task.SourceRefId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@TargetDeptId", (object?)task.TargetDepartmentId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@AssignedDeptId", (object?)task.AssignedDepartmentId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@AssignedUserId", (object?)task.AssignedUserId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@Status", task.CurrentStatus.ToString());
        cmd.Parameters.AddWithValue("@Priority", task.Priority);
        cmd.Parameters.AddWithValue("@DueDate", (object?)task.DueDateUtc ?? DBNull.Value);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task InsertApprovalAsync(Approval approval, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = CreateCommand(conn);
        cmd.CommandText = @"INSERT INTO dbo.Approvals (ApprovalId, TenantId, TaskId, ApproverUserId, StepOrder, Decision, Comment, DecisionDateUtc)
                            VALUES (@Id, @TenantId, @TaskId, @ApproverUserId, @StepOrder, @Decision, @Comment, @DecisionDate)";
        cmd.Parameters.AddWithValue("@Id", approval.ApprovalId);
        cmd.Parameters.AddWithValue("@TenantId", approval.TenantId);
        cmd.Parameters.AddWithValue("@TaskId", approval.TaskId);
        cmd.Parameters.AddWithValue("@ApproverUserId", approval.ApproverUserId);
        cmd.Parameters.AddWithValue("@StepOrder", approval.StepOrder);
        cmd.Parameters.AddWithValue("@Decision", approval.Decision.ToString());
        cmd.Parameters.AddWithValue("@Comment", (object?)approval.Comment ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@DecisionDate", (object?)approval.DecisionDateUtc ?? DBNull.Value);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task InsertAssignmentHistoryAsync(AssignmentHistory ah, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = CreateCommand(conn);
        cmd.CommandText = @"INSERT INTO dbo.AssignmentHistory (AssignmentId, TenantId, TaskId, FromDepartmentId, ToDepartmentId, FromUserId, ToUserId, ActionType, ActionDateUtc)
                            VALUES (@Id, @TenantId, @TaskId, @FromDeptId, @ToDeptId, @FromUserId, @ToUserId, @ActionType, @ActionDate)";
        cmd.Parameters.AddWithValue("@Id", ah.AssignmentId);
        cmd.Parameters.AddWithValue("@TenantId", ah.TenantId);
        cmd.Parameters.AddWithValue("@TaskId", ah.TaskId);
        cmd.Parameters.AddWithValue("@FromDeptId", (object?)ah.FromDepartmentId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@ToDeptId", (object?)ah.ToDepartmentId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@FromUserId", (object?)ah.FromUserId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@ToUserId", (object?)ah.ToUserId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@ActionType", ah.ActionType);
        cmd.Parameters.AddWithValue("@ActionDate", ah.ActionDateUtc);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task InsertTenantSettingAsync(TenantSetting ts, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = CreateCommand(conn);
        cmd.CommandText = @"INSERT INTO dbo.TenantSettings (TenantSettingId, TenantId, DisplayName, Theme, Domain, DefaultSlaHours)
                            VALUES (@Id, @TenantId, @DisplayName, @Theme, @Domain, @DefaultSlaHours)";
        cmd.Parameters.AddWithValue("@Id", ts.TenantSettingId);
        cmd.Parameters.AddWithValue("@TenantId", ts.TenantId);
        cmd.Parameters.AddWithValue("@DisplayName", ts.DisplayName);
        cmd.Parameters.AddWithValue("@Theme", (object?)ts.Theme ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@Domain", (object?)ts.Domain ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@DefaultSlaHours", ts.DefaultSlaHours);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    #endregion

    #region Update Methods

    public async Task UpdateTaskStatusAsync(Guid taskId, Domain.Enums.TaskStatus status, Guid? updatedBy, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = CreateCommand(conn);
        cmd.CommandText = @"UPDATE dbo.Tasks SET CurrentStatus = @Status, UpdatedAtUtc = @Now, UpdatedByUserId = @UpdatedBy WHERE TaskId = @Id";
        cmd.Parameters.AddWithValue("@Status", status.ToString());
        cmd.Parameters.AddWithValue("@Now", DateTimeOffset.UtcNow);
        cmd.Parameters.AddWithValue("@UpdatedBy", (object?)updatedBy ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@Id", taskId);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task UpdateTaskAssignmentAsync(Guid taskId, Guid? deptId, Guid? userId, Guid? updatedBy, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = CreateCommand(conn);
        cmd.CommandText = @"UPDATE dbo.Tasks SET AssignedDepartmentId = @DeptId, AssignedUserId = @UserId, CurrentStatus = 'Assigned', UpdatedAtUtc = @Now, UpdatedByUserId = @UpdatedBy WHERE TaskId = @Id";
        cmd.Parameters.AddWithValue("@DeptId", (object?)deptId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@UserId", (object?)userId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@Now", DateTimeOffset.UtcNow);
        cmd.Parameters.AddWithValue("@UpdatedBy", (object?)updatedBy ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@Id", taskId);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task UpdateTaskCompletedAsync(Guid taskId, Guid? updatedBy, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = CreateCommand(conn);
        cmd.CommandText = @"UPDATE dbo.Tasks SET CurrentStatus = 'Completed', CompletedAtUtc = @Now, UpdatedAtUtc = @Now, UpdatedByUserId = @UpdatedBy WHERE TaskId = @Id";
        cmd.Parameters.AddWithValue("@Now", DateTimeOffset.UtcNow);
        cmd.Parameters.AddWithValue("@UpdatedBy", (object?)updatedBy ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@Id", taskId);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task UpdateTaskClosedAsync(Guid taskId, Guid? updatedBy, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = CreateCommand(conn);
        cmd.CommandText = @"UPDATE dbo.Tasks SET CurrentStatus = 'Closed', ClosedAtUtc = @Now, UpdatedAtUtc = @Now, UpdatedByUserId = @UpdatedBy WHERE TaskId = @Id";
        cmd.Parameters.AddWithValue("@Now", DateTimeOffset.UtcNow);
        cmd.Parameters.AddWithValue("@UpdatedBy", (object?)updatedBy ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@Id", taskId);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task UpdateSocialMessageCategoryAsync(Guid msgId, string? category, string tags, Guid? updatedBy, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = CreateCommand(conn);
        cmd.CommandText = @"UPDATE dbo.SocialMessages SET Category = @Category, Tags = @Tags, Status = 'Categorized', UpdatedAtUtc = @Now, UpdatedByUserId = @UpdatedBy WHERE SocialMessageId = @Id";
        cmd.Parameters.AddWithValue("@Category", (object?)category ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@Tags", tags);
        cmd.Parameters.AddWithValue("@Now", DateTimeOffset.UtcNow);
        cmd.Parameters.AddWithValue("@UpdatedBy", (object?)updatedBy ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@Id", msgId);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task UpdateSocialMessageRouteAsync(Guid msgId, Guid? deptId, Guid? updatedBy, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = CreateCommand(conn);
        cmd.CommandText = @"UPDATE dbo.SocialMessages SET AssignedDepartmentId = @DeptId, Status = 'Routed', UpdatedAtUtc = @Now, UpdatedByUserId = @UpdatedBy WHERE SocialMessageId = @Id";
        cmd.Parameters.AddWithValue("@DeptId", (object?)deptId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@Now", DateTimeOffset.UtcNow);
        cmd.Parameters.AddWithValue("@UpdatedBy", (object?)updatedBy ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@Id", msgId);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task UpdateSocialMessageConvertedAsync(Guid msgId, Guid taskId, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = CreateCommand(conn);
        cmd.CommandText = @"UPDATE dbo.SocialMessages SET TaskId = @TaskId, Status = 'ConvertedToTask' WHERE SocialMessageId = @Id";
        cmd.Parameters.AddWithValue("@TaskId", taskId);
        cmd.Parameters.AddWithValue("@Id", msgId);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task UpsertTenantSettingAsync(TenantSetting ts, Guid? updatedBy, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(ct);
        
        // Check if exists
        await using var checkCmd = CreateCommand(conn);
        checkCmd.CommandText = "SELECT COUNT(1) FROM dbo.TenantSettings WHERE TenantId = @TenantId";
        checkCmd.Parameters.AddWithValue("@TenantId", ts.TenantId);
        var exists = (int)await checkCmd.ExecuteScalarAsync(ct) > 0;

        if (exists)
        {
            await using var cmd = CreateCommand(conn);
            cmd.CommandText = @"UPDATE dbo.TenantSettings SET DisplayName = @DisplayName, Theme = @Theme, Domain = @Domain, DefaultSlaHours = @DefaultSlaHours, UpdatedAtUtc = @Now, UpdatedByUserId = @UpdatedBy WHERE TenantId = @TenantId";
            cmd.Parameters.AddWithValue("@DisplayName", ts.DisplayName);
            cmd.Parameters.AddWithValue("@Theme", (object?)ts.Theme ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@Domain", (object?)ts.Domain ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@DefaultSlaHours", ts.DefaultSlaHours);
            cmd.Parameters.AddWithValue("@Now", DateTimeOffset.UtcNow);
            cmd.Parameters.AddWithValue("@UpdatedBy", (object?)updatedBy ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@TenantId", ts.TenantId);
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
        cmd.Parameters.AddWithValue("@Enabled", enabled);
        cmd.Parameters.AddWithValue("@Now", DateTimeOffset.UtcNow);
        cmd.Parameters.AddWithValue("@TenantId", tenantId);
        await cmd.ExecuteNonQueryAsync(ct);
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
        cmd.Parameters.AddWithValue("@RuleId", rule.RuleId);
        cmd.Parameters.AddWithValue("@TenantId", rule.TenantId);
        cmd.Parameters.AddWithValue("@RuleName", rule.RuleName);
        cmd.Parameters.AddWithValue("@Keywords", rule.Keywords);
        cmd.Parameters.AddWithValue("@TargetDepartmentId", rule.TargetDepartmentId);
        cmd.Parameters.AddWithValue("@Priority", rule.Priority);
        cmd.Parameters.AddWithValue("@IsActive", rule.IsActive);
        cmd.Parameters.AddWithValue("@CreatedAtUtc", rule.CreatedAtUtc);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task UpdateRoutingRuleAsync(RoutingRule rule, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = CreateCommand(conn);
        cmd.CommandText = @"UPDATE dbo.RoutingRules SET RuleName = @RuleName, Keywords = @Keywords, TargetDepartmentId = @TargetDepartmentId, Priority = @Priority, IsActive = @IsActive WHERE RuleId = @RuleId";
        cmd.Parameters.AddWithValue("@RuleName", rule.RuleName);
        cmd.Parameters.AddWithValue("@Keywords", rule.Keywords);
        cmd.Parameters.AddWithValue("@TargetDepartmentId", rule.TargetDepartmentId);
        cmd.Parameters.AddWithValue("@Priority", rule.Priority);
        cmd.Parameters.AddWithValue("@IsActive", rule.IsActive);
        cmd.Parameters.AddWithValue("@RuleId", rule.RuleId);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task DeleteRoutingRuleAsync(Guid ruleId, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = CreateCommand(conn);
        cmd.CommandText = @"DELETE FROM dbo.RoutingRules WHERE RuleId = @RuleId";
        cmd.Parameters.AddWithValue("@RuleId", ruleId);
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
        cmd.Parameters.AddWithValue("@TenantId", tenantId);
        
        if (excludeStatus.HasValue)
        {
            sql += " AND CurrentStatus <> @ExcludeStatus";
            cmd.Parameters.AddWithValue("@ExcludeStatus", excludeStatus.Value.ToString());
        }
        if (includeStatus.HasValue)
        {
            sql += " AND CurrentStatus = @IncludeStatus";
            cmd.Parameters.AddWithValue("@IncludeStatus", includeStatus.Value.ToString());
        }
        if (overdue == true)
        {
            sql += " AND DueDateUtc < @Now";
            cmd.Parameters.AddWithValue("@Now", DateTimeOffset.UtcNow);
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
        cmd.Parameters.AddWithValue("@TenantId", tenantId);
        
        if (excludeStatus.HasValue)
        {
            sql += " AND Status <> @ExcludeStatus";
            cmd.Parameters.AddWithValue("@ExcludeStatus", excludeStatus.Value.ToString());
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
        cmd.Parameters.AddWithValue("@TenantId", tenantId);
        return (int)await cmd.ExecuteScalarAsync(ct);
    }

    public async Task<int> CountTasksDueTodayAsync(Guid tenantId, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(ct);
        var today = DateTime.UtcNow.Date;
        await using var cmd = CreateCommand(conn);
        cmd.CommandText = "SELECT COUNT(*) FROM dbo.Tasks WHERE TenantId = @TenantId AND CAST(DueDateUtc AS DATE) = @Today";
        cmd.Parameters.AddWithValue("@TenantId", tenantId);
        cmd.Parameters.AddWithValue("@Today", today);
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
        cmd.Parameters.AddWithValue("@TenantId", tenantId);
        
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
        cmd.Parameters.AddWithValue("@TenantId", tenantId);
        
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
        cmd.Parameters.AddWithValue("@TaskId", taskId);
        return (int)await cmd.ExecuteScalarAsync(ct);
    }

    #endregion

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

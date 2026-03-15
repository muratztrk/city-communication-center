using System.Data.SqlClient;
using System.Runtime.CompilerServices;

namespace CityCommunicationCenter.Infrastructure.Persistence;

/// <summary>
/// A lightweight ADO.NET-based collection abstraction mimicking EF Core DbSet.
/// Provides basic LINQ-like querying over SQL Server tables.
/// </summary>
public sealed class SqlDbSet<T> where T : class
{
    private readonly string _connectionString;
    private readonly string _tableName;
    private readonly Func<SqlDataReader, T> _mapper;
    private readonly List<string> _whereConditions = new();
    private readonly Dictionary<string, object?> _parameters = new();

    public SqlDbSet(string connectionString, string tableName, Func<SqlDataReader, T> mapper)
    {
        _connectionString = connectionString;
        _tableName = tableName;
        _mapper = mapper;
    }

    public SqlDbSet<T> Where(string condition, params (string name, object? value)[] parameters)
    {
        var clone = new SqlDbSet<T>(_connectionString, _tableName, _mapper);
        clone._whereConditions.AddRange(_whereConditions);
        clone._whereConditions.Add(condition);
        
        foreach (var (name, value) in _parameters)
            clone._parameters[name] = value;
        
        foreach (var (name, value) in parameters)
            clone._parameters[name] = value;
        
        return clone;
    }

    public SqlDbSet<T> WhereTenant(Guid tenantId) 
        => Where("TenantId = @TenantId", ("@TenantId", tenantId));

    public SqlDbSet<T> WhereId(string idColumn, Guid id) 
        => Where($"{idColumn} = @{idColumn}", ($"@{idColumn}", id));

    public async Task<List<T>> ToListAsync(CancellationToken ct = default)
    {
        var sql = BuildSelectSql();
        return await ExecuteQueryAsync(sql, ct);
    }

    public async Task<T?> FirstOrDefaultAsync(CancellationToken ct = default)
    {
        var sql = BuildSelectSql() + " OFFSET 0 ROWS FETCH NEXT 1 ROWS ONLY";
        var results = await ExecuteQueryAsync(sql, ct);
        return results.FirstOrDefault();
    }

    public async Task<T?> SingleOrDefaultAsync(CancellationToken ct = default)
    {
        var sql = BuildSelectSql() + " OFFSET 0 ROWS FETCH NEXT 2 ROWS ONLY";
        var results = await ExecuteQueryAsync(sql, ct);
        return results.Count switch
        {
            0 => null,
            1 => results[0],
            _ => throw new InvalidOperationException("Sequence contains more than one element")
        };
    }

    public async Task<bool> AnyAsync(CancellationToken ct = default)
    {
        var whereClause = _whereConditions.Count > 0
            ? "WHERE " + string.Join(" AND ", _whereConditions)
            : string.Empty;
        
        var sql = $"SELECT CASE WHEN EXISTS (SELECT 1 FROM dbo.[{_tableName}] {whereClause}) THEN 1 ELSE 0 END";
        
        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(ct);
        
        await using var cmd = connection.CreateCommand();
        cmd.CommandText = sql;
        
        foreach (var (name, value) in _parameters)
            cmd.Parameters.AddWithValue(name, value ?? DBNull.Value);
        
        var result = await cmd.ExecuteScalarAsync(ct);
        return Convert.ToInt32(result) == 1;
    }

    public async Task<int> CountAsync(CancellationToken ct = default)
    {
        var whereClause = _whereConditions.Count > 0
            ? "WHERE " + string.Join(" AND ", _whereConditions)
            : string.Empty;
        
        var sql = $"SELECT COUNT(*) FROM dbo.[{_tableName}] {whereClause}";
        
        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(ct);
        
        await using var cmd = connection.CreateCommand();
        cmd.CommandText = sql;
        
        foreach (var (name, value) in _parameters)
            cmd.Parameters.AddWithValue(name, value ?? DBNull.Value);
        
        var result = await cmd.ExecuteScalarAsync(ct);
        return Convert.ToInt32(result);
    }

    public async IAsyncEnumerable<T> AsAsyncEnumerable([EnumeratorCancellation] CancellationToken ct = default)
    {
        var sql = BuildSelectSql();
        
        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(ct);
        
        await using var cmd = connection.CreateCommand();
        cmd.CommandText = sql;
        
        foreach (var (name, value) in _parameters)
            cmd.Parameters.AddWithValue(name, value ?? DBNull.Value);
        
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            yield return _mapper(reader);
        }
    }

    private string BuildSelectSql()
    {
        var whereClause = _whereConditions.Count > 0
            ? "WHERE " + string.Join(" AND ", _whereConditions)
            : string.Empty;
        
        return $"SELECT * FROM dbo.[{_tableName}] {whereClause} ORDER BY (SELECT NULL)";
    }

    private async Task<List<T>> ExecuteQueryAsync(string sql, CancellationToken ct)
    {
        var results = new List<T>();
        
        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(ct);
        
        await using var cmd = connection.CreateCommand();
        cmd.CommandText = sql;
        
        foreach (var (name, value) in _parameters)
            cmd.Parameters.AddWithValue(name, value ?? DBNull.Value);
        
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            results.Add(_mapper(reader));
        }
        
        return results;
    }
}

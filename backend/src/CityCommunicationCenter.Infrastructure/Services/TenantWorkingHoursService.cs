namespace CityCommunicationCenter.Infrastructure.Services;

internal sealed class TenantWorkingHoursService : ITenantWorkingHoursService
{
    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web);

    public static readonly WorkingHoursDescriptor DefaultWorkingHours = new(
        new WorkingHoursSchedule(
            false,
            new[]
            {
                new WorkingHoursDaySchedule(1, "08:00", "17:00"),
                new WorkingHoursDaySchedule(2, "08:00", "17:00"),
                new WorkingHoursDaySchedule(3, "08:00", "17:00"),
                new WorkingHoursDaySchedule(4, "08:00", "17:00"),
                new WorkingHoursDaySchedule(5, "08:00", "17:00"),
                new WorkingHoursDaySchedule(6, null, null),
                new WorkingHoursDaySchedule(0, null, null),
            }),
        Array.Empty<WorkingHoursDepartmentOverride>());

    private readonly IApplicationDbContext _dbContext;

    public TenantWorkingHoursService(IApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<WorkingHoursDescriptor> GetSettingsAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        var payload = await _dbContext.TenantSettings
            .AsNoTracking()
            .IgnoreQueryFilters()
            .Where(entity => entity.TenantId == tenantId)
            .Select(entity => entity.WorkingHoursJson)
            .SingleOrDefaultAsync(cancellationToken);

        if (string.IsNullOrWhiteSpace(payload))
        {
            return DefaultWorkingHours;
        }

        var workingHoursPayload = JsonSerializer.Deserialize<WorkingHoursPayload>(payload, SerializerOptions);
        if (workingHoursPayload is null)
        {
            return DefaultWorkingHours;
        }

        return ToDescriptor(workingHoursPayload);
    }

    public async Task SaveSettingsAsync(Guid tenantId, WorkingHoursUpdate settings, Guid? actorUserId, CancellationToken cancellationToken = default)
    {
        var tenantSetting = await _dbContext.TenantSettings
            .IgnoreQueryFilters()
            .SingleOrDefaultAsync(entity => entity.TenantId == tenantId, cancellationToken);

        var defaultSchedule = settings.Default;
        var payload = new WorkingHoursPayload
        {
            Default = new WorkingHoursSchedulePayload
            {
                IsAlwaysOpen = defaultSchedule.IsAlwaysOpen,
                Schedule = defaultSchedule.Schedule.Select(s => new WorkingHoursDaySchedulePayload { Day = s.Day, From = s.From, To = s.To }).ToList(),
            },
            DepartmentOverrides = settings.DepartmentOverrides.Select(o => new WorkingHoursDepartmentOverridePayload
            {
                DepartmentId = o.DepartmentId,
                DepartmentName = o.DepartmentName,
                IsAlwaysOpen = o.IsAlwaysOpen,
                Schedule = o.Schedule.Select(s => new WorkingHoursDaySchedulePayload { Day = s.Day, From = s.From, To = s.To }).ToList(),
            }).ToList(),
        };

        if (tenantSetting is null)
        {
            _dbContext.TenantSettings.Add(new TenantSetting
            {
                TenantSettingId = Guid.NewGuid(),
                TenantId = tenantId,
                DisplayName = string.Empty,
                DefaultSlaHours = 48,
                AutoRoutingEnabled = false,
                WorkingHoursJson = JsonSerializer.Serialize(payload, SerializerOptions),
                CreatedByUserId = actorUserId,
            });
        }
        else
        {
            tenantSetting.WorkingHoursJson = JsonSerializer.Serialize(payload, SerializerOptions);
            tenantSetting.UpdatedAtUtc = DateTimeOffset.UtcNow;
            tenantSetting.UpdatedByUserId = actorUserId;
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    private static WorkingHoursDescriptor ToDescriptor(WorkingHoursPayload payload)
    {
        var defaultSchedule = payload.Default is null
            ? DefaultWorkingHours.Default
            : new WorkingHoursSchedule(
                payload.Default.IsAlwaysOpen,
                payload.Default.Schedule.Select(s => new WorkingHoursDaySchedule(s.Day, s.From, s.To)).ToList());

        var overrides = payload.DepartmentOverrides.Select(o => new WorkingHoursDepartmentOverride(
            o.DepartmentId,
            o.DepartmentName,
            o.IsAlwaysOpen,
            o.Schedule.Select(s => new WorkingHoursDaySchedule(s.Day, s.From, s.To)).ToList())).ToList();

        return new WorkingHoursDescriptor(defaultSchedule, overrides);
    }

    private sealed class WorkingHoursDaySchedulePayload
    {
        public int Day { get; set; }
        public string? From { get; set; }
        public string? To { get; set; }
    }

    private sealed class WorkingHoursSchedulePayload
    {
        public bool IsAlwaysOpen { get; set; }
        public List<WorkingHoursDaySchedulePayload> Schedule { get; set; } = new();
    }

    private sealed class WorkingHoursDepartmentOverridePayload
    {
        public Guid DepartmentId { get; set; }
        public string? DepartmentName { get; set; }
        public bool IsAlwaysOpen { get; set; }
        public List<WorkingHoursDaySchedulePayload> Schedule { get; set; } = new();
    }

    private sealed class WorkingHoursPayload
    {
        public WorkingHoursSchedulePayload? Default { get; set; }
        public List<WorkingHoursDepartmentOverridePayload> DepartmentOverrides { get; set; } = new();
    }
}

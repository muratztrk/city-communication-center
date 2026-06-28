namespace CityCommunicationCenter.Infrastructure.Persistence;

public static class InitialData
{
    public static readonly DateTimeOffset CreatedAtUtc = new(2026, 3, 19, 0, 0, 0, TimeSpan.Zero);
    public static readonly DateTimeOffset SampleMessageReceivedAtUtc = new(2026, 3, 18, 20, 0, 0, TimeSpan.Zero);
    public static readonly DateTimeOffset SampleTaskDueDateUtc = new(2026, 3, 21, 0, 0, 0, TimeSpan.Zero);

    public static readonly Guid TenantId = Guid.Parse("b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e");
    public static readonly Guid TenantSettingId = Guid.Parse("3f3efab4-c18c-4dd2-a227-c28af61d4fd5");

    public static readonly Guid AdminDepartmentId = Guid.Parse("6d146a0d-611c-48a5-b59e-8c14a22f6a2e");
    public static readonly Guid PublicWorksDepartmentId = Guid.Parse("0e29fb34-64da-429e-b7c0-e6016a0c10a7");
    public static readonly Guid CommunicationsDepartmentId = Guid.Parse("8f7264ff-c1df-48eb-bf39-a6ff42d7e9bc");

    public static readonly Guid AdminUserId = Guid.Parse("4b1efb47-0311-4ef7-9a0c-f4c41dcb8b48");
    public static readonly Guid PublicWorksManagerUserId = Guid.Parse("d6fc7a5b-5cb2-4c59-8a82-7843041421a5");
    public static readonly Guid PublicWorksStaffUserId = Guid.Parse("1358d4aa-b1ae-486c-a1db-a757ea18f2c3");
    public static readonly Guid CommunicationsStaffUserId = Guid.Parse("1e96916a-889a-4701-a0e6-71dc6571ac18");

    public const string AdminUsername = "admin";
    public const string PublicWorksManagerUsername = "zeynep.kara";
    public const string PublicWorksStaffUsername = "emre.celik";
    public const string CommunicationsStaffUsername = "ali.yildiz";

    public static readonly Guid SampleJobId = Guid.Parse("9a5b3f2e-6c1a-4b0d-8e7f-2d3c4b5a6987");
    public static readonly Guid SampleJobOwnerDepartmentId = Guid.Parse("7c2d4e1f-5b8a-4d3c-9e6f-1a2b3c4d5e62");
    public static readonly Guid SampleTaskId = Guid.Parse("6de6e0b3-a74e-4f24-bdbc-4d6e0cb6d38c");
    public static readonly Guid SampleSocialMessageId = Guid.Parse("8e90888d-dc75-4264-a78b-f0a7abc9a9ab");
    public static readonly Guid SampleRoutingRuleId = Guid.Parse("d306cbf0-88ad-48b7-9b16-14bb87e77f5f");

    public const string SeedTenantLdapSettingsJson = "{\"enabled\":true,\"domain\":\"tire.bel.tr\",\"userAttribute\":\"mail\"}";
    public const string SeedTenantAuthenticationPolicyJson = "{\"automaticSignInEnabled\":true,\"automaticSignInMode\":\"TrustedHeader\",\"trustedNetworkCidrs\":[\"127.0.0.1/32\",\"::1/128\",\"10.0.0.0/8\",\"172.16.0.0/12\",\"192.168.0.0/16\"],\"trustedProxyCidrs\":[\"127.0.0.1/32\",\"::1/128\",\"10.0.0.0/8\",\"172.16.0.0/12\",\"192.168.0.0/16\"],\"identityHeaderName\":\"X-Authenticated-User\",\"requireSecondFactorOutsideTrustedNetwork\":false,\"secondFactorProvider\":\"Disabled\",\"codeLength\":6,\"codeTtlSeconds\":300,\"allowMockCodePreview\":false}";
    public const string SeedTenantAppearanceJson = "{\"themePreset\":\"tire-civic\",\"primaryColor\":\"#0F4C81\",\"secondaryColor\":\"#2B6EA6\",\"accentColor\":\"#C6932D\",\"neutralColor\":\"#6A7786\",\"surfaceColor\":\"#FFFFFF\",\"backgroundColor\":\"#EEF3F8\",\"headerGradientFrom\":\"#123B63\",\"headerGradientTo\":\"#356F99\",\"sidebarBackgroundColor\":\"#102F4A\",\"sidebarForegroundColor\":\"#F6F8FB\"}";

    public static readonly IReadOnlyDictionary<Guid, string> SeedLocalUsernames = new Dictionary<Guid, string>
    {
        [AdminUserId] = AdminUsername,
        [PublicWorksManagerUserId] = PublicWorksManagerUsername,
        [PublicWorksStaffUserId] = PublicWorksStaffUsername,
        [CommunicationsStaffUserId] = CommunicationsStaffUsername,
    };
}

namespace CityCommunicationCenter.Infrastructure.Persistence;

public static class InitialData
{
    public static readonly Guid TenantId = Guid.Parse("b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e");
    public static readonly Guid TenantSettingId = Guid.Parse("3f3efab4-c18c-4dd2-a227-c28af61d4fd5");

    public static readonly Guid AdminDepartmentId = Guid.Parse("6d146a0d-611c-48a5-b59e-8c14a22f6a2e");
    public static readonly Guid PublicWorksDepartmentId = Guid.Parse("0e29fb34-64da-429e-b7c0-e6016a0c10a7");
    public static readonly Guid CommunicationsDepartmentId = Guid.Parse("8f7264ff-c1df-48eb-bf39-a6ff42d7e9bc");

    public static readonly Guid AdminUserId = Guid.Parse("4b1efb47-0311-4ef7-9a0c-f4c41dcb8b48");
    public static readonly Guid PublicWorksManagerUserId = Guid.Parse("d6fc7a5b-5cb2-4c59-8a82-7843041421a5");
    public static readonly Guid PublicWorksStaffUserId = Guid.Parse("1358d4aa-b1ae-486c-a1db-a757ea18f2c3");
    public static readonly Guid CommunicationsStaffUserId = Guid.Parse("1e96916a-889a-4701-a0e6-71dc6571ac18");

    public static readonly Guid SampleTaskId = Guid.Parse("6de6e0b3-a74e-4f24-bdbc-4d6e0cb6d38c");
    public static readonly Guid SampleSocialMessageId = Guid.Parse("8e90888d-dc75-4264-a78b-f0a7abc9a9ab");
    public static readonly Guid SampleRoutingRuleId = Guid.Parse("d306cbf0-88ad-48b7-9b16-14bb87e77f5f");

    public static readonly string[] SeedUserEmails =
    [
        "admin@tire.bel.tr",
        "zeynep.kara@tire.bel.tr",
        "emre.celik@tire.bel.tr",
        "ali.yildiz@tire.bel.tr"
    ];
}

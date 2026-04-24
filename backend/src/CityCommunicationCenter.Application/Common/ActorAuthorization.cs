namespace CityCommunicationCenter.Application.Common;

internal static class ActorAuthorization
{
    public static async Task<ApplicationUser> RequireActiveActorAsync(
        IApplicationDbContext dbContext,
        Guid? actorUserId,
        Guid tenantId,
        CancellationToken cancellationToken)
    {
        if (!actorUserId.HasValue)
        {
            throw new ForbiddenAccessException("Islemi gerceklestiren kullanici dogrulanamadi.");
        }

        var actor = await dbContext.Users.FirstOrDefaultAsync(
            entity => entity.UserId == actorUserId.Value && entity.TenantId == tenantId,
            cancellationToken);

        if (actor is null || !actor.IsActive)
        {
            throw new ForbiddenAccessException("Islemi gerceklestiren kullanici bulunamadi veya aktif degil.");
        }

        return actor;
    }
}
namespace CityCommunicationCenter.Application.Abstractions;

public interface ITenantContextAccessor
{
    TenantContext GetCurrent();
}

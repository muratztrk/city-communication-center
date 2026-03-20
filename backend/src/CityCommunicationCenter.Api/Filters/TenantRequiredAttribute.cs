namespace CityCommunicationCenter.Api.Filters;

public sealed class TenantRequiredAttribute : TypeFilterAttribute
{
    public TenantRequiredAttribute()
        : base(typeof(ValidateTenantFilter))
    {
        Order = int.MinValue;
    }
}
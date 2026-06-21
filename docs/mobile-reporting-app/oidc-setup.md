# CCC Mobile OIDC setup

The mobile app is a public native OpenID Connect client. It uses Authorization Code with PKCE against the existing CCC server-side authentication flow; it must never contact LDAP/Active Directory or receive directory configuration.

## Required configuration

Set these production settings (environment variables use `__` for nesting):

```text
Authentication__Issuer=https://ccc.example.gov.tr
Authentication__Audience=city-communication-center-api
Authentication__SigningKey=<long-random-signing-key>
Authentication__MobileOidc__ClientId=ccc-mobile
Authentication__MobileOidc__RedirectUri=ccc.mobile:/oauth2redirect
```

The client starts at `GET /connect/authorize` with `response_type=code`, `client_id=ccc-mobile`, `redirect_uri=ccc.mobile:/oauth2redirect`, a SHA-256 PKCE challenge, and requested scopes. CCC requires PKCE and issues five-minute, single-use authorization codes. The user must already have a CCC browser session created through `POST /api/v1/auth/session/login`; that endpoint continues to authenticate local passwords first and then linked LDAP users on the server.

The code is redeemed at `POST /connect/token` with `grant_type=authorization_code`, the original redirect URI, and `code_verifier`. Existing password-grant web/API consumers are unchanged.

Allowed mobile scopes are `openid`, `profile`, `email`, `offline_access`, and `ccc_api`. `offline_access` is recognized for compatibility, but CCC's current stateless-token policy deliberately does **not** issue refresh tokens or enable refresh-token grants. Mobile clients should re-authorize when an access token expires until that platform-wide policy is intentionally revised.

## Claims and authorization

Access tokens are signed by the configured issuer and retain CCC's established claims: `sub`, `name`, `displayName`, `email` (when present), `role`, `tenant_id`, `tenantId`, `tenant_name`, and `department_id`. API validation remains OpenIddict local validation, including issuer, audience, signature, expiration, and token processing validation.

CCC uses application roles rather than exposing directory groups. During user provisioning/linking, map AD groups to existing application roles:

| Directory group | CCC role |
| --- | --- |
| `CCC-Mayor` | `SystemAdmin` |
| `CCC-Executive` | `SystemAdmin` |
| `CCC-Department-Manager` | `Manager` |

The issued `role` claim is the mobile-readable authorization claim. Tenant and department scope are always resolved from the authenticated CCC user/session; mobile-supplied tenant or department values are not trusted for report access.

## Executive report

`GET /api/v1/reports/executive?period=weekly|monthly|yearly&fromUtc=<ISO-8601>&toUtc=<ISO-8601>` requires `SystemAdmin` or `Manager`.

`SystemAdmin` sees the authenticated tenant. `Manager` results are restricted to its CCC-managed/assigned departments, including social-message metrics. No migration is required.

FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine AS base
WORKDIR /app
ENV DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=false
RUN apk add --no-cache icu-libs krb5-libs tzdata libldap
EXPOSE 80
EXPOSE 443

FROM mcr.microsoft.com/dotnet/sdk:10.0-alpine AS build
WORKDIR /src
COPY ["src/CityCommunicationCenter.Api/CityCommunicationCenter.Api.csproj", "CityCommunicationCenter.Api/"]
COPY ["src/CityCommunicationCenter.Application/CityCommunicationCenter.Application.csproj", "CityCommunicationCenter.Application/"]
COPY ["src/CityCommunicationCenter.Infrastructure/CityCommunicationCenter.Infrastructure.csproj", "CityCommunicationCenter.Infrastructure/"]
COPY ["src/CityCommunicationCenter.Domain/CityCommunicationCenter.Domain.csproj", "CityCommunicationCenter.Domain/"]
COPY ["src/CityCommunicationCenter.Shared/CityCommunicationCenter.Shared.csproj", "CityCommunicationCenter.Shared/"]
RUN dotnet restore "CityCommunicationCenter.Api/CityCommunicationCenter.Api.csproj"
COPY src/ .
RUN find /src -type d -name '*\\*' -prune -exec rm -rf {} +
WORKDIR "/src/CityCommunicationCenter.Api"
RUN dotnet build "CityCommunicationCenter.Api.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "CityCommunicationCenter.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
RUN apk add --no-cache su-exec && \
    addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=publish /app/publish .
RUN mkdir -p /app/logs /var/lib/city-communication-center/dataprotection && \
    chown -R appuser:appgroup /app/logs /var/lib/city-communication-center/dataprotection
COPY --chmod=755 <<'EOF' /app/entrypoint.sh
#!/bin/sh
chown -R appuser:appgroup /var/lib/city-communication-center/dataprotection /app/logs 2>/dev/null || true
exec su-exec appuser dotnet CityCommunicationCenter.Api.dll
EOF
ENTRYPOINT ["/app/entrypoint.sh"]

FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine AS base
WORKDIR /app
ENV DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=false
RUN apk add --no-cache icu-libs krb5-libs tzdata
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
WORKDIR "/src/CityCommunicationCenter.Api"
RUN dotnet build "CityCommunicationCenter.Api.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "CityCommunicationCenter.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=publish /app/publish .
RUN mkdir -p /app/logs && chown -R appuser:appgroup /app/logs
USER appuser
ENTRYPOINT ["dotnet", "CityCommunicationCenter.Api.dll"]

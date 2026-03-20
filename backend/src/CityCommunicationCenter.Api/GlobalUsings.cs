// Global usings for CityCommunicationCenter.Api
// Keep only project-wide namespaces that are shared broadly across controllers and startup.

global using CityCommunicationCenter.Api.Filters;
global using CityCommunicationCenter.Api.Security;
global using CityCommunicationCenter.Application.Abstractions;
global using CityCommunicationCenter.Shared.Contracts;
global using MediatR;
global using Microsoft.AspNetCore.Authentication;
global using Microsoft.AspNetCore.Authorization;
global using Microsoft.AspNetCore.Mvc;
global using Microsoft.Extensions.Options;
global using OpenIddict.Abstractions;
global using OpenIddict.Server.AspNetCore;
global using Serilog;
global using Serilog.Events;
global using System.Security.Claims;
global using System.Text.Json;
global using System.Text.Json.Serialization;

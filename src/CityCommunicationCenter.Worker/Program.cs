using CityCommunicationCenter.Infrastructure;
using CityCommunicationCenter.Worker;

var builder = Host.CreateApplicationBuilder(args);

builder.Services.AddInfrastructureServices(builder.Configuration);
builder.Services.AddHostedService<WorkflowPollingWorker>();

var host = builder.Build();
host.Run();

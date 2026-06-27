using CityCommunicationCenter.Application.Features.EDevlet;

namespace CityCommunicationCenter.Api.Controllers.V1;

[Route("api/v1/edevlet/basvurular")]
[TenantRequired]
public sealed class EDevletBasvuruController : ApiControllerBase
{
    private readonly IMediator _sender;

    public EDevletBasvuruController(IMediator sender) => _sender = sender;

    [HttpGet]
    [ProducesResponseType<IEnumerable<EDevletBasvuruSummaryResponse>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<EDevletBasvuruSummaryResponse>>> GetBasvurular(
        [FromQuery] string? status,
        CancellationToken cancellationToken)
    {
        var response = await _sender.Send(new GetEDevletBasvurularQuery(status), cancellationToken);
        return Ok(response);
    }

    [HttpGet("{basvuruId:guid}")]
    [ProducesResponseType<EDevletBasvuruDetailResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<EDevletBasvuruDetailResponse>> GetBasvuru(Guid basvuruId, CancellationToken cancellationToken)
    {
        var response = await _sender.Send(new GetEDevletBasvuruByIdQuery(basvuruId), cancellationToken);
        return response is null ? NotFound() : Ok(response);
    }

    [HttpPost("{basvuruId:guid}/convert-to-job")]
    [ProducesResponseType<JobSummaryResponse>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<JobSummaryResponse>> ConvertToJob(
        Guid basvuruId,
        [FromBody] ConvertEDevletBasvuruToJobRequest request,
        CancellationToken cancellationToken)
    {
        var response = await _sender.Send(
            new ConvertEDevletBasvuruToJobCommand(
                basvuruId,
                CurrentContext.UserId,
                request.Title,
                request.Description,
                request.OwnerDepartmentId,
                request.Priority,
                request.TargetDepartmentIds,
                request.DueDateUtc,
                request.Neighborhood,
                request.Street,
                request.OpenAddress,
                request.CitizenName,
                request.CitizenPhone),
            cancellationToken);

        return response is null ? NotFound() : CreatedAtRoute("GetJobById", new { jobId = response.JobId }, response);
    }
}

import { isCitizenRequestJob } from './citizenRequests'

export function getRequestEditPath(
  job: { jobId: string; requestType: string; sourceType: string },
): string {
  // Vatandaş talepleri (her rol için) citizen formunda düzenlenir; kaydedince Vatandaş Talepleri
  // ekranına döner (returnTo=social) ve VT- numarası korunur — Taleplerim'e düşmez (card #1077).
  if (isCitizenRequestJob({ requestType: job.requestType, sourceType: job.sourceType })) {
    return `/requests/new?kind=citizen&editJobId=${job.jobId}&returnTo=social`
  }
  return `/requests/new?kind=${job.requestType === 'ExternalUnit' ? 'external' : 'internal'}&editJobId=${job.jobId}`
}

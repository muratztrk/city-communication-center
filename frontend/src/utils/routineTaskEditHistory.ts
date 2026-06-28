import type { Attachment, EntityAuditLogEntry } from '../types/platform'
import { richTextToPlainText } from './richText'

export type RoutineTaskEditSnapshotAttachment = {
  attachmentId: string
  fileName: string
  contentType: string
  fileSizeBytes: number
  relativeUrl: string
}

export type RoutineTaskEditSnapshot = {
  title: string
  description: string
  priority: string
  dueDateUtc: string | null
  neighborhood: string | null
  street: string | null
  openAddress: string | null
  attachments?: RoutineTaskEditSnapshotAttachment[]
}

export type RoutineTaskEditHistoryEntry = {
  auditLogId: string
  editedAtUtc: string
  editedByDisplayName: string
  snapshot: RoutineTaskEditSnapshot
}

export type RoutineTaskEditFieldChange = {
  fieldKey: string
  before: string
  after: string
}

export function buildRoutineSnapshotFromTaskDetail(
  detail: {
    title: string
    description: string
    priority: string
    dueDateUtc: string | null
    attachments?: Attachment[]
  },
  job: {
    neighborhood?: string | null
    street?: string | null
    openAddress?: string | null
  } | null,
): RoutineTaskEditSnapshot {
  return {
    title: detail.title,
    description: detail.description,
    priority: detail.priority,
    dueDateUtc: detail.dueDateUtc,
    neighborhood: job?.neighborhood ?? null,
    street: job?.street ?? null,
    openAddress: job?.openAddress ?? null,
    attachments: detail.attachments?.map(attachment => ({
      attachmentId: attachment.attachmentId,
      fileName: attachment.fileName,
      contentType: attachment.contentType,
      fileSizeBytes: attachment.fileSizeBytes,
      relativeUrl: attachment.url,
    })) ?? [],
  }
}

function normalizeSnapshotAttachments(attachments: RoutineTaskEditSnapshotAttachment[] | undefined): RoutineTaskEditSnapshotAttachment[] {
  return attachments ?? []
}

function snapshotAttachmentToAttachment(entry: RoutineTaskEditSnapshotAttachment): Attachment {
  return {
    attachmentId: entry.attachmentId,
    fileName: entry.fileName,
    contentType: entry.contentType,
    fileSizeBytes: entry.fileSizeBytes,
    url: entry.relativeUrl,
    uploadedAtUtc: '',
  }
}

function formatAddress(snapshot: RoutineTaskEditSnapshot): string {
  return [snapshot.neighborhood, snapshot.street, snapshot.openAddress].filter(Boolean).join(' · ')
}

function attachmentSignature(attachments: RoutineTaskEditSnapshotAttachment[]): string {
  return attachments
    .map(entry => `${entry.attachmentId}:${entry.fileName}`)
    .sort()
    .join('|')
}

export function snapshotAttachmentsToAttachmentList(
  attachments: RoutineTaskEditSnapshotAttachment[] | undefined,
): Attachment[] {
  return normalizeSnapshotAttachments(attachments).map(snapshotAttachmentToAttachment)
}

export function getRoutineEditFieldChanges(
  before: RoutineTaskEditSnapshot,
  after: RoutineTaskEditSnapshot,
): RoutineTaskEditFieldChange[] {
  const changes: RoutineTaskEditFieldChange[] = []
  const compare = (fieldKey: string, beforeValue: string, afterValue: string) => {
    if (beforeValue.trim() !== afterValue.trim()) {
      changes.push({ fieldKey, before: beforeValue.trim() || '—', after: afterValue.trim() || '—' })
    }
  }

  compare('title', before.title, after.title)
  compare('priority', before.priority, after.priority)
  compare('dueDateUtc', before.dueDateUtc ?? '', after.dueDateUtc ?? '')
  compare('address', formatAddress(before), formatAddress(after))
  compare('description', richTextToPlainText(before.description), richTextToPlainText(after.description))

  const beforeAttachments = attachmentSignature(normalizeSnapshotAttachments(before.attachments))
  const afterAttachments = attachmentSignature(normalizeSnapshotAttachments(after.attachments))
  if (beforeAttachments !== afterAttachments) {
    const beforeNames = normalizeSnapshotAttachments(before.attachments).map(entry => entry.fileName).join(', ') || '—'
    const afterNames = normalizeSnapshotAttachments(after.attachments).map(entry => entry.fileName).join(', ') || '—'
    changes.push({ fieldKey: 'attachments', before: beforeNames, after: afterNames })
  }

  return changes
}

export function parseRoutineTaskEditHistory(entries: EntityAuditLogEntry[]): RoutineTaskEditHistoryEntry[] {
  return entries
    .filter(entry => entry.action === 'RoutineTaskEditSnapshot' && entry.notes)
    .map(entry => {
      try {
        const snapshot = JSON.parse(entry.notes!) as RoutineTaskEditSnapshot
        return {
          auditLogId: entry.auditLogId,
          editedAtUtc: entry.eventTimeUtc,
          editedByDisplayName: entry.actorDisplayName,
          snapshot,
        }
      } catch {
        return null
      }
    })
    .filter((entry): entry is RoutineTaskEditHistoryEntry => entry != null)
    .sort((a, b) => new Date(b.editedAtUtc).getTime() - new Date(a.editedAtUtc).getTime())
}

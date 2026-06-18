import type { QueryClient } from '@tanstack/react-query'
import { queryKeys } from './queryKeys'

type EntityId = string | null | undefined

export function invalidateDashboard(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
  void queryClient.invalidateQueries({ queryKey: queryKeys.reports.all })
}

export function invalidateNotifications(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all })
}

export function invalidateDepartments(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.departments.all })
  void queryClient.invalidateQueries({ queryKey: queryKeys.users.all })
}

export function invalidateUsers(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.users.all })
  void queryClient.invalidateQueries({ queryKey: queryKeys.departments.all })
}

export function invalidateJobs(queryClient: QueryClient, jobId?: EntityId) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all })
  if (jobId) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.detail(jobId) })
    void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.auditLog(jobId) })
  }
  invalidateDashboard(queryClient)
  invalidateNotifications(queryClient)
}

export function invalidateTasks(queryClient: QueryClient, taskId?: EntityId, jobId?: EntityId) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all })
  if (taskId) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.detail(taskId) })
    void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.auditLog(taskId) })
  }
  if (jobId) {
    invalidateJobs(queryClient, jobId)
  } else {
    invalidateDashboard(queryClient)
    invalidateNotifications(queryClient)
  }
}

export function invalidateSocialMessages(queryClient: QueryClient, messageId?: EntityId) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.socialMessages.all })
  if (messageId) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.socialMessages.detail(messageId) })
    void queryClient.invalidateQueries({ queryKey: queryKeys.socialMessages.conversation(messageId) })
  }
  invalidateDashboard(queryClient)
  invalidateNotifications(queryClient)
}

export function invalidateConversations(queryClient: QueryClient, conversationId?: EntityId, messageId?: EntityId) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all })
  if (conversationId) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.conversations.detail(conversationId) })
  }
  if (messageId) {
    invalidateSocialMessages(queryClient, messageId)
  }
}

export function invalidateSettings(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.settings.all })
  void queryClient.invalidateQueries({ queryKey: queryKeys.whatsappTemplates.all })
}

export function invalidateEverything(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.all })
}


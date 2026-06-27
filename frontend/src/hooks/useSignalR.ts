import { useEffect, useRef } from 'react'
import * as signalR from '@microsoft/signalr'
import { useAuth } from '../context/AuthContext'
import { API_ORIGIN } from '../api/config'

export interface NotificationPayload {
  notificationId: string
  title: string
  message: string
  actionUrl?: string | null
}

export interface WhatsAppMessagePayload {
  citizenConversationId: string
  citizenPhone: string
  citizenName: string | null
  messagePreview: string | null
  unreadCount: number
  lastMessageAt: string
}

export interface SignalRHandlers {
  onNotification?: (payload: NotificationPayload) => void
  onWhatsAppMessage?: (payload: WhatsAppMessagePayload) => void
}

type Subscriber = SignalRHandlers

let connection: signalR.HubConnection | null = null
let connectingPromise: Promise<void> | null = null
let activeSessionKey: string | null = null
const subscribers = new Map<number, Subscriber>()
let nextSubscriberId = 0

function mapNotificationPayload(raw: Record<string, unknown>): NotificationPayload {
  return {
    notificationId: String(raw.notificationId ?? raw.NotificationId ?? ''),
    title: String(raw.title ?? raw.Title ?? ''),
    message: String(raw.message ?? raw.Message ?? ''),
    actionUrl: (raw.actionUrl ?? raw.ActionUrl) as string | null | undefined,
  }
}

function mapWhatsAppPayload(raw: Record<string, unknown>): WhatsAppMessagePayload {
  return {
    citizenConversationId: String(raw.citizenConversationId ?? raw.CitizenConversationId ?? ''),
    citizenPhone: String(raw.citizenPhone ?? raw.CitizenPhone ?? ''),
    citizenName: (raw.citizenName ?? raw.CitizenName) as string | null,
    messagePreview: (raw.messagePreview ?? raw.MessagePreview) as string | null,
    unreadCount: Number(raw.unreadCount ?? raw.UnreadCount ?? 0),
    lastMessageAt: String(raw.lastMessageAt ?? raw.LastMessageAt ?? ''),
  }
}

async function disconnectSignalR() {
  if (connection) {
    await connection.stop()
    connection = null
  }
  activeSessionKey = null
}

async function ensureConnection(sessionPresent: boolean) {
  if (!sessionPresent) {
    await disconnectSignalR()
    return
  }

  const sessionKey = 'active'
  if (connection?.state === signalR.HubConnectionState.Connected && activeSessionKey === sessionKey) {
    return
  }

  if (connectingPromise) {
    await connectingPromise
    return
  }

  connectingPromise = (async () => {
    await disconnectSignalR()
    activeSessionKey = sessionKey

    const nextConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${API_ORIGIN}/hubs/notifications`, {
        withCredentials: true,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build()

    nextConnection.on('ReceiveNotification', (payload: Record<string, unknown>) => {
      const mapped = mapNotificationPayload(payload)
      subscribers.forEach(subscriber => subscriber.onNotification?.(mapped))
    })

    nextConnection.on('ReceiveWhatsAppMessage', (payload: Record<string, unknown>) => {
      const mapped = mapWhatsAppPayload(payload)
      subscribers.forEach(subscriber => subscriber.onWhatsAppMessage?.(mapped))
    })

    await nextConnection.start()
    connection = nextConnection
  })()

  try {
    await connectingPromise
  } catch (err) {
    console.warn('SignalR connection failed:', err)
  } finally {
    connectingPromise = null
  }
}

export function useSignalR(handlers?: SignalRHandlers) {
  const { session } = useAuth()
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    void ensureConnection(Boolean(session))
  }, [session])

  useEffect(() => {
    const id = ++nextSubscriberId
    subscribers.set(id, {
      onNotification: payload => handlersRef.current?.onNotification?.(payload),
      onWhatsAppMessage: payload => handlersRef.current?.onWhatsAppMessage?.(payload),
    })
    return () => {
      subscribers.delete(id)
    }
  }, [])
}

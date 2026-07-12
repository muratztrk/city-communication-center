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
  /** Birim içi (Kurum İçi İlet) mesaj bildirimi; aktif konuşmada otomatik okundu-işaretleme atlanır (card #1295). */
  isInternal?: boolean
  /** Teslim durumu güncellemesi; açık konuşma yenilenir ama okundu yazılmaz. */
  isStatusUpdate?: boolean
  /** Birim içi mesajı gönderen kullanıcı — kendi gönderdiği mesaj bildirim/pulse tetiklemesin (card #1495). */
  senderUserId?: string | null
}

export interface InternalMessagePayload {
  internalConversationId: string
  senderUserId: string
  senderDisplayName: string
  messagePreview: string
  createdAtUtc: string
}

export interface SignalRHandlers {
  onNotification?: (payload: NotificationPayload) => void
  onWhatsAppMessage?: (payload: WhatsAppMessagePayload) => void
  onInternalMessage?: (payload: InternalMessagePayload) => void
  onReconnected?: () => void
}

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
    isInternal: Boolean(raw.isInternal ?? raw.IsInternal ?? false),
    isStatusUpdate: Boolean(raw.isStatusUpdate ?? raw.IsStatusUpdate ?? false),
    senderUserId: (raw.senderUserId ?? raw.SenderUserId) as string | null | undefined,
  }
}

function mapInternalMessagePayload(raw: Record<string, unknown>): InternalMessagePayload {
  return {
    internalConversationId: String(raw.internalConversationId ?? raw.InternalConversationId ?? ''),
    senderUserId: String(raw.senderUserId ?? raw.SenderUserId ?? ''),
    senderDisplayName: String(raw.senderDisplayName ?? raw.SenderDisplayName ?? ''),
    messagePreview: String(raw.messagePreview ?? raw.MessagePreview ?? ''),
    createdAtUtc: String(raw.createdAtUtc ?? raw.CreatedAtUtc ?? ''),
  }
}

const notificationHandlers = new Set<(payload: NotificationPayload) => void>()
const whatsAppMessageHandlers = new Set<(payload: WhatsAppMessagePayload) => void>()
const internalMessageHandlers = new Set<(payload: InternalMessagePayload) => void>()
const reconnectHandlers = new Set<() => void>()

let connection: signalR.HubConnection | null = null
let connectingPromise: Promise<void> | null = null
let sessionActive = false

function dispatchNotification(payload: NotificationPayload) {
  notificationHandlers.forEach(handler => handler(payload))
}

function dispatchWhatsAppMessage(payload: WhatsAppMessagePayload) {
  whatsAppMessageHandlers.forEach(handler => handler(payload))
  window.dispatchEvent(new CustomEvent('ccc:whatsapp-message', { detail: payload }))
}

function dispatchInternalMessage(payload: InternalMessagePayload) {
  internalMessageHandlers.forEach(handler => handler(payload))
}

function dispatchReconnect() {
  reconnectHandlers.forEach(handler => handler())
}

async function disconnectSignalR() {
  if (connection) {
    await connection.stop()
    connection = null
  }
}

function attachConnectionHandlers(nextConnection: signalR.HubConnection) {
  nextConnection.off('ReceiveNotification')
  nextConnection.off('ReceiveWhatsAppMessage')
  nextConnection.off('ReceiveInternalMessage')
  nextConnection.off('reconnected')

  nextConnection.on('ReceiveNotification', (payload: Record<string, unknown>) => {
    dispatchNotification(mapNotificationPayload(payload))
  })

  nextConnection.on('ReceiveWhatsAppMessage', (payload: Record<string, unknown>) => {
    dispatchWhatsAppMessage(mapWhatsAppPayload(payload))
  })

  nextConnection.on('ReceiveInternalMessage', (payload: Record<string, unknown>) => {
    dispatchInternalMessage(mapInternalMessagePayload(payload))
  })

  nextConnection.onreconnected(() => {
    dispatchReconnect()
  })
}

async function ensureConnection(active: boolean) {
  sessionActive = active
  if (!active) {
    await disconnectSignalR()
    return
  }

  if (connection?.state === signalR.HubConnectionState.Connected) {
    return
  }

  if (connectingPromise) {
    await connectingPromise
    return
  }

  connectingPromise = (async () => {
    if (connection?.state === signalR.HubConnectionState.Connected) {
      return
    }

    if (connection) {
      await disconnectSignalR()
    }

    const nextConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${API_ORIGIN}/hubs/notifications`, {
        withCredentials: true,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build()

    attachConnectionHandlers(nextConnection)

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

  useEffect(() => {
    handlersRef.current = handlers
  })

  useEffect(() => {
    void ensureConnection(Boolean(session))
  }, [session])

  useEffect(() => {
    const onNotification = (payload: NotificationPayload) => {
      handlersRef.current?.onNotification?.(payload)
    }
    const onWhatsAppMessage = (payload: WhatsAppMessagePayload) => {
      handlersRef.current?.onWhatsAppMessage?.(payload)
    }
    const onInternalMessage = (payload: InternalMessagePayload) => {
      handlersRef.current?.onInternalMessage?.(payload)
    }
    const onReconnected = () => {
      handlersRef.current?.onReconnected?.()
    }

    notificationHandlers.add(onNotification)
    whatsAppMessageHandlers.add(onWhatsAppMessage)
    internalMessageHandlers.add(onInternalMessage)
    reconnectHandlers.add(onReconnected)

    void ensureConnection(sessionActive)

    return () => {
      notificationHandlers.delete(onNotification)
      whatsAppMessageHandlers.delete(onWhatsAppMessage)
      internalMessageHandlers.delete(onInternalMessage)
      reconnectHandlers.delete(onReconnected)
    }
  }, [])
}

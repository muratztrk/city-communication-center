import { useEffect, useRef } from 'react'
import * as signalR from '@microsoft/signalr'
import { useAuth } from '../context/AuthContext'
import { API_ORIGIN } from '../api/config'
import { getSignalRAccessToken, getValidAccessToken } from '../api/auth'

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
  /** Sistem otomatik giden mesaj — FAB pulse/rozet tetiklemesin (#2562). */
  isAutomaticOutbound?: boolean
}

export interface InternalMessagePayload {
  internalConversationId: string
  senderUserId: string
  senderDisplayName: string
  messagePreview: string
  createdAtUtc: string
  isReadReceipt?: boolean
}

export interface InternalMessageTypingPayload {
  senderUserId: string
  recipientUserId: string
  isTyping: boolean
}

export interface SignalRHandlers {
  onNotification?: (payload: NotificationPayload) => void
  onWhatsAppMessage?: (payload: WhatsAppMessagePayload) => void
  onInternalMessage?: (payload: InternalMessagePayload) => void
  onInternalMessageTyping?: (payload: InternalMessageTypingPayload) => void
  onReconnected?: () => void
  onConnectionStateChange?: (state: SignalRConnectionState) => void
}

export type SignalRConnectionState = 'connected' | 'connecting' | 'reconnecting' | 'disconnected'

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
    isAutomaticOutbound: Boolean(raw.isAutomaticOutbound ?? raw.IsAutomaticOutbound ?? false)
      || String(raw.messagePreview ?? raw.MessagePreview ?? '').toLocaleLowerCase('tr').includes('talebinizin durumu'),
  }
}

function mapInternalMessagePayload(raw: Record<string, unknown>): InternalMessagePayload {
  return {
    internalConversationId: String(raw.internalConversationId ?? raw.InternalConversationId ?? ''),
    senderUserId: String(raw.senderUserId ?? raw.SenderUserId ?? ''),
    senderDisplayName: String(raw.senderDisplayName ?? raw.SenderDisplayName ?? ''),
    messagePreview: String(raw.messagePreview ?? raw.MessagePreview ?? ''),
    createdAtUtc: String(raw.createdAtUtc ?? raw.CreatedAtUtc ?? ''),
    isReadReceipt: Boolean(raw.isReadReceipt ?? raw.IsReadReceipt ?? false),
  }
}

function mapInternalMessageTypingPayload(raw: Record<string, unknown> | unknown[]): InternalMessageTypingPayload {
  if (Array.isArray(raw)) {
    return {
      senderUserId: String(raw[0] ?? ''),
      recipientUserId: String(raw[1] ?? ''),
      isTyping: raw[2] === true || raw[2] === 1 || raw[2] === 'true',
    }
  }

  const record = raw as Record<string, unknown>
  const isTypingRaw = record.isTyping ?? record.IsTyping
  const isTyping = isTypingRaw === true
    || isTypingRaw === 1
    || isTypingRaw === 'true'

  return {
    senderUserId: String(record.senderUserId ?? record.SenderUserId ?? ''),
    recipientUserId: String(record.recipientUserId ?? record.RecipientUserId ?? ''),
    isTyping,
  }
}

const notificationHandlers = new Set<(payload: NotificationPayload) => void>()
const whatsAppMessageHandlers = new Set<(payload: WhatsAppMessagePayload) => void>()
const internalMessageHandlers = new Set<(payload: InternalMessagePayload) => void>()
const internalMessageTypingHandlers = new Set<(payload: InternalMessageTypingPayload) => void>()
const reconnectHandlers = new Set<() => void>()
const connectionStateHandlers = new Set<(state: SignalRConnectionState) => void>()

let connection: signalR.HubConnection | null = null
let connectingPromise: Promise<void> | null = null
let sessionActive = false
let connectionState: SignalRConnectionState = 'disconnected'
let initialRetryAttempt = 0
let initialRetryTimer: number | null = null

const INITIAL_RETRY_DELAYS_MS = [2_000, 5_000, 10_000, 30_000]

async function buildHubConnectionOptions(): Promise<signalR.IHttpConnectionOptions> {
  const options: signalR.IHttpConnectionOptions = {
    withCredentials: true,
  }

  const localToken = await getValidAccessToken()
  if (localToken) {
    options.accessTokenFactory = async () => localToken
    return options
  }

  const hubToken = await getSignalRAccessToken()
  if (hubToken) {
    options.accessTokenFactory = async () => hubToken
  }

  return options
}

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

function dispatchInternalMessageTyping(payload: InternalMessageTypingPayload) {
  internalMessageTypingHandlers.forEach(handler => handler(payload))
}

function dispatchReconnect() {
  reconnectHandlers.forEach(handler => handler())
}

function setConnectionState(state: SignalRConnectionState) {
  if (connectionState === state) return
  connectionState = state
  connectionStateHandlers.forEach(handler => handler(state))
}

function clearInitialRetry() {
  if (initialRetryTimer != null) {
    window.clearTimeout(initialRetryTimer)
    initialRetryTimer = null
  }
}

function scheduleInitialRetry() {
  if (!sessionActive || initialRetryTimer != null) return

  const delay = INITIAL_RETRY_DELAYS_MS[Math.min(initialRetryAttempt, INITIAL_RETRY_DELAYS_MS.length - 1)]
  initialRetryAttempt += 1
  initialRetryTimer = window.setTimeout(() => {
    initialRetryTimer = null
    void ensureConnection(true)
  }, delay)
}

async function disconnectSignalR() {
  clearInitialRetry()
  if (connection) {
    await connection.stop()
    connection = null
  }
  setConnectionState('disconnected')
}

function attachConnectionHandlers(nextConnection: signalR.HubConnection) {
  nextConnection.off('ReceiveNotification')
  nextConnection.off('ReceiveWhatsAppMessage')
  nextConnection.off('ReceiveInternalMessage')
  nextConnection.off('ReceiveInternalMessageTyping')
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

  nextConnection.on('ReceiveInternalMessageTyping', (payload: Record<string, unknown> | unknown[]) => {
    dispatchInternalMessageTyping(mapInternalMessageTypingPayload(payload))
  })

  nextConnection.onreconnected(async () => {
    initialRetryAttempt = 0
    clearInitialRetry()
    setConnectionState('connected')
    try {
      await nextConnection.invoke('RegisterPresence')
    } catch {
      // Bir sonraki reconnect veya poll ile eşitlenir.
    }
    dispatchReconnect()
  })

  nextConnection.onreconnecting(() => {
    setConnectionState('reconnecting')
  })

  nextConnection.onclose(() => {
    if (connection !== nextConnection) return
    connection = null
    setConnectionState('disconnected')
    scheduleInitialRetry()
  })
}

async function ensureConnection(active: boolean) {
  sessionActive = active
  if (!active) {
    await disconnectSignalR()
    return
  }

  if (connection?.state === signalR.HubConnectionState.Connected) {
    setConnectionState('connected')
    return
  }

  if (connection?.state === signalR.HubConnectionState.Connecting
    || connection?.state === signalR.HubConnectionState.Reconnecting) {
    if (connectingPromise) {
      await connectingPromise
    }
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

    setConnectionState('connecting')

    const nextConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${API_ORIGIN}/hubs/notifications`, await buildHubConnectionOptions())
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build()

    attachConnectionHandlers(nextConnection)

    connection = nextConnection
    try {
      await nextConnection.start()
      await nextConnection.invoke('RegisterPresence')
    } catch (error) {
      if (connection === nextConnection) connection = null
      throw error
    }

    if (!sessionActive) {
      await disconnectSignalR()
      return
    }

    initialRetryAttempt = 0
    clearInitialRetry()
    setConnectionState('connected')
  })()

  try {
    await connectingPromise
  } catch (err) {
    setConnectionState('disconnected')
    console.warn('SignalR connection failed:', err)
    scheduleInitialRetry()
  } finally {
    connectingPromise = null
  }
}

export function ensureSignalRConnected() {
  return ensureConnection(sessionActive)
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
    const onInternalMessageTyping = (payload: InternalMessageTypingPayload) => {
      handlersRef.current?.onInternalMessageTyping?.(payload)
    }
    const onReconnected = () => {
      handlersRef.current?.onReconnected?.()
    }
    const onConnectionStateChange = (state: SignalRConnectionState) => {
      handlersRef.current?.onConnectionStateChange?.(state)
    }

    notificationHandlers.add(onNotification)
    whatsAppMessageHandlers.add(onWhatsAppMessage)
    internalMessageHandlers.add(onInternalMessage)
    internalMessageTypingHandlers.add(onInternalMessageTyping)
    reconnectHandlers.add(onReconnected)
    connectionStateHandlers.add(onConnectionStateChange)
    onConnectionStateChange(connectionState)

    void ensureConnection(sessionActive)

    return () => {
      notificationHandlers.delete(onNotification)
      whatsAppMessageHandlers.delete(onWhatsAppMessage)
      internalMessageHandlers.delete(onInternalMessage)
      internalMessageTypingHandlers.delete(onInternalMessageTyping)
      reconnectHandlers.delete(onReconnected)
      connectionStateHandlers.delete(onConnectionStateChange)
    }
  }, [])
}

import { useEffect, useRef, useCallback } from 'react'
import * as signalR from '@microsoft/signalr'
import { useAuth } from '../context/AuthContext'
import { getValidAccessToken } from '../api/auth'
import { API_ORIGIN } from '../api/config'

export function useSignalR(onNotification?: (payload: NotificationPayload) => void) {
  const { session } = useAuth()
  const connectionRef = useRef<signalR.HubConnection | null>(null)

  const connect = useCallback(async () => {
    if (!session?.accessToken) return
    if (connectionRef.current?.state === signalR.HubConnectionState.Connected) return

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${API_ORIGIN}/hubs/notifications`, {
        accessTokenFactory: async () => (await getValidAccessToken()) ?? '',
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build()

    connection.on('ReceiveNotification', (payload: NotificationPayload) => {
      onNotification?.(payload)
    })

    try {
      await connection.start()
      connectionRef.current = connection
    } catch (err) {
      console.warn('SignalR connection failed:', err)
    }
  }, [session?.accessToken, onNotification])

  useEffect(() => {
    connect()
    return () => {
      connectionRef.current?.stop()
      connectionRef.current = null
    }
  }, [connect])

  return connectionRef
}

export interface NotificationPayload {
  notificationId: string
  title: string
  message: string
  actionUrl?: string | null
}

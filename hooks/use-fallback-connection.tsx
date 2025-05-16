"use client"

import { useState, useEffect, useCallback } from "react"

// This is a fallback for when Socket.IO connection fails
export function useFallbackConnection(roomId: string) {
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastEventTime, setLastEventTime] = useState(Date.now())
  const [events, setEvents] = useState<any[]>([])

  // Poll for events
  useEffect(() => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/socket-proxy?roomId=${roomId}&lastEventTime=${lastEventTime}`, {
          method: "GET",
        })

        if (response.ok) {
          const data = await response.json()
          if (data.events && data.events.length > 0) {
            setEvents((prev) => [...prev, ...data.events])
            setLastEventTime(Date.now())
          }
          setIsConnected(true)
          setError(null)
        } else {
          throw new Error(`Server returned ${response.status}`)
        }
      } catch (err) {
        setError(`폴링 오류: ${err instanceof Error ? err.message : "알 수 없는 오류"}`)
        setIsConnected(false)
      }
    }, 2000) // Poll every 2 seconds

    return () => clearInterval(pollInterval)
  }, [roomId, lastEventTime])

  // Send event
  const sendEvent = useCallback(
    async (event: string, data: any) => {
      try {
        const response = await fetch("/api/socket-proxy", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            event,
            data,
            roomId,
          }),
        })

        if (!response.ok) {
          throw new Error(`Server returned ${response.status}`)
        }

        return true
      } catch (err) {
        setError(`이벤트 전송 오류: ${err instanceof Error ? err.message : "알 수 없는 오류"}`)
        return false
      }
    },
    [roomId],
  )

  return {
    isConnected,
    error,
    events,
    sendEvent,
  }
}

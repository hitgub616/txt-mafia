"use client"

import { useEffect, useState } from "react"
import { io, type Socket } from "socket.io-client"
import { CLIENT_CONFIG } from "@/environment-variables"

export function useSocket(roomId: string) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Check if we're in offline mode
  const isOfflineMode =
    (typeof window !== "undefined" && roomId.startsWith("offline-")) || sessionStorage.getItem("offlineMode") === "true"

  useEffect(() => {
    // If in offline mode, don't attempt to connect
    if (isOfflineMode) {
      console.log("Offline mode detected - skipping Socket.IO connection")
      setIsConnected(true) // Simulate connected state
      return () => {} // Empty cleanup function
    }

    // Reset error state
    setError(null)

    // Determine the correct Socket.IO URL based on the environment
    const socketUrl =
      window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
        ? `http://${window.location.hostname}:3001` // Use port 3001 for local development
        : CLIENT_CONFIG.PUBLIC_SOCKET_URL // Use configured URL in production

    console.log(`[Socket.IO] 연결 시도: ${socketUrl}`)

    // Create socket connection with explicit options
    const socketInstance = io(socketUrl, {
      transports: ["polling"], // 먼저 polling만 사용
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000,
      autoConnect: true,
    })

    // Set up event listeners
    socketInstance.on("connect", () => {
      console.log("[Socket.IO] 연결 성공:", socketInstance.id)
      setIsConnected(true)
      setError(null)
    })

    socketInstance.on("connect_error", (err) => {
      console.error("[Socket.IO] 연결 오류:", err)
      setError(`연결 오류: ${err.message}`)
      setIsConnected(false)
    })

    socketInstance.on("disconnect", (reason) => {
      console.log(`[Socket.IO] 연결 해제: ${reason}`)
      setIsConnected(false)
    })

    // Save socket instance
    setSocket(socketInstance)

    // Clean up on unmount
    return () => {
      console.log("[Socket.IO] 연결 정리 중")
      socketInstance.disconnect()
    }
  }, [roomId, isOfflineMode])

  // For offline mode, return a mock socket
  if (isOfflineMode) {
    return {
      socket: {
        emit: (event: string, data: any) => {
          console.log(`[Offline Mode] Emitting event: ${event}`, data)
          return true
        },
        on: (event: string, callback: Function) => {
          console.log(`[Offline Mode] Registered listener for event: ${event}`)
          return () => {}
        },
        off: (event: string) => {
          console.log(`[Offline Mode] Removed listener for event: ${event}`)
          return true
        },
      } as unknown as Socket,
      isConnected: true,
      error: null,
    }
  }

  return {
    socket,
    isConnected,
    error,
  }
}

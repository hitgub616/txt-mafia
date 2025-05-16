"use client"

import { useEffect, useState } from "react"
import { io, type Socket } from "socket.io-client"
import { CLIENT_CONFIG } from "@/environment-variables"

// 전역 소켓 인스턴스를 저장할 변수를 window 객체에 추가합니다.
declare global {
  interface Window {
    _socketInstance: Socket | undefined
  }
}

export function useSocket(roomId: string) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [connectionAttempts, setConnectionAttempts] = useState(0)

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

    // 이미 연결된 소켓이 있으면 재사용
    if (socket && isConnected) {
      console.log("Socket already connected, reusing existing connection")
      return () => {}
    }

    // Reset error state
    setError(null)

    // Determine the correct Socket.IO URL based on the environment
    const socketUrl =
      window.location.hostname === "localhost"
        ? `http://${window.location.hostname}:3001` // Use port 3001 for local development
        : CLIENT_CONFIG.PUBLIC_SOCKET_URL // Use configured URL in production

    console.log(`Connecting to Socket.IO server at: ${socketUrl}`)

    // 전역 소켓 인스턴스 생성 (싱글톤 패턴)
    // 이미 존재하는 소켓 연결이 있는지 확인
    if (window._socketInstance) {
      console.log("Reusing existing global socket instance")
      setSocket(window._socketInstance)
      setIsConnected(true)
      return () => {}
    }

    // Create socket connection with explicit options
    const socketInstance = io(socketUrl, {
      query: { roomId },
      transports: ["websocket", "polling"], // Try WebSocket first, then fallback to polling
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000, // Increased timeout
      withCredentials: false, // Disable credentials for cross-origin requests
      forceNew: true,
      autoConnect: true,
    })

    // 전역 변수에 소켓 인스턴스 저장
    window._socketInstance = socketInstance

    // Set up event listeners
    socketInstance.on("connect", () => {
      console.log("Socket connected successfully", socketInstance.id)
      setIsConnected(true)
      setError(null)
    })

    socketInstance.on("connect_error", (err) => {
      console.error("Socket connection error:", err)
      setError(`연결 오류: ${err.message}\n\n서버 URL: ${socketUrl}\n시도: ${connectionAttempts + 1}/5`)
      setConnectionAttempts((prev) => prev + 1)
    })

    socketInstance.on("disconnect", (reason) => {
      console.log(`Socket disconnected: ${reason}`)
      setIsConnected(false)
      if (reason === "io server disconnect") {
        // the disconnection was initiated by the server, reconnect manually
        socketInstance.connect()
      }
    })

    // 추가 디버깅 이벤트
    socketInstance.io.on("error", (error) => {
      console.error("Transport error:", error)
    })

    socketInstance.io.on("reconnect", (attempt) => {
      console.log(`Socket reconnected after ${attempt} attempts`)
    })

    socketInstance.io.on("reconnect_attempt", (attempt) => {
      console.log(`Socket reconnect attempt: ${attempt}`)
    })

    socketInstance.io.on("reconnect_error", (error) => {
      console.error("Socket reconnect error:", error)
    })

    socketInstance.io.on("reconnect_failed", () => {
      console.error("Socket reconnect failed")
    })

    // Save socket instance
    setSocket(socketInstance)

    // Clean up on unmount
    return () => {
      console.log("Cleaning up socket connection")
      socketInstance.disconnect()
    }
  }, [roomId, connectionAttempts, isOfflineMode, socket, isConnected])

  // Retry connection if failed
  useEffect(() => {
    if (!isOfflineMode && error && connectionAttempts < 5) {
      const retryTimer = setTimeout(() => {
        console.log(`Retrying connection (Attempt ${connectionAttempts + 1}/5)...`)
      }, 3000)

      return () => clearTimeout(retryTimer)
    }
  }, [error, connectionAttempts, isOfflineMode])

  // For offline mode, return a mock socket
  if (isOfflineMode) {
    return {
      socket: {
        emit: (event: string, data: any) => {
          console.log(`[Offline Mode] Emitting event: ${event}`, data)
          // You could implement offline mode logic here
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
      connectionDetails: {
        url: "offline-mode",
        attempts: 0,
      },
    }
  }

  return {
    socket,
    isConnected,
    error,
    connectionDetails: {
      url:
        window.location.hostname === "localhost"
          ? `http://${window.location.hostname}:3001`
          : CLIENT_CONFIG.PUBLIC_SOCKET_URL,
      attempts: connectionAttempts,
      clientUrl: CLIENT_CONFIG.CLIENT_URL,
    },
  }
}

"use client"

import { useEffect, useState, useRef } from "react"
import { io, type Socket } from "socket.io-client"
import { CLIENT_CONFIG } from "@/environment-variables"

export function useSocket(roomId: string) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    // Reset error state
    setError(null)

    // Determine the correct Socket.IO URL based on the environment
    const socketUrl =
      typeof window !== "undefined" &&
      (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
        ? `http://${window.location.hostname}:3001` // Use port 3001 for local development
        : CLIENT_CONFIG.PUBLIC_SOCKET_URL // Use configured URL in production

    console.log(`[Socket.IO] 연결 시도: ${socketUrl}`)

    // 이미 소켓이 존재하고 연결되어 있으면 재사용
    if (socketRef.current && socketRef.current.connected) {
      console.log("[Socket.IO] 기존 연결 재사용:", socketRef.current.id)
      setSocket(socketRef.current)
      setIsConnected(true)
      return () => {}
    }

    // Create socket connection with explicit options
    const socketInstance = io(socketUrl, {
      transports: ["websocket", "polling"], // WebSocket 우선 시도, 실패 시 polling으로 전환
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
    socketRef.current = socketInstance
    setSocket(socketInstance)

    // Clean up on unmount
    return () => {
      console.log("[Socket.IO] 연결 정리 중")
      socketInstance.disconnect()
      socketRef.current = null
    }
  }, [roomId])

  return {
    socket,
    isConnected,
    error,
  }
}

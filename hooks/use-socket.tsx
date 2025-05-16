"use client"

import { useEffect, useState } from "react"
import { io, type Socket } from "socket.io-client"

export function useSocket(roomId: string) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [connectionAttempts, setConnectionAttempts] = useState(0)

  useEffect(() => {
    // Reset error state
    setError(null)

    // Use the Railway URL directly
    const socketUrl = "https://txtmafiav0-production.up.railway.app"

    console.log(`Connecting to Socket.IO server at: ${socketUrl} (Attempt: ${connectionAttempts + 1})`)

    // Create socket connection with explicit options
    const socketInstance = io(socketUrl, {
      query: { roomId },
      transports: ["websocket", "polling"], // Try WebSocket first, then fallback to polling
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000, // Increased timeout
      withCredentials: false, // Disable credentials for cross-origin requests
      forceNew: true, // Force a new connection
    })

    // Set up event listeners
    socketInstance.on("connect", () => {
      console.log("Socket connected successfully")
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

    // Save socket instance
    setSocket(socketInstance)

    // Clean up on unmount
    return () => {
      console.log("Cleaning up socket connection")
      socketInstance.disconnect()
    }
  }, [roomId, connectionAttempts])

  // Retry connection if failed
  useEffect(() => {
    if (error && connectionAttempts < 5) {
      const retryTimer = setTimeout(() => {
        console.log(`Retrying connection (Attempt ${connectionAttempts + 1}/5)...`)
      }, 3000)

      return () => clearTimeout(retryTimer)
    }
  }, [error, connectionAttempts])

  return {
    socket,
    isConnected,
    error,
    connectionDetails: {
      url: "https://txtmafiav0-production.up.railway.app",
      attempts: connectionAttempts,
    },
  }
}

"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, XCircle, AlertTriangle, RefreshCw } from "lucide-react"
import { io } from "socket.io-client"

export function ConnectionTest() {
  const [isLoading, setIsLoading] = useState(true)
  const [testResults, setTestResults] = useState<{
    serverReachable: boolean | null
    websocketSupported: boolean | null
    corsAllowed: boolean | null
    message: string | null
  }>({
    serverReachable: null,
    websocketSupported: null,
    corsAllowed: null,
    message: null,
  })

  const runTests = async () => {
    setIsLoading(true)
    setTestResults({
      serverReachable: null,
      websocketSupported: null,
      corsAllowed: null,
      message: null,
    })

    // Test server reachability
    let serverReachable = false
    let corsAllowed = false
    let websocketSupported = false
    let message = null

    try {
      // Test basic HTTP connectivity
      const response = await fetch("https://v0-txt-mafia.vercel.app/api/socket", {
        method: "HEAD",
        mode: "no-cors",
      })
      serverReachable = true

      // Test Socket.IO connectivity
      const socket = io("https://v0-txt-mafia.vercel.app/api/socket", {
        transports: ["websocket"],
        timeout: 5000,
        forceNew: true,
      })

      // Set up a promise to wait for connection or error
      const connectionResult = await new Promise<{ success: boolean; transport?: string; error?: string }>(
        (resolve) => {
          socket.on("connect", () => {
            resolve({ success: true, transport: socket.io.engine.transport.name })
            socket.disconnect()
          })

          socket.on("connect_error", (err) => {
            resolve({ success: false, error: err.message })
            socket.disconnect()
          })

          // Timeout after 5 seconds
          setTimeout(() => {
            resolve({ success: false, error: "Connection timeout" })
            socket.disconnect()
          }, 5000)
        },
      )

      if (connectionResult.success) {
        corsAllowed = true
        websocketSupported = connectionResult.transport === "websocket"
        message = `연결 성공! 전송 방식: ${connectionResult.transport}`
      } else {
        message = `연결 실패: ${connectionResult.error}`
      }
    } catch (error) {
      message = `테스트 중 오류 발생: ${error instanceof Error ? error.message : String(error)}`
    }

    setTestResults({
      serverReachable,
      websocketSupported,
      corsAllowed,
      message,
    })
    setIsLoading(false)
  }

  useEffect(() => {
    runTests()
  }, [])

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>서버 연결 테스트</CardTitle>
        <CardDescription>Socket.IO 서버 연결 상태를 확인합니다</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span>서버 접근 가능</span>
            {isLoading ? (
              <div className="animate-spin h-5 w-5 border-t-2 border-b-2 border-primary rounded-full"></div>
            ) : testResults.serverReachable === null ? (
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
            ) : testResults.serverReachable ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500" />
            )}
          </div>

          <div className="flex items-center justify-between">
            <span>CORS 허용</span>
            {isLoading ? (
              <div className="animate-spin h-5 w-5 border-t-2 border-b-2 border-primary rounded-full"></div>
            ) : testResults.corsAllowed === null ? (
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
            ) : testResults.corsAllowed ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500" />
            )}
          </div>

          <div className="flex items-center justify-between">
            <span>WebSocket 지원</span>
            {isLoading ? (
              <div className="animate-spin h-5 w-5 border-t-2 border-b-2 border-primary rounded-full"></div>
            ) : testResults.websocketSupported === null ? (
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
            ) : testResults.websocketSupported ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500" />
            )}
          </div>

          {testResults.message && (
            <div className="mt-4 p-3 bg-secondary/50 rounded-md text-sm">
              <p>{testResults.message}</p>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={runTests} className="w-full" disabled={isLoading}>
          {isLoading ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> 테스트 중...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" /> 다시 테스트
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}

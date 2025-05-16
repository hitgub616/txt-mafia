"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, XCircle, AlertTriangle, RefreshCw } from "lucide-react"
import { io } from "socket.io-client"
import { CLIENT_CONFIG } from "@/environment-variables"

export function ConnectionTest() {
  const [isLoading, setIsLoading] = useState(true)
  const [socketUrl, setSocketUrl] = useState("")
  const [clientUrl, setClientUrl] = useState("")
  const [testResults, setTestResults] = useState<{
    serverReachable: boolean | null
    websocketSupported: boolean | null
    corsAllowed: boolean | null
    message: string | null
    details: string | null
  }>({
    serverReachable: null,
    websocketSupported: null,
    corsAllowed: null,
    message: null,
    details: null,
  })

  // 컴포넌트가 마운트된 후에만 window 객체에 접근
  useEffect(() => {
    // 환경 변수에서 Socket.IO 서버 URL 가져오기
    let url = CLIENT_CONFIG.PUBLIC_SOCKET_URL

    if (typeof window !== "undefined") {
      if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
        url = `http://${window.location.hostname}:3001`
      }
      setSocketUrl(url)
      setClientUrl(window.location.origin)

      // 초기 테스트 실행
      runTests(url)
    }
  }, [])

  const runTests = async (url: string) => {
    if (typeof window === "undefined") return

    setIsLoading(true)
    setTestResults({
      serverReachable: null,
      websocketSupported: null,
      corsAllowed: null,
      message: null,
      details: null,
    })

    // Test server reachability
    let serverReachable = false
    let corsAllowed = false
    let websocketSupported = false
    let message = null
    let details = null

    try {
      console.log(`[연결 테스트] 서버 URL: ${url}`)
      console.log(`[연결 테스트] 클라이언트 URL: ${window.location.origin}`)
      console.log(`[연결 테스트] 환경 변수: NEXT_PUBLIC_SOCKET_URL=${process.env.NEXT_PUBLIC_SOCKET_URL}`)

      // Test basic HTTP connectivity
      try {
        // 먼저 기본 루트 경로 테스트
        const rootResponse = await fetch(`${url}`, {
          method: "GET",
          mode: "cors",
          headers: {
            Origin: window.location.origin,
          },
        }).catch((err) => {
          console.error("[연결 테스트] 루트 경로 연결 오류:", err)
          return null
        })

        if (rootResponse && rootResponse.ok) {
          serverReachable = true
          details = `서버 루트 경로 접근 성공`
          console.log("[연결 테스트] 서버 루트 경로 접근 성공")
        } else {
          // 상태 엔드포인트 테스트
          const statusResponse = await fetch(`${url}/status`, {
            method: "GET",
            mode: "cors",
            headers: {
              Origin: window.location.origin,
            },
          }).catch((err) => {
            console.error("[연결 테스트] 상태 엔드포인트 연결 오류:", err)
            return null
          })

          if (statusResponse && statusResponse.ok) {
            const data = await statusResponse.json()
            serverReachable = true
            details = `서버 상태: ${JSON.stringify(data, null, 2)}`
            console.log("[연결 테스트] 서버 상태:", data)
          } else {
            throw new Error(`서버 응답 코드: ${statusResponse ? statusResponse.status : "No response"}`)
          }
        }
      } catch (err) {
        console.error("[연결 테스트] HTTP 연결 오류:", err)
        details = `HTTP 연결 오류: ${err instanceof Error ? err.message : String(err)}`
      }

      // Test Socket.IO connectivity
      try {
        const socket = io(url, {
          transports: ["websocket", "polling"],
          timeout: 5000,
          forceNew: true,
          extraHeaders: {
            Origin: window.location.origin,
          },
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
          details = `${details || ""}\n\nSocket.IO 연결 오류: ${connectionResult.error}`
        }
      } catch (error) {
        console.error("[연결 테스트] Socket.IO 연결 오류:", error)
        message = `Socket.IO 테스트 중 오류 발생: ${error instanceof Error ? error.message : String(error)}`
        details = `${details || ""}\n\nSocket.IO 테스트 오류: ${error instanceof Error ? error.stack : String(error)}`
      }
    } catch (error) {
      message = `테스트 중 오류 발생: ${error instanceof Error ? error.message : String(error)}`
      details = `테스트 오류: ${error instanceof Error ? error.stack : String(error)}`
    }

    setTestResults({
      serverReachable,
      websocketSupported,
      corsAllowed,
      message,
      details,
    })
    setIsLoading(false)
  }

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

          {testResults.details && (
            <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-md text-xs font-mono overflow-auto max-h-40">
              <pre className="whitespace-pre-wrap">{testResults.details}</pre>
            </div>
          )}

          <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-md text-sm">
            <p className="font-medium text-blue-400 mb-1">서버 정보</p>
            <p>Socket URL: {socketUrl}</p>
            <p>Client URL: {clientUrl}</p>
            <p>NEXT_PUBLIC_SOCKET_URL: {process.env.NEXT_PUBLIC_SOCKET_URL || "(설정되지 않음)"}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              이 서버는 Socket.IO 서버로, 게임의 실시간 통신과 게임 로직을 처리합니다.
            </p>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={() => socketUrl && runTests(socketUrl)} className="w-full" disabled={isLoading}>
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

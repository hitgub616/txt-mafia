"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, XCircle, RefreshCw } from "lucide-react"
import { CLIENT_CONFIG } from "@/environment-variables"

export function ConnectionTest() {
  const [isLoading, setIsLoading] = useState(true)
  const [testResults, setTestResults] = useState({
    serverReachable: false,
    corsAllowed: false,
    websocketSupported: false,
    message: "",
    details: "",
  })

  // 서버 URL 가져오기
  const getSocketUrl = () => {
    if (typeof window === "undefined") return ""

    return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
      ? `http://${window.location.hostname}:3001`
      : CLIENT_CONFIG.PUBLIC_SOCKET_URL
  }

  const runTests = async () => {
    setIsLoading(true)
    setTestResults({
      serverReachable: false,
      corsAllowed: false,
      websocketSupported: false,
      message: "테스트 중...",
      details: "",
    })

    const socketUrl = getSocketUrl()
    let details = `서버 URL: ${socketUrl}\n`
    let serverReachable = false
    let corsAllowed = false
    let websocketSupported = false
    let message = ""

    try {
      // 1. 기본 HTTP 연결 테스트
      try {
        const response = await fetch(`${socketUrl}/status`, {
          method: "GET",
          mode: "cors",
        })

        if (response.ok) {
          const data = await response.json()
          serverReachable = true
          details += `서버 상태: ${JSON.stringify(data, null, 2)}\n`
        } else {
          throw new Error(`서버 응답 코드: ${response.status}`)
        }
      } catch (err) {
        details += `HTTP 연결 오류: ${err instanceof Error ? err.message : String(err)}\n`
      }

      // 2. WebSocket 지원 확인 (브라우저 기능)
      if (typeof WebSocket !== "undefined") {
        websocketSupported = true
        details += "브라우저가 WebSocket을 지원합니다.\n"
      } else {
        details += "브라우저가 WebSocket을 지원하지 않습니다.\n"
      }

      // 3. CORS 테스트 (간단한 XHR 요청)
      try {
        const xhr = new XMLHttpRequest()
        xhr.open("GET", `${socketUrl}/status`, false)
        xhr.send(null)

        if (xhr.status === 200) {
          corsAllowed = true
          details += "CORS가 허용됩니다.\n"
        } else {
          details += `CORS 테스트 실패: 상태 코드 ${xhr.status}\n`
        }
      } catch (err) {
        details += `CORS 테스트 오류: ${err instanceof Error ? err.message : String(err)}\n`
      }

      // 결과 메시지 생성
      if (serverReachable && corsAllowed && websocketSupported) {
        message = "모든 테스트가 통과되었습니다! 게임 서버에 연결할 수 있습니다."
      } else if (serverReachable) {
        message = "서버에 연결할 수 있지만 일부 기능이 제한될 수 있습니다."
      } else {
        message = "서버에 연결할 수 없습니다. 네트워크 연결을 확인하세요."
      }
    } catch (error) {
      message = `테스트 중 오류 발생: ${error instanceof Error ? error.message : String(error)}`
      details += `테스트 오류: ${error instanceof Error ? error.stack : String(error)}`
    }

    setTestResults({
      serverReachable,
      corsAllowed,
      websocketSupported,
      message,
      details,
    })
    setIsLoading(false)
  }

  useEffect(() => {
    if (typeof window !== "undefined") {
      runTests()
    }
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
            <p>Socket URL: {typeof window !== "undefined" ? getSocketUrl() : "Loading..."}</p>
            <p>Client URL: {typeof window !== "undefined" ? window.location.origin : "Loading..."}</p>
            <p>NEXT_PUBLIC_SOCKET_URL: {process.env.NEXT_PUBLIC_SOCKET_URL || "(설정되지 않음)"}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              이 서버는 Socket.IO 서버로, 게임의 실시간 통신과 게임 로직을 처리합니다.
            </p>
          </div>
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

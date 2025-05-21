"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { debugEnvironmentVariables, CLIENT_CONFIG } from "@/environment-variables"
import { io } from "socket.io-client"

export default function DebugPage() {
  const [envVars, setEnvVars] = useState<any>({})
  const [socketTest, setSocketTest] = useState<{
    status: "idle" | "testing" | "success" | "error"
    message: string
  }>({
    status: "idle",
    message: "테스트를 시작하려면 버튼을 클릭하세요",
  })

  useEffect(() => {
    // 환경 변수 디버깅
    const vars = debugEnvironmentVariables()
    setEnvVars(vars)
  }, [])

  const testSocketConnection = async () => {
    setSocketTest({
      status: "testing",
      message: "Socket.IO 서버에 연결 중...",
    })

    try {
      const socketUrl = CLIENT_CONFIG.PUBLIC_SOCKET_URL

      // 기본 HTTP 연결 테스트
      try {
        const response = await fetch(socketUrl, {
          method: "HEAD",
          mode: "no-cors",
        })
        console.log("HTTP 연결 테스트:", response)
      } catch (error) {
        console.error("HTTP 연결 오류:", error)
      }

      // Socket.IO 연결 테스트
      const socket = io(socketUrl, {
        transports: ["websocket", "polling"],
        timeout: 5000,
        forceNew: true,
      })

      socket.on("connect", () => {
        setSocketTest({
          status: "success",
          message: `연결 성공! Socket ID: ${socket.id}, Transport: ${socket.io.engine.transport.name}`,
        })

        // 5초 후 연결 종료
        setTimeout(() => {
          socket.disconnect()
        }, 5000)
      })

      socket.on("connect_error", (err) => {
        setSocketTest({
          status: "error",
          message: `연결 오류: ${err.message}`,
        })
        socket.disconnect()
      })

      // 10초 타임아웃
      setTimeout(() => {
        if (socketTest.status === "testing") {
          setSocketTest({
            status: "error",
            message: "연결 시간 초과 (10초)",
          })
          socket.disconnect()
        }
      }, 10000)
    } catch (error) {
      setSocketTest({
        status: "error",
        message: `테스트 중 오류 발생: ${error instanceof Error ? error.message : String(error)}`,
      })
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 theme-background">
      <div className="max-w-2xl w-full mx-auto space-y-6">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-2">환경 변수 및 연결 디버깅</h1>
          <p className="text-muted-foreground">현재 설정된 환경 변수와 Socket.IO 연결 상태를 확인합니다</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>환경 변수</CardTitle>
            <CardDescription>현재 설정된 환경 변수 정보</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="font-semibold">NEXT_PUBLIC_SOCKET_URL:</div>
                <div>{envVars.NEXT_PUBLIC_SOCKET_URL || "(설정되지 않음)"}</div>

                <div className="font-semibold">RAILWAY_STATIC_URL:</div>
                <div>{envVars.RAILWAY_STATIC_URL || "(설정되지 않음)"}</div>

                <div className="font-semibold">CLIENT_URL:</div>
                <div>{envVars.CLIENT_URL || "(설정되지 않음)"}</div>

                <div className="font-semibold">NODE_ENV:</div>
                <div>{envVars.NODE_ENV || "(설정되지 않음)"}</div>

                <div className="font-semibold">계산된 Socket URL:</div>
                <div>{envVars.PUBLIC_SOCKET_URL || "(설정되지 않음)"}</div>

                <div className="font-semibold">현재 URL:</div>
                <div>{typeof window !== "undefined" ? window.location.href : "(서버 렌더링)"}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Socket.IO 연결 테스트</CardTitle>
            <CardDescription>Socket.IO 서버 연결 상태 확인</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div
                className={`p-4 rounded-md ${
                  socketTest.status === "idle"
                    ? "bg-gray-100 dark:bg-gray-800"
                    : socketTest.status === "testing"
                      ? "bg-yellow-100 dark:bg-yellow-900"
                      : socketTest.status === "success"
                        ? "bg-green-100 dark:bg-green-900"
                        : "bg-red-100 dark:bg-red-900"
                }`}
              >
                <p>{socketTest.message}</p>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={testSocketConnection} disabled={socketTest.status === "testing"} className="w-full">
              {socketTest.status === "testing" ? "테스트 중..." : "Socket.IO 연결 테스트"}
            </Button>
          </CardFooter>
        </Card>

        <div className="flex justify-center space-x-4">
          <Button variant="outline" onClick={() => (window.location.href = "/")}>
            홈으로 돌아가기
          </Button>
          <Button variant="outline" onClick={() => (window.location.href = "/test")}>
            연결 테스트 페이지로 이동
          </Button>
        </div>
      </div>
    </div>
  )
}

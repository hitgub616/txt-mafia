"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertCircle, Zap } from "lucide-react"
import Link from "next/link"
import { io } from "socket.io-client"
import { CLIENT_CONFIG } from "@/environment-variables"

export function LobbyForm() {
  const router = useRouter()
  const [nickname, setNickname] = useState("")
  const [roomId, setRoomId] = useState("")
  const [newRoomId, setNewRoomId] = useState("")
  const [activeTab, setActiveTab] = useState("join")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nickname || !roomId) return

    // Store nickname in sessionStorage
    sessionStorage.setItem("nickname", nickname)
    router.push(`/room/${roomId}`)
  }

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nickname) return

    // Generate a random room ID if not provided
    const finalRoomId = newRoomId || Math.random().toString(36).substring(2, 8)

    // Store nickname in sessionStorage
    sessionStorage.setItem("nickname", nickname)
    sessionStorage.setItem("isHost", "true")
    router.push(`/room/${finalRoomId}`)
  }

  const handleQuickJoin = async () => {
    if (!nickname) {
      setError("빠른 참가를 위해 닉네임을 입력해주세요.")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // 서버 URL 결정
      const socketUrl =
        typeof window !== "undefined" &&
        (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
          ? `http://${window.location.hostname}:3001`
          : CLIENT_CONFIG.PUBLIC_SOCKET_URL

      // 임시 소켓 연결
      const tempSocket = io(socketUrl, {
        transports: ["websocket", "polling"],
        timeout: 5000,
      })

      // 연결 성공 시
      tempSocket.on("connect", () => {
        // 사용 가능한 방 찾기 요청
        tempSocket.emit("findAvailableRoom", { nickname })
      })

      // 사용 가능한 방 응답 처리
      tempSocket.on("availableRoom", ({ roomId, found }) => {
        tempSocket.disconnect()

        if (found && roomId) {
          // 방을 찾았으면 입장
          sessionStorage.setItem("nickname", nickname)
          router.push(`/room/${roomId}`)
        } else {
          // 방을 찾지 못했으면 에러 표시
          setError("참여 가능한 방이 없습니다. 새 방을 만들거나 다른 방 ID를 입력해주세요.")
          setIsLoading(false)
        }
      })

      // 연결 오류 처리
      tempSocket.on("connect_error", (err) => {
        console.error("빠른 참가 연결 오류:", err)
        setError("서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.")
        setIsLoading(false)
        tempSocket.disconnect()
      })

      // 5초 타임아웃
      setTimeout(() => {
        if (tempSocket.connected) {
          tempSocket.disconnect()
        }
        setError("서버 응답 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.")
        setIsLoading(false)
      }, 5000)
    } catch (err) {
      console.error("빠른 참가 오류:", err)
      setError("알 수 없는 오류가 발생했습니다. 잠시 후 다시 시도해주세요.")
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>게임 참가</CardTitle>
        <CardDescription>닉네임을 입력하고 방에 참가하세요</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nickname">닉네임</Label>
            <Input
              id="nickname"
              placeholder="닉네임을 입력하세요"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              required
            />
          </div>

          {/* 빠른 참가 버튼 */}
          <Button
            className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
            onClick={handleQuickJoin}
            disabled={isLoading || !nickname}
          >
            {isLoading ? (
              <div className="flex items-center">
                <div className="animate-spin h-4 w-4 mr-2 border-2 border-white rounded-full border-t-transparent"></div>
                참가 가능한 방 찾는 중...
              </div>
            ) : (
              <div className="flex items-center">
                <Zap className="h-4 w-4 mr-2" />
                빠른 참가
              </div>
            )}
          </Button>

          {error && <div className="p-2 text-sm text-red-500 bg-red-100 dark:bg-red-900/20 rounded-md">{error}</div>}

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t"></span>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">또는</span>
            </div>
          </div>

          <Tabs defaultValue="join" onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="join">방 참가</TabsTrigger>
              <TabsTrigger value="create">방 생성</TabsTrigger>
            </TabsList>

            <TabsContent value="join">
              <form onSubmit={handleJoinRoom} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="roomId">방 ID</Label>
                  <Input
                    id="roomId"
                    placeholder="참가할 방 ID를 입력하세요"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full">
                  참가하기
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="create">
              <form onSubmit={handleCreateRoom} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="newRoomId">방 ID (선택사항)</Label>
                  <Input
                    id="newRoomId"
                    placeholder="방 ID를 입력하거나 자동 생성"
                    value={newRoomId}
                    onChange={(e) => setNewRoomId(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">비워두면 자동으로 생성됩니다</p>
                </div>
                <Button type="submit" className="w-full">
                  방 생성하기
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col space-y-3">
        <div className="w-full p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md flex items-start">
          <AlertCircle className="h-5 w-5 text-yellow-500 mr-2 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-gray-700 dark:text-yellow-200">
            <p className="font-medium">연결 문제가 있나요?</p>
            <p className="mt-1">
              서버 연결 상태를{" "}
              <Link href="/test" className="text-blue-600 hover:underline dark:text-blue-400">
                테스트
              </Link>
              해보세요.
            </p>
          </div>
        </div>
      </CardFooter>
    </Card>
  )
}

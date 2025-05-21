"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertCircle, WifiOff } from "lucide-react"
import Link from "next/link"

export function LobbyForm() {
  const router = useRouter()
  const [nickname, setNickname] = useState("")
  const [roomId, setRoomId] = useState("")
  const [newRoomId, setNewRoomId] = useState("")
  const [activeTab, setActiveTab] = useState("join")

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

        <Link href="/offline" className="w-full">
          <Button variant="outline" className="w-full flex items-center">
            <WifiOff className="h-4 w-4 mr-2" />
            오프라인 모드로 플레이
          </Button>
        </Link>
      </CardFooter>
    </Card>
  )
}

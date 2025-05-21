"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation"

export default function OfflinePage() {
  const router = useRouter()
  const [playerCount, setPlayerCount] = useState(4)
  const [nickname, setNickname] = useState("")

  const handleStartOfflineGame = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nickname) return

    // Store settings in sessionStorage
    sessionStorage.setItem("nickname", nickname)
    sessionStorage.setItem("isHost", "true")
    sessionStorage.setItem("offlineMode", "true")
    sessionStorage.setItem("playerCount", playerCount.toString())

    // Generate a random room ID with "offline-" prefix
    const roomId = `offline-${Math.random().toString(36).substring(2, 8)}`
    router.push(`/room/${roomId}`)
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 theme-background">
      <div className="max-w-md w-full mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">오프라인 모드</h1>
          <p className="text-muted-foreground">서버 연결 없이 로컬에서 게임을 플레이합니다</p>
        </div>

        <Card className="w-full">
          <CardHeader>
            <CardTitle>오프라인 게임 설정</CardTitle>
            <CardDescription>게임 설정을 조정하고 시작하세요</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleStartOfflineGame} className="space-y-4">
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

              <div className="space-y-2">
                <Label htmlFor="playerCount">플레이어 수 (4-9)</Label>
                <div className="flex items-center space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPlayerCount(Math.max(4, playerCount - 1))}
                  >
                    -
                  </Button>
                  <div className="w-full text-center py-2 bg-secondary rounded-md">{playerCount}</div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPlayerCount(Math.min(9, playerCount + 1))}
                  >
                    +
                  </Button>
                </div>
              </div>

              <div className="pt-2">
                <Button type="submit" className="w-full">
                  오프라인 게임 시작
                </Button>
              </div>
            </form>
          </CardContent>
          <CardFooter>
            <p className="text-xs text-muted-foreground">
              오프라인 모드에서는 AI 플레이어가 실제 플레이어를 대신합니다. 모든 데이터는 브라우저에 저장되며 서버로
              전송되지 않습니다.
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}

"use client"

import type { Socket } from "socket.io-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import type { Player } from "@/types/game"
import { UserIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { parseCharacterFromNickname } from "@/lib/character-list"

interface GameOverProps {
  winner: "mafia" | "citizen" | null
  players: Player[]
  socket: Socket | null
  roomId: string
  isHost: boolean
}

export function GameOver({ winner, players, socket, roomId, isHost }: GameOverProps) {
  const router = useRouter()

  // 디버깅 로그 추가
  console.log("GameOver component received players:", players)
  console.log(
    "Players with roles:",
    players.map((p) => `${p.nickname}: ${p.role}`),
  )

  const handlePlayAgain = () => {
    if (socket) {
      socket.emit("restartGame", { roomId })
    }
  }

  const handleExit = () => {
    sessionStorage.removeItem("nickname")
    sessionStorage.removeItem("isHost")
    router.push("/")
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 theme-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">게임 종료</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <div className="mb-8">
            {winner === "mafia" ? (
              <div className="space-y-4">
                <div className="text-5xl">🕵️</div>
                <div className="text-3xl font-bold text-red-500">마피아 승리!</div>
                <p className="text-muted-foreground">마피아가 시민을 모두 제거했습니다.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-5xl">👨‍🌾</div>
                <div className="text-3xl font-bold text-blue-500">시민 승리!</div>
                <p className="text-muted-foreground">시민들이 모든 마피아를 찾아냈습니다.</p>
              </div>
            )}
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-medium mb-2">플레이어 역할</h3>
            <div className="space-y-2">
              {players.map((player) => {
                const playerDisplay = parseCharacterFromNickname(player.nickname)
                return (
                  <div key={player.id} className="flex items-center justify-between p-2 rounded-md bg-secondary">
                    <div className="flex items-center">
                      {playerDisplay ? (
                        <span className="text-lg mr-2">{playerDisplay.emoji}</span>
                      ) : (
                        <UserIcon className="h-4 w-4 mr-2" />
                      )}
                      <span>{playerDisplay ? playerDisplay.name : player.nickname}</span>
                    </div>
                    <span className={player.role === "mafia" ? "text-red-500" : "text-blue-500"}>
                      {player.role === "mafia" ? "마피아" : "시민"}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          {isHost && (
            <Button className="w-full" onClick={handlePlayAgain}>
              다시 플레이
            </Button>
          )}
          <Button variant="outline" className="w-full" onClick={handleExit}>
            나가기
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

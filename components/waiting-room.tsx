"use client"

import { useState } from "react"
import type { Socket } from "socket.io-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import type { Player } from "@/types/game"
import { UserIcon, CrownIcon, CopyIcon, CheckIcon, Plus, Minus, Bot } from "lucide-react"

interface WaitingRoomProps {
  players: Player[]
  roomId: string
  isHost: boolean
  socket: Socket | null
  isOfflineMode?: boolean
  onStartGame?: () => void
}

export function WaitingRoom({ players, roomId, isHost, socket, isOfflineMode = false, onStartGame }: WaitingRoomProps) {
  const [copied, setCopied] = useState(false)
  const [aiCount, setAiCount] = useState(0)
  const [isAddingAi, setIsAddingAi] = useState(false)
  const [isRemovingAi, setIsRemovingAi] = useState(false)

  const handleStartGame = () => {
    if (isOfflineMode && onStartGame) {
      onStartGame()
    } else if (socket) {
      socket.emit("startGame", { roomId })
    }
  }

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleAddAiPlayer = () => {
    if (!socket || !isHost || players.length >= 9) return

    setIsAddingAi(true)
    socket.emit("addAiPlayer", { roomId }, () => {
      setIsAddingAi(false)
    })

    // 5초 후 로딩 상태 해제 (응답이 없는 경우 대비)
    setTimeout(() => setIsAddingAi(false), 5000)
  }

  const handleRemoveAiPlayer = () => {
    if (!socket || !isHost) return

    // AI 플레이어 수 계산
    const aiPlayers = players.filter((p) => p.isAi || p.nickname.startsWith("AI-"))
    if (aiPlayers.length === 0) return

    setIsRemovingAi(true)
    socket.emit("removeAiPlayer", { roomId }, () => {
      setIsRemovingAi(false)
    })

    // 5초 후 로딩 상태 해제 (응답이 없는 경우 대비)
    setTimeout(() => setIsRemovingAi(false), 5000)
  }

  // AI 플레이어 수 계산
  const aiPlayers = players.filter((p) => p.isAi || p.nickname.startsWith("AI-"))
  const humanPlayers = players.filter((p) => !p.isAi && !p.nickname.startsWith("AI-"))

  const canStartGame = players.length >= 2 && players.length <= 9 && isHost
  const canAddAi = isHost && players.length < 9
  const canRemoveAi = isHost && aiPlayers.length > 0

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 theme-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            대기실
            <Button variant="outline" size="sm" onClick={copyRoomId}>
              {copied ? <CheckIcon className="h-4 w-4 mr-1" /> : <CopyIcon className="h-4 w-4 mr-1" />}
              {copied ? "복사됨" : "방 ID 복사"}
            </Button>
          </CardTitle>
          <CardDescription>방 ID: {roomId}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-medium">참가자 ({players.length}/9)</h3>

                {isHost && (
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAddAiPlayer}
                      disabled={!canAddAi || isAddingAi || isRemovingAi}
                    >
                      {isAddingAi ? (
                        <div className="animate-spin h-4 w-4 border-2 border-current rounded-full border-t-transparent" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRemoveAiPlayer}
                      disabled={!canRemoveAi || isAddingAi || isRemovingAi}
                    >
                      {isRemovingAi ? (
                        <div className="animate-spin h-4 w-4 border-2 border-current rounded-full border-t-transparent" />
                      ) : (
                        <Minus className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                )}
              </div>

              <ul className="space-y-2">
                {players.map((player) => (
                  <li
                    key={player.id}
                    className={`flex items-center p-2 rounded-md bg-secondary ${
                      player.nickname.startsWith("AI-") ? "border-l-4 border-purple-500" : ""
                    }`}
                  >
                    {player.nickname.startsWith("AI-") ? (
                      <Bot className="h-4 w-4 mr-2 text-purple-500" />
                    ) : (
                      <UserIcon className="h-4 w-4 mr-2" />
                    )}
                    <span>{player.nickname}</span>
                    {player.isHost && <CrownIcon className="h-4 w-4 ml-2 text-yellow-500" />}
                  </li>
                ))}
              </ul>
            </div>

            {isHost && (
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-md">
                <h4 className="text-sm font-medium mb-1">AI 플레이어 ({aiPlayers.length}명)</h4>
                <p className="text-xs text-muted-foreground">
                  AI 플레이어를 추가하여 더 많은 인원으로 게임을 즐길 수 있습니다.
                </p>
              </div>
            )}

            <div className="text-sm text-muted-foreground">
              <p>게임 시작 조건: 2~9명의 플레이어</p>
              {players.length < 2 && <p className="text-yellow-500 mt-1">최소 2명의 플레이어가 필요합니다.</p>}
            </div>
          </div>
        </CardContent>
        <CardFooter>
          {isHost ? (
            <Button className="w-full" disabled={!canStartGame} onClick={handleStartGame}>
              게임 시작
            </Button>
          ) : (
            <p className="text-center w-full text-muted-foreground">방장이 게임을 시작할 때까지 기다려주세요</p>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}

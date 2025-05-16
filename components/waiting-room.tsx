"use client"

import { useState } from "react"
import type { Socket } from "socket.io-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import type { Player } from "@/types/game"
import { UserIcon, CrownIcon, CopyIcon, CheckIcon } from "lucide-react"

interface WaitingRoomProps {
  players: Player[]
  roomId: string
  isHost: boolean
  socket: Socket | null
}

export function WaitingRoom({ players, roomId, isHost, socket }: WaitingRoomProps) {
  const [copied, setCopied] = useState(false)

  const handleStartGame = () => {
    if (socket) {
      socket.emit("startGame", { roomId })
    }
  }

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const canStartGame = players.length >= 4 && players.length <= 9 && isHost

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-gradient-to-b from-gray-900 to-black">
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
              <h3 className="text-sm font-medium mb-2">참가자 ({players.length}/9)</h3>
              <ul className="space-y-2">
                {players.map((player) => (
                  <li key={player.id} className="flex items-center p-2 rounded-md bg-secondary">
                    <UserIcon className="h-4 w-4 mr-2" />
                    <span>{player.nickname}</span>
                    {player.isHost && <CrownIcon className="h-4 w-4 ml-2 text-yellow-500" />}
                  </li>
                ))}
              </ul>
            </div>

            <div className="text-sm text-muted-foreground">
              <p>게임 시작 조건: 4~9명의 플레이어</p>
              {players.length < 4 && <p className="text-yellow-500 mt-1">최소 4명의 플레이어가 필요합니다.</p>}
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

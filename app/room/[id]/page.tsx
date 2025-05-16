"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { GameRoom } from "@/components/game-room"
import { WaitingRoom } from "@/components/waiting-room"
import { RoleReveal } from "@/components/role-reveal"
import { GameOver } from "@/components/game-over"
import { useSocket } from "@/hooks/use-socket"
import type { Player, GameState } from "@/types/game"
import { Button } from "@/components/ui/button"
import { AlertCircle, RefreshCw, ArrowLeft } from "lucide-react"

export default function RoomPage() {
  const params = useParams()
  const router = useRouter()
  const roomId = params.id as string
  const [gameState, setGameState] = useState<GameState>("waiting")
  const [players, setPlayers] = useState<Player[]>([])
  const [role, setRole] = useState<"mafia" | "citizen" | null>(null)
  const [winner, setWinner] = useState<"mafia" | "citizen" | null>(null)
  const [day, setDay] = useState(1)
  const [phase, setPhase] = useState<"day" | "night">("day")
  const [isHost, setIsHost] = useState(false)
  const [nickname, setNickname] = useState("")

  const { socket, isConnected, error, connectionDetails } = useSocket(roomId)

  useEffect(() => {
    // Get nickname from sessionStorage
    const storedNickname = sessionStorage.getItem("nickname")
    const storedIsHost = sessionStorage.getItem("isHost") === "true"

    if (!storedNickname) {
      router.push("/")
      return
    }

    setNickname(storedNickname)
    setIsHost(storedIsHost)

    if (socket && isConnected) {
      // Join the room
      socket.emit("joinRoom", { roomId, nickname: storedNickname, isHost: storedIsHost })

      // Listen for player updates
      socket.on("playersUpdate", (updatedPlayers: Player[]) => {
        setPlayers(updatedPlayers)
      })

      // Listen for game state updates
      socket.on(
        "gameStateUpdate",
        (data: {
          state: GameState
          role?: "mafia" | "citizen"
          day?: number
          phase?: "day" | "night"
          winner?: "mafia" | "citizen"
        }) => {
          setGameState(data.state)

          if (data.role) {
            setRole(data.role)
          }

          if (data.day) {
            setDay(data.day)
          }

          if (data.phase) {
            setPhase(data.phase)
          }

          if (data.winner) {
            setWinner(data.winner)
          }
        },
      )
    }

    return () => {
      if (socket) {
        socket.off("playersUpdate")
        socket.off("gameStateUpdate")
      }
    }
  }, [socket, isConnected, roomId, router])

  // Handle disconnection
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (socket) {
        socket.emit("leaveRoom", { roomId, nickname })
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload)

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
      if (socket) {
        socket.emit("leaveRoom", { roomId, nickname })
      }
    }
  }, [socket, roomId, nickname])

  const handleRefresh = () => {
    window.location.reload()
  }

  const handleGoBack = () => {
    router.push("/")
  }

  if (!isConnected) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-gradient-to-b from-gray-900 to-black">
        <div className="text-center space-y-4 max-w-md w-full">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-xl">서버에 연결 중...</p>

          {error && (
            <div className="text-red-500 mx-auto mt-6 p-6 bg-red-500/10 rounded-lg border border-red-500/20">
              <AlertCircle className="h-8 w-8 mx-auto mb-2" />
              <p className="font-bold text-lg mb-2">연결 오류</p>
              <p className="whitespace-pre-line mb-4">{error}</p>

              <div className="bg-black/30 p-4 rounded-md text-left text-xs font-mono mb-6 overflow-auto max-h-32">
                <p>서버 URL: {connectionDetails.url}</p>
                <p>연결 시도: {connectionDetails.attempts}/5</p>
                <p>브라우저: {navigator.userAgent}</p>
              </div>

              <p className="text-sm mb-6">
                이 오류는 다음과 같은 이유로 발생할 수 있습니다:
                <br />- 서버가 실행 중이지 않음
                <br />- 네트워크 연결 문제
                <br />- CORS 설정 문제
                <br />- 방화벽 또는 보안 설정
              </p>

              <div className="flex flex-col space-y-2">
                <Button onClick={handleRefresh} className="w-full">
                  <RefreshCw className="h-4 w-4 mr-2" /> 새로고침
                </Button>
                <Button variant="outline" onClick={handleGoBack} className="w-full">
                  <ArrowLeft className="h-4 w-4 mr-2" /> 메인으로 돌아가기
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (gameState === "waiting") {
    return <WaitingRoom players={players} roomId={roomId} isHost={isHost} socket={socket} />
  }

  if (gameState === "roleReveal") {
    return <RoleReveal role={role} />
  }

  if (gameState === "playing") {
    return (
      <GameRoom
        players={players}
        role={role}
        day={day}
        phase={phase}
        socket={socket}
        roomId={roomId}
        nickname={nickname}
      />
    )
  }

  if (gameState === "gameOver") {
    return <GameOver winner={winner} players={players} socket={socket} roomId={roomId} isHost={isHost} />
  }

  return null
}

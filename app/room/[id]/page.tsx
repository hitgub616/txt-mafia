"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { GameRoom } from "@/components/game-room"
import { WaitingRoom } from "@/components/waiting-room"
import { RoleReveal } from "@/components/role-reveal"
import { GameOver } from "@/components/game-over"
import { useSocket } from "@/hooks/use-socket"
import { useOfflineGame } from "@/hooks/use-offline-game"
import type { Player, GameState } from "@/types/game"
import { Button } from "@/components/ui/button"
import { AlertCircle, RefreshCw, ArrowLeft } from "lucide-react"
import { FallbackNotice } from "@/components/fallback-notice"

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
  const [isOfflineMode, setIsOfflineMode] = useState(false)
  const [playerCount, setPlayerCount] = useState(4)
  const [hasJoined, setHasJoined] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)

  // Check if we're in offline mode
  useEffect(() => {
    const offlineMode = roomId.startsWith("offline-") || sessionStorage.getItem("offlineMode") === "true"
    setIsOfflineMode(offlineMode)

    if (offlineMode) {
      const storedPlayerCount = Number.parseInt(sessionStorage.getItem("playerCount") || "4")
      setPlayerCount(storedPlayerCount)
    }
  }, [roomId])

  // Get socket connection (will be bypassed in offline mode)
  const { socket, isConnected, error } = useSocket(roomId)

  // Get offline game logic if in offline mode
  const offlineGame = useOfflineGame(roomId, nickname, playerCount)

  // 초기화 및 닉네임 설정
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
    setIsInitialized(true)

    // If in offline mode, use offline game state
    if (isOfflineMode) {
      setGameState(offlineGame.gameState)
      setPlayers(offlineGame.players)
      setRole(offlineGame.role)
      setWinner(offlineGame.winner)
      setDay(offlineGame.day)
      setPhase(offlineGame.phase)
    }
  }, [router, isOfflineMode, offlineGame])

  // 소켓 연결 및 방 참가 로직
  useEffect(() => {
    if (!isInitialized || isOfflineMode || !socket || !isConnected || !nickname) return

    // 방에 아직 참가하지 않았다면 참가 요청
    if (!hasJoined) {
      console.log(`Joining room ${roomId} as ${nickname}, isHost: ${isHost}`)

      // 호스트인 경우 로컬에서 플레이어 목록 초기화
      if (isHost) {
        const hostPlayer: Player = {
          id: "local-id", // 소켓 연결 전이므로 임시 ID 사용
          nickname: nickname,
          isHost: true,
          role: null,
          isAlive: true,
          vote: null,
        }
        setPlayers([hostPlayer]) // 호스트를 플레이어 목록에 즉시 추가
      }

      // 서버에 참가 요청
      socket.emit("joinRoom", { roomId, nickname, isHost })
      setHasJoined(true)
    }

    // 플레이어 목록 업데이트 이벤트 리스너
    const handlePlayersUpdate = (updatedPlayers: Player[]) => {
      console.log("Received players update:", updatedPlayers)
      setPlayers(updatedPlayers)
    }

    // 게임 상태 업데이트 이벤트 리스너
    const handleGameStateUpdate = (data: {
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
    }

    // 이벤트 리스너 등록
    socket.on("playersUpdate", handlePlayersUpdate)
    socket.on("gameStateUpdate", handleGameStateUpdate)

    // 컴포넌트 언마운트 시 이벤트 리스너 제거
    return () => {
      socket.off("playersUpdate", handlePlayersUpdate)
      socket.off("gameStateUpdate", handleGameStateUpdate)
    }
  }, [socket, isConnected, roomId, nickname, isHost, isOfflineMode, hasJoined, isInitialized])

  // Handle disconnection
  useEffect(() => {
    if (isOfflineMode) return // Skip for offline mode

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
  }, [socket, roomId, nickname, isOfflineMode])

  const handleRefresh = () => {
    window.location.reload()
  }

  const handleGoBack = () => {
    router.push("/")
  }

  // Show loading state for online mode
  if (!isOfflineMode && !isConnected) {
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

  // Render appropriate component based on game state
  if (gameState === "waiting") {
    return (
      <>
        {isOfflineMode && <FallbackNotice />}
        <WaitingRoom
          players={isOfflineMode ? offlineGame.players : players}
          roomId={roomId}
          isHost={isHost}
          socket={socket}
          isOfflineMode={isOfflineMode}
          onStartGame={isOfflineMode ? offlineGame.startGame : undefined}
        />
      </>
    )
  }

  if (gameState === "roleReveal") {
    return <RoleReveal role={isOfflineMode ? offlineGame.role : role} />
  }

  if (gameState === "playing") {
    return (
      <>
        {isOfflineMode && <FallbackNotice />}
        <GameRoom
          players={isOfflineMode ? offlineGame.players : players}
          role={isOfflineMode ? offlineGame.role : role}
          day={isOfflineMode ? offlineGame.day : day}
          phase={isOfflineMode ? offlineGame.phase : phase}
          socket={socket}
          roomId={roomId}
          nickname={nickname}
          isOfflineMode={isOfflineMode}
          offlineGame={isOfflineMode ? offlineGame : undefined}
        />
      </>
    )
  }

  if (gameState === "gameOver") {
    return (
      <>
        {isOfflineMode && <FallbackNotice />}
        <GameOver
          winner={isOfflineMode ? offlineGame.winner : winner}
          players={isOfflineMode ? offlineGame.players : players}
          socket={socket}
          roomId={roomId}
          isHost={isHost}
          isOfflineMode={isOfflineMode}
          onRestartGame={isOfflineMode ? offlineGame.restartGame : undefined}
        />
      </>
    )
  }

  return null
}

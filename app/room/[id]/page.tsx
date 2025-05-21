"use client"

import { useEffect, useState, useCallback, useRef } from "react"
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
import { useTheme } from "next-themes"

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
  const [timeLeft, setTimeLeft] = useState(0)

  const eventListenersSetupRef = useRef(false)

  const { setTheme } = useTheme()

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
      setTimeLeft(offlineGame.timeLeft)
    }
  }, [router, isOfflineMode, offlineGame])

  // 플레이어 목록 업데이트 핸들러
  const handlePlayersUpdate = useCallback((updatedPlayers: Player[]) => {
    console.log("Received players update:", updatedPlayers)
    setPlayers(updatedPlayers)
  }, [])

  // 게임 상태 업데이트 핸들러
  const handleGameStateUpdate = useCallback(
    (data: {
      state: GameState
      role?: "mafia" | "citizen"
      day?: number
      phase?: "day" | "night"
      winner?: "mafia" | "citizen"
    }) => {
      console.log("Received game state update:", data)
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
    [],
  )

  // 페이즈 변경 핸들러
  const handlePhaseChange = useCallback((data: { phase: "day" | "night"; day: number; timeLeft: number }) => {
    console.log("Received phase change:", data)
    setPhase(data.phase)
    setDay(data.day)
    setTimeLeft(data.timeLeft)
  }, [])

  // 시간 업데이트 핸들러
  const handleTimeUpdate = useCallback((time: number) => {
    console.log("Received time update:", time)
    setTimeLeft(time)
  }, [])

  // 소켓 연결 및 방 참가 로직
  useEffect(() => {
    if (!isInitialized || isOfflineMode || !socket || !isConnected || !nickname) return

    // 방에 아직 참가하지 않았다면 참가 요청
    if (!hasJoined) {
      console.log(`Joining room ${roomId} as ${nickname}, isHost: ${isHost}`)
      socket.emit("joinRoom", { roomId, nickname, isHost })
      setHasJoined(true)
    }

    return () => {
      // 이 useEffect에서는 이벤트 리스너를 등록하지 않으므로 정리 함수는 비어있음
    }
  }, [socket, isConnected, roomId, nickname, isHost, isOfflineMode, hasJoined, isInitialized])

  // 이벤트 리스너 설정 (한 번만 실행)
  useEffect(() => {
    if (isOfflineMode || !socket || !isConnected || eventListenersSetupRef.current) return

    console.log("Setting up event listeners")

    // 이벤트 리스너 등록
    socket.on("playersUpdate", handlePlayersUpdate)
    socket.on("gameStateUpdate", handleGameStateUpdate)
    socket.on("phaseChange", handlePhaseChange)
    socket.on("timeUpdate", handleTimeUpdate)
    socket.on("systemMessage", (message: string) => {
      console.log("System message:", message)
    })

    eventListenersSetupRef.current = true

    // 컴포넌트 언마운트 시 이벤트 리스너 제거
    return () => {
      console.log("Cleaning up event listeners")
      socket.off("playersUpdate", handlePlayersUpdate)
      socket.off("gameStateUpdate", handleGameStateUpdate)
      socket.off("phaseChange", handlePhaseChange)
      socket.off("timeUpdate", handleTimeUpdate)
      socket.off("systemMessage")
      eventListenersSetupRef.current = false
    }
  }, [
    socket,
    isConnected,
    isOfflineMode,
    handlePlayersUpdate,
    handleGameStateUpdate,
    handlePhaseChange,
    handleTimeUpdate,
  ])

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

  // 게임 페이즈 또는 게임 상태에 따른 테마 변경
  useEffect(() => {
    if (isOfflineMode) {
      // 오프라인 모드에서는 offlineGame의 phase를 따름
      if (offlineGame.phase === "night") {
        setTheme("dark")
      } else {
        setTheme("light")
      }
      if (offlineGame.gameState === "gameOver" || offlineGame.gameState === "waiting") {
        setTheme("light")
      }
      return
    }

    // 온라인 모드
    if (gameState === "playing") {
      if (phase === "night") {
        setTheme("dark")
      } else {
        setTheme("light")
      }
    } else if (gameState === "gameOver" || gameState === "waiting") {
      setTheme("light")
    }
  }, [gameState, phase, isOfflineMode, offlineGame?.phase, offlineGame?.gameState, setTheme])

  const handleRefresh = () => {
    window.location.reload()
  }

  const handleGoBack = () => {
    router.push("/")
  }

  // Show loading state for online mode
  if (!isOfflineMode && !isConnected) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4 theme-background">
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
          timeLeft={isOfflineMode ? offlineGame.timeLeft : timeLeft}
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

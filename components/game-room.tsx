"use client"

import type React from "react"

import { useState, useEffect, useRef, useCallback } from "react"
import type { Socket } from "socket.io-client"
import type { Player, VoteResult, DaySubPhase, NominationResult } from "@/types/game"
import type { ChatMessage } from "@/types/chat"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MoonIcon, SunIcon, SendIcon, LogOut, Clock, Info, Ghost, Skull } from "lucide-react"
import { useRouter } from "next/navigation"
import { NominationVoteModal } from "./nomination-vote-modal"
import { ExecutionVoteModal } from "./execution-vote-modal"
import { VoteResultPopup } from "./vote-result-popup"
import { NominationResultModal } from "./nomination-result-modal"
import { PhaseTransitionModal } from "./phase-transition-modal"
import { MafiaTargetModal } from "./mafia-target-modal"
import { parseCharacterFromNickname } from "@/lib/character-list"

interface GameRoomProps {
  players: Player[]
  role: "mafia" | "citizen" | null
  day: number
  phase: "day" | "night"
  subPhase?: DaySubPhase | null
  socket: Socket | null
  roomId: string
  nickname: string
  isOfflineMode?: boolean
  offlineGame?: any
  timeLeft?: number
  nominatedPlayer?: string | null
  voteResult?: VoteResult | null
}

export function GameRoom({
  players,
  role,
  day,
  phase,
  subPhase,
  socket,
  roomId,
  nickname,
  isOfflineMode = false,
  offlineGame,
  timeLeft = 0,
  nominatedPlayer,
  voteResult,
}: GameRoomProps) {
  const router = useRouter()
  const [message, setMessage] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [nominationVotes, setNominationVotes] = useState<Record<string, number>>({})
  const [executionVotes, setExecutionVotes] = useState<{ yes: number; no: number }>({ yes: 0, no: 0 })
  const [mafiaTarget, setMafiaTarget] = useState<string | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const [localTimeLeft, setLocalTimeLeft] = useState<number>(timeLeft)
  const [isTimerCritical, setIsTimerCritical] = useState(false)

  // 모달 상태
  const [showNominationModal, setShowNominationModal] = useState(false)
  const [showExecutionModal, setShowExecutionModal] = useState(false)
  const [showVoteResultPopup, setShowVoteResultPopup] = useState(false)
  const [showNominationResultModal, setShowNominationResultModal] = useState(false)
  const [showPhaseTransitionModal, setShowPhaseTransitionModal] = useState(false)
  const [showMafiaTargetModal, setShowMafiaTargetModal] = useState(false)
  const [showDeadPlayerModal, setShowDeadPlayerModal] = useState(false) // 사망자 모달 상태 추가
  const [localVoteResult, setLocalVoteResult] = useState<VoteResult | null>(null)
  const [nominationResult, setNominationResult] = useState<NominationResult | null>(null)
  const [phaseTransitionInfo, setPhaseTransitionInfo] = useState<{
    type: "dayStart" | "nightStart"
    message: string
  } | null>(null)

  // 페이즈 변경 애니메이션을 위한 상태 추가
  const [phaseChangeAnimation, setPhaseChangeAnimation] = useState(false)

  const [phaseState, setPhase] = useState(phase)
  const [subPhaseState, setSubPhase] = useState(subPhase)
  const [dayState, setDay] = useState(day)
  const [timeLeftState, setTimeLeft] = useState(timeLeft)
  const [nominatedPlayerState, setNominatedPlayer] = useState(nominatedPlayer)
  const [voteResultState, setVoteResult] = useState(voteResult)
  const [prevPhase, setPrevPhase] = useState<string | null>(null)
  const [prevSubPhase, setPrevSubPhase] = useState<string | null>(null)

  const currentPlayer = players.find((p) => p.nickname === nickname) || {
    id: "",
    nickname,
    isHost: false,
    role: null,
    isAlive: true,
    vote: null,
    nominationVote: null,
    executionVote: null,
  }

  const isAlive = currentPlayer?.isAlive ?? true
  const isMafia = role === "mafia"

  // 사망자 모달 표시 로직 추가
  useEffect(() => {
    if (!isAlive && !showDeadPlayerModal) {
      setShowDeadPlayerModal(true)

      // 5초 후 자동으로 닫기
      const timer = setTimeout(() => {
        setShowDeadPlayerModal(false)
      }, 5000)

      return () => clearTimeout(timer)
    }
  }, [isAlive, showDeadPlayerModal])

  // 채팅 가능 조건 수정 - 더 정확한 로직 적용
  const canChat = (() => {
    // 사망한 플레이어는 채팅 불가
    if (!isAlive) {
      console.log(`[Chat] ${nickname} cannot chat: DEAD`)
      return false
    }

    // 밤 페이즈
    if (phaseState === "night") {
      // 마피아만 채팅 가능
      const canChatAtNight = isMafia
      console.log(`[Chat] ${nickname} night chat: ${canChatAtNight ? "ALLOWED (Mafia)" : "BLOCKED (Not Mafia)"}`)
      return canChatAtNight
    }

    // 낮 페이즈
    if (phaseState === "day") {
      // 최후 변론 단계에서는 지목된 플레이어만 채팅 가능
      if (subPhaseState === "defense") {
        const canChatInDefense = nickname === nominatedPlayerState
        console.log(
          `[Chat] ${nickname} defense chat: ${canChatInDefense ? "ALLOWED (Nominated)" : "BLOCKED (Not Nominated)"}`,
        )
        return canChatInDefense
      }

      // 다른 낮 단계에서는 모든 살아있는 플레이어가 채팅 가능
      console.log(`[Chat] ${nickname} day chat: ALLOWED`)
      return true
    }

    console.log(`[Chat] ${nickname} unknown phase: BLOCKED`)
    return false
  })()

  // Get alive players
  const alivePlayers = players.filter((p) => p.isAlive)

  // Get mafia players (only visible to mafia)
  const mafiaPlayers = isMafia ? players.filter((p) => p.role === "mafia" && p.isAlive) : []

  // 페이즈 변경 핸들러 수정 (handlePhaseChange 함수 내부에 추가)
  const handlePhaseChange = useCallback(
    (data: {
      phase: "day" | "night"
      subPhase?: DaySubPhase | null
      day: number
      timeLeft: number
      nominatedPlayer?: string | null
      voteResult?: VoteResult | null
      transitionType?: "dayStart" | "nightStart"
      message?: string
    }) => {
      console.log("Received phase change:", data)

      // 이전 상태 저장
      setPrevPhase(phaseState)
      setPrevSubPhase(subPhaseState)

      // 페이즈 변경 애니메이션 트리거
      if (data.phase !== phaseState || data.subPhase !== subPhaseState) {
        setPhaseChangeAnimation(true)
        setTimeout(() => {
          setPhaseChangeAnimation(false)
        }, 1000)
      }

      // 페이즈 전환 모달 표시 (낮/밤 전환 시)
      if (data.transitionType && data.message) {
        setPhaseTransitionInfo({
          type: data.transitionType,
          message: data.message,
        })
        setShowPhaseTransitionModal(true)
      }

      setPhase(data.phase)
      setSubPhase(data.subPhase || null)
      setDay(data.day)
      setTimeLeft(data.timeLeft)

      if (data.nominatedPlayer !== undefined) {
        setNominatedPlayer(data.nominatedPlayer)
      }

      if (data.voteResult) {
        setVoteResult(data.voteResult)
      }
    },
    [phaseState, subPhaseState],
  )

  // 페이즈 변경 시 토스트 알림 제거 (요청에 따라 모든 toast 호출 제거)
  useEffect(() => {
    // 페이즈나 서브페이즈가 변경되었을 때만 실행
    if ((prevPhase !== null && prevPhase !== phaseState) || (prevSubPhase !== null && prevSubPhase !== subPhaseState)) {
      // 마피아인 경우 타겟 선택 모달 표시 (timeLeft가 0보다 클 때만)
      if (phaseState === "night" && prevPhase === "day" && isMafia && isAlive && localTimeLeft > 0) {
        console.log(`마피아 타겟 모달 표시, 남은 시간: ${localTimeLeft}초`)
        setShowMafiaTargetModal(true)
      }
    }
  }, [
    phaseState,
    subPhaseState,
    prevPhase,
    prevSubPhase,
    dayState,
    isMafia,
    nickname,
    nominatedPlayerState,
    isAlive,
    localTimeLeft,
  ])

  // 서브페이즈 변경 감지 및 모달 표시
  useEffect(() => {
    if (phaseState === "day") {
      // 사망자는 모달을 볼 수 없음
      if (!isAlive) {
        setShowNominationModal(false)
        setShowExecutionModal(false)
        return
      }

      // 지목 단계에서 모달 표시 (timeLeft가 0보다 클 때만)
      if (subPhaseState === "nomination" && localTimeLeft > 0) {
        console.log(`지목 모달 표시, 남은 시간: ${localTimeLeft}초`)
        setShowNominationModal(true)
      } else if (subPhaseState !== "nomination") {
        setShowNominationModal(false)
      }

      // 처형 투표 단계에서 모달 표시 (timeLeft가 0보다 클 때만)
      if (subPhaseState === "execution" && localTimeLeft > 0) {
        console.log(`처형 투표 모달 표시, 남은 시간: ${localTimeLeft}초`)
        setShowExecutionModal(true)
      } else if (subPhaseState !== "execution") {
        setShowExecutionModal(false)
      }

      // 결과 단계에서 결과 팝업 표시
      if (subPhaseState === "result" && voteResultState) {
        setLocalVoteResult(voteResultState)
        setShowVoteResultPopup(true)
      } else {
        setShowVoteResultPopup(false)
      }
    }
  }, [phaseState, subPhaseState, isAlive, voteResultState, localTimeLeft])

  useEffect(() => {
    // 서버에서 받은 timeLeft 값으로 localTimeLeft 업데이트
    console.log(`서버에서 받은 timeLeft: ${timeLeft}, 현재 localTimeLeft: ${localTimeLeft}`)

    // timeLeft가 유효한 값일 때만 업데이트
    if (typeof timeLeft === "number" && timeLeft >= 0) {
      setLocalTimeLeft(timeLeft)

      // 타이머가 5초 이하로 남았을 때 임계값 상태 설정
      setIsTimerCritical(timeLeft <= 5 && timeLeft > 0)

      // 디버깅 로그
      console.log(`localTimeLeft 업데이트됨: ${timeLeft}초`)
    }
  }, [timeLeft])

  useEffect(() => {
    if (isOfflineMode && offlineGame) {
      // Use offline game state
      setMessages(offlineGame.messages)
      return
    }

    if (socket) {
      const handleChatMessage = (message: ChatMessage) => {
        setMessages((prev) => [...prev, message])
      }

      const handleSystemMessage = (message: string) => {
        setMessages((prev) => [
          ...prev,
          {
            sender: "시스템",
            content: message,
            timestamp: new Date().toISOString(),
            isSystem: true,
          },
        ])
      }

      const handleNominationVoteUpdate = (votes: Record<string, number>) => {
        setNominationVotes(votes)
      }

      const handleExecutionVoteUpdate = (votes: { yes: number; no: number }) => {
        setExecutionVotes(votes)
      }

      const handleNominationVoteResult = (result: NominationResult) => {
        console.log("Received nomination vote result:", result)
        setNominationResult(result)
        setShowNominationResultModal(true)
      }

      // 이벤트 리스너 등록
      socket.on("chatMessage", handleChatMessage)
      socket.on("systemMessage", handleSystemMessage)
      socket.on("nominationVoteUpdate", handleNominationVoteUpdate)
      socket.on("executionVoteUpdate", handleExecutionVoteUpdate)
      socket.on("phaseChange", handlePhaseChange)
      socket.on("nominationVoteResult", handleNominationVoteResult)

      return () => {
        // 이벤트 리스너 제거
        socket.off("chatMessage", handleChatMessage)
        socket.off("systemMessage", handleSystemMessage)
        socket.off("nominationVoteUpdate", handleNominationVoteUpdate)
        socket.off("executionVoteUpdate", handleExecutionVoteUpdate)
        socket.off("phaseChange", handlePhaseChange)
        socket.off("nominationVoteResult", handleNominationVoteResult)
      }
    }
  }, [socket, isOfflineMode, offlineGame, phaseState, subPhaseState, handlePhaseChange])

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // 타이머 표시용 로컬 카운트다운
  useEffect(() => {
    if (localTimeLeft <= 0) return

    const timer = setInterval(() => {
      setLocalTimeLeft((prev) => {
        const newTime = Math.max(0, prev - 1)
        // 타이머가 5초 이하로 남았을 때 임계값 상태 설정
        setIsTimerCritical(newTime <= 5 && newTime > 0)
        return newTime
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [localTimeLeft])

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim() || !canChat) {
      console.log(`[Chat] ${nickname} message blocked: canChat=${canChat}, message="${message.trim()}"`)
      return
    }

    console.log(`[Chat] ${nickname} sending message: "${message}" (mafia: ${phaseState === "night" && isMafia})`)

    if (isOfflineMode && offlineGame) {
      offlineGame.sendMessage(message, phaseState === "night" && isMafia)
    } else if (socket) {
      socket.emit("sendMessage", {
        roomId,
        sender: nickname,
        content: message,
        isMafiaChat: phaseState === "night" && isMafia,
      })
    }

    setMessage("")
  }

  const handleNominationVote = (target: string | null) => {
    if (!socket || !isAlive) return

    socket.emit("submitNominationVote", {
      roomId,
      target,
    })
  }

  const handleExecutionVote = (vote: "yes" | "no" | null) => {
    if (!socket || !isAlive) return

    socket.emit("submitExecutionVote", {
      roomId,
      vote,
    })
  }

  const handleMafiaTarget = (targetNickname: string | null) => {
    if (!isMafia || !isAlive) return

    if (isOfflineMode && offlineGame) {
      offlineGame.handleMafiaTarget(targetNickname)
      setMafiaTarget(targetNickname)
    } else if (socket) {
      socket.emit("mafiaTarget", {
        roomId,
        target: targetNickname,
      })
      setMafiaTarget(targetNickname)
    }

    // 타겟 선택 후 모달 닫기
    setShowMafiaTargetModal(false)
  }

  const handleLeaveRoom = () => {
    if (isOfflineMode) {
      // 오프라인 모드에서는 세션 스토리지 정리 후 홈으로 이동
      sessionStorage.removeItem("nickname")
      sessionStorage.removeItem("isHost")
      sessionStorage.removeItem("offlineMode")
      sessionStorage.removeItem("playerCount")
      router.push("/")
    } else if (socket) {
      // 서버에 방 나가기 이벤트 전송
      socket.emit("leaveRoom", { roomId, nickname })

      // 세션 스토리지 정리 후 홈으로 이동
      sessionStorage.removeItem("nickname")
      sessionStorage.removeItem("isHost")
      router.push("/")
    }
  }

  // 연속된 메시지 그룹화를 위한 함수
  const groupMessages = (messages: ChatMessage[]) => {
    const filteredMessages = messages.filter((msg) => {
      if (msg.isSystem) return true
      if (phase === "day") return !msg.isMafiaChat
      if (phase === "night" && isMafia) return msg.isMafiaChat
      return false
    })

    const groupedMessages: { messages: ChatMessage[]; sender: string; isSystem: boolean; timestamp: string }[] = []

    filteredMessages.forEach((msg, index) => {
      // 시스템 메시지는 항상 별도 그룹
      if (msg.isSystem) {
        groupedMessages.push({ messages: [msg], sender: msg.sender, isSystem: true, timestamp: msg.timestamp })
        return
      }

      // 이전 그룹이 없거나, 이전 그룹이 시스템 메시지이거나, 발신자가 다르면 새 그룹 생성
      if (index === 0 || filteredMessages[index - 1].isSystem || filteredMessages[index - 1].sender !== msg.sender) {
        groupedMessages.push({ messages: [msg], sender: msg.sender, isSystem: false, timestamp: msg.timestamp })
      } else {
        // 이전 메시지와 같은 발신자면 기존 그룹에 추가
        groupedMessages[groupedMessages.length - 1].messages.push(msg)
      }
    })

    return groupedMessages
  }

  // 현재 페이즈에 대한 설명 텍스트
  const getPhaseDescription = () => {
    if (phaseState === "night") {
      return isMafia
        ? "밤이 되었습니다. 제거할 대상을 선택하세요."
        : "밤이 되었습니다. 마피아의 행동을 기다리는 중입니다."
    }

    if (phaseState === "day") {
      switch (subPhaseState) {
        case "discussion":
          return `${dayState}일차 낮이 시작되었습니다. 자유롭게 토론하세요.`
        case "nomination":
          return "의심되는 플레이어를 지목해주세요."
        case "defense":
          return nominatedPlayerState === nickname
            ? "당신이 지목되었습니다. 최후 변론을 하세요."
            : `${nominatedPlayerState}님의 최후 변론 시간입니다.`
        case "execution":
          return `${nominatedPlayerState}님을 처형할지 투표해주세요.`
        case "result":
          return "투표 결과를 확인하세요."
        default:
          return `${dayState}일차 낮입니다.`
      }
    }

    return ""
  }

  // 채팅 입력창 플레이스홀더 텍스트 개선
  const getChatPlaceholder = () => {
    if (!isAlive) {
      return "사망한 플레이어는 채팅할 수 없습니다"
    }

    if (phaseState === "night") {
      if (isMafia) {
        return "마피아 채팅을 입력하세요"
      } else {
        return "밤에는 채팅할 수 없습니다"
      }
    }

    if (phaseState === "day") {
      if (subPhaseState === "defense") {
        if (nickname === nominatedPlayerState) {
          return "최후 변론을 입력하세요"
        } else {
          return "최후 변론 중에는 지목된 플레이어만 발언할 수 있습니다"
        }
      }
      return "메시지를 입력하세요"
    }

    return "메시지를 입력하세요"
  }

  // 사망자 메시지 표시 함수 개선 - 5초 후 자동 닫기 추가
  const renderDeadPlayerMessage = () => {
    if (isAlive || !showDeadPlayerModal) return null

    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-40 p-4">
        <div className="bg-red-900/50 p-6 rounded-lg max-w-md text-center border border-red-500/30">
          <Skull className="h-16 w-16 mx-auto mb-4 text-red-500" />
          <h2 className="text-2xl font-bold mb-2 text-white">당신은 사망했습니다</h2>
          <p className="text-gray-300 mb-4">더 이상 게임에 참여할 수 없지만, 게임이 끝날 때까지 관전할 수 있습니다.</p>
          <div className="text-sm text-gray-400">
            사망한 플레이어는 채팅, 투표 등 게임의 어떤 기능도 이용할 수 없습니다.
          </div>
          <Button
            variant="outline"
            size="sm"
            className="mt-4 text-white border-white/30 hover:bg-white/10"
            onClick={() => setShowDeadPlayerModal(false)}
          >
            확인
          </Button>
        </div>
      </div>
    )
  }

  // 의심 지목 결과 모달 표시 로직 개선
  useEffect(() => {
    if (nominationResult) {
      setShowNominationResultModal(true)

      // 결과 모달이 표시된 후 6초 후에 자동으로 닫히도록 설정
      const timer = setTimeout(() => {
        setShowNominationResultModal(false)
        setNominationResult(null)
      }, 6000)

      return () => clearTimeout(timer)
    }
  }, [nominationResult])

  // 캐릭터 정보 파싱 함수
  const getPlayerDisplay = (player: Player) => {
    const character = parseCharacterFromNickname(player.nickname)
    if (character) {
      return {
        emoji: character.emoji,
        name: character.name,
        fullName: player.nickname,
      }
    }
    return {
      emoji: "👤",
      name: player.nickname,
      fullName: player.nickname,
    }
  }

  return (
    <div className="flex min-h-screen flex-col theme-background relative">
      {/* 고정 타이머 - 화면 상단 우측에 고정 */}
      <div className="fixed top-4 right-4 z-30">
        <div
          className={`flex items-center px-4 py-3 rounded-xl shadow-lg backdrop-blur-sm border-2 transition-all duration-300 ${
            isTimerCritical
              ? "bg-red-500/90 border-red-400 text-white animate-pulse scale-110"
              : phaseState === "night"
                ? "bg-blue-900/90 border-blue-600 text-blue-100"
                : "bg-yellow-500/90 border-yellow-400 text-yellow-900"
          }`}
        >
          <Clock className={`h-6 w-6 mr-2 ${isTimerCritical ? "text-white animate-spin" : ""}`} />
          <div className="flex flex-col items-center">
            <span className={`font-mono text-xl font-bold ${isTimerCritical ? "text-white" : ""}`}>
              {Math.floor(localTimeLeft / 60)}:{(localTimeLeft % 60).toString().padStart(2, "0")}
            </span>
            <span className={`text-xs ${isTimerCritical ? "text-red-100" : "opacity-80"}`}>
              {phaseState === "day" ? "낮" : "밤"} {dayState}일차
            </span>
          </div>
        </div>
      </div>

      {/* 데스크톱 레이아웃 (md 이상) */}
      <div className="hidden md:grid md:grid-cols-3 gap-4 h-full p-4">
        {/* Game info and player list */}
        <div className="md:col-span-1 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  {phaseState === "day" ? (
                    <SunIcon className="h-5 w-5 mr-2 text-yellow-500" />
                  ) : (
                    <MoonIcon className="h-5 w-5 mr-2 text-blue-500" />
                  )}
                  <span className="font-bold">
                    {dayState}일차 {phaseState === "day" ? "낮" : "밤"}
                    {subPhaseState &&
                      phaseState === "day" &&
                      ` (${
                        subPhaseState === "discussion"
                          ? "토론"
                          : subPhaseState === "nomination"
                            ? "지목"
                            : subPhaseState === "defense"
                              ? "변론"
                              : subPhaseState === "execution"
                                ? "투표"
                                : "결과"
                      })`}
                  </span>
                </div>
              </div>

              {/* 페이즈 설명 */}
              <div
                className={`mt-2 p-2 bg-secondary/50 rounded-md text-sm ${phaseChangeAnimation ? "pulse-vote" : ""}`}
              >
                {getPhaseDescription()}
              </div>

              {/* 내 역할 표시 */}
              <div className="mt-2 p-2 bg-secondary/50 rounded-md text-sm">
                <span className="font-medium">내 역할: </span>
                <span className={role === "mafia" ? "text-red-500 font-bold" : "text-blue-500 font-bold"}>
                  {role === "mafia" ? "마피아" : "시민"}
                </span>
                {!isAlive && <span className="ml-2 text-red-500">(사망)</span>}
              </div>

              {/* 방 나가기 버튼 */}
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-2 text-red-500 hover:bg-red-500/10"
                onClick={handleLeaveRoom}
              >
                <LogOut className="h-4 w-4 mr-2" />방 나가기
              </Button>
            </CardHeader>
            <CardContent>
              <h3 className="text-sm font-medium mb-2">
                생존자 ({alivePlayers.length}/{players.length})
              </h3>
              {/* 플레이어 목록 렌더링 부분 수정 - 높이 조정 및 간격 개선 */}
              <div className="space-y-1.5">
                {players.map((player) => {
                  const playerDisplay = getPlayerDisplay(player)
                  return (
                    <div
                      key={player.id}
                      className={`flex items-center justify-between p-2 rounded-md min-h-[3rem] ${
                        player.isAlive
                          ? "bg-secondary"
                          : "bg-gray-200 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 border border-gray-300/20 grayscale opacity-70"
                      } ${player.nickname === nickname ? "border border-primary/50" : ""}`}
                    >
                      <div className="flex items-center">
                        {/* 사망자 아이콘 및 스타일 개선 */}
                        {player.isAlive ? (
                          <span className="text-lg mr-2">{playerDisplay.emoji}</span>
                        ) : (
                          <div className="flex items-center">
                            <Ghost className="h-4 w-4 mr-1 text-red-400" />
                            <Skull className="h-4 w-4 mr-2 text-red-500" />
                          </div>
                        )}
                        <div className={`flex flex-col ${!player.isAlive ? "opacity-70" : ""}`}>
                          <span className={player.isAlive ? "" : "line-through text-red-400"}>
                            {playerDisplay.name}
                            {player.nickname === nickname && <span className="ml-2 text-xs">(나)</span>}
                          </span>
                          {!player.isAlive && (
                            <span className="text-xs text-red-500 dark:text-red-400 font-bold">사망</span>
                          )}
                        </div>
                        {isMafia && player.role === "mafia" && (
                          <span className="ml-2 text-xs text-red-500">(마피아)</span>
                        )}
                      </div>

                      {/* 마피아 타겟 선택 버튼 (밤 페이즈, 마피아만, 살아있는 경우만) */}
                      {phaseState === "night" && isMafia && isAlive && player.isAlive && player.role !== "mafia" && (
                        <Button
                          variant={mafiaTarget === player.nickname ? "destructive" : "outline"}
                          size="sm"
                          onClick={() => handleMafiaTarget(player.nickname)}
                          className={mafiaTarget === player.nickname ? "pulse-vote" : "vote-highlight"}
                        >
                          {mafiaTarget === player.nickname ? "선택됨" : "암살"}
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Mafia list (only visible to mafia) */}
              {isMafia && mafiaPlayers.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium mb-2 text-red-500">마피아 팀</h3>
                  <div className="space-y-1.5">
                    {mafiaPlayers.map((player) => {
                      const playerDisplay = getPlayerDisplay(player)
                      return (
                        <div key={player.id} className="flex items-center p-2 rounded-md bg-red-900/30 min-h-[2.5rem]">
                          <span className="text-lg mr-2">{playerDisplay.emoji}</span>
                          <span>{playerDisplay.name}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Chat area */}
        <div className="md:col-span-2">
          <Card className="h-full flex flex-col">
            <CardHeader className="pb-2">
              <h3 className="font-medium">
                {phaseState === "day" ? "전체 채팅" : isMafia ? "마피아 채팅" : "밤이 되었습니다"}
              </h3>
            </CardHeader>
            <CardContent className="flex-grow overflow-hidden">
              <ScrollArea className="h-[calc(100vh-300px)]">
                <div className="space-y-2">
                  {phaseState === "night" && !isMafia ? (
                    <div className="flex items-center justify-center h-[calc(100vh-400px)]">
                      <div className="text-center">
                        <MoonIcon className="h-12 w-12 mx-auto mb-4 text-blue-500" />
                        <p className="text-lg">밤입니다. 마피아의 행동을 기다리는 중입니다.</p>
                      </div>
                    </div>
                  ) : (
                    groupMessages(messages).map((group, groupIndex) => (
                      <div key={groupIndex} className={`flex ${group.isSystem ? "justify-center" : "items-start"}`}>
                        {!group.isSystem ? (
                          <div className="flex flex-col items-start w-full">
                            <div className="space-y-1 w-full">
                              {group.messages.map((msg, msgIndex) => {
                                const senderDisplay = parseCharacterFromNickname(msg.sender)
                                return (
                                  <div key={msgIndex} className="text-sm leading-relaxed">
                                    <span className="font-bold text-primary">
                                      {senderDisplay ? `${senderDisplay.emoji} ${senderDisplay.name}` : msg.sender}:
                                    </span>{" "}
                                    <span>{msg.content}</span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        ) : (
                          // 시스템 메시지 스타일 개선
                          <div className="bg-blue-100 dark:bg-blue-900/30 px-4 py-2 rounded-full text-sm flex items-center text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800/50 my-1">
                            <Info className="h-4 w-4 mr-2 text-blue-500" />
                            {group.messages[0].content}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                  <div ref={chatEndRef} />
                </div>
              </ScrollArea>
            </CardContent>
            <CardFooter>
              <form onSubmit={sendMessage} className="w-full flex gap-2">
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={getChatPlaceholder()}
                  disabled={!canChat}
                />
                <Button type="submit" disabled={!canChat}>
                  <SendIcon className="h-4 w-4" />
                </Button>
              </form>
            </CardFooter>
          </Card>
        </div>
      </div>

      {/* 모바일 레이아웃 (md 미만) - 중복 플레이어 목록 제거 */}
      <div className="md:hidden flex flex-col h-screen">
        {/* 상단 고정 정보 영역 */}
        <div className="bg-background border-b border-border p-3 space-y-2">
          {/* 페이즈 및 타이머 */}
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              {phaseState === "day" ? (
                <SunIcon className="h-4 w-4 mr-2 text-yellow-500" />
              ) : (
                <MoonIcon className="h-4 w-4 mr-2 text-blue-500" />
              )}
              <span className="font-bold text-sm">
                {dayState}일차 {phaseState === "day" ? "낮" : "밤"}
                {subPhaseState &&
                  phaseState === "day" &&
                  ` (${
                    subPhaseState === "discussion"
                      ? "토론"
                      : subPhaseState === "nomination"
                        ? "지목"
                        : subPhaseState === "defense"
                          ? "변론"
                          : subPhaseState === "execution"
                            ? "투표"
                            : "결과"
                  })`}
              </span>
            </div>

            <Button variant="ghost" size="sm" onClick={handleLeaveRoom} className="h-6 px-2 text-xs text-red-500">
              <LogOut className="h-3 w-3 mr-1" />
              나가기
            </Button>
          </div>

          {/* 내 역할 및 상태 */}
          <div className="flex justify-between items-center text-xs">
            <div>
              <span className="text-muted-foreground">내 역할: </span>
              <span className={role === "mafia" ? "text-red-500 font-bold" : "text-blue-500 font-bold"}>
                {role === "mafia" ? "마피아" : "시민"}
              </span>
              {!isAlive && <span className="ml-1 text-red-500">(사망)</span>}
            </div>
          </div>

          {/* 지목된 플레이어 표시 */}
          {nominatedPlayerState && (
            <div className="text-xs text-center bg-yellow-100 dark:bg-yellow-900/30 p-2 rounded-md">
              <span className="font-medium">
                지목된 플레이어: {parseCharacterFromNickname(nominatedPlayerState)?.name || nominatedPlayerState}
              </span>
            </div>
          )}
        </div>

        {/* 플레이어 목록 (가로 스크롤) - 높이 조정 */}
        <div className="bg-background border-b border-border p-2">
          <div className="flex space-x-2 overflow-x-auto pb-1 px-1">
            {players.map((player) => {
              const playerDisplay = getPlayerDisplay(player)
              return (
                <div
                  key={player.id}
                  className={`flex-shrink-0 flex flex-col items-center p-1.5 rounded-lg min-w-[55px] max-w-[65px] min-h-[4rem] ${
                    player.isAlive ? "bg-secondary" : "bg-gray-200 dark:bg-gray-800/50 grayscale opacity-50"
                  } ${player.nickname === nickname ? "ring-2 ring-primary" : ""}`}
                >
                  <div className="relative">
                    <span className={`text-base ${!player.isAlive ? "grayscale" : ""}`}>{playerDisplay.emoji}</span>
                    {!player.isAlive && <Skull className="absolute -top-1 -right-1 h-3 w-3 text-red-500" />}
                    {isMafia && player.role === "mafia" && player.isAlive && (
                      <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></div>
                    )}
                  </div>
                  <span className={`text-xs text-center mt-1 ${!player.isAlive ? "line-through text-red-400" : ""}`}>
                    {playerDisplay.name.length > 6 ? playerDisplay.name.substring(0, 6) + "..." : playerDisplay.name}
                  </span>
                  {player.nickname === nickname && <span className="text-xs text-primary font-bold">나</span>}
                </div>
              )
            })}
          </div>
        </div>

        {/* 채팅 영역 - 모바일 환경 개선 (높이 50% 축소) */}
        <div className="flex-1 flex flex-col overflow-hidden max-h-[40vh]">
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full p-3">
              <div className="space-y-1">
                {phaseState === "night" && !isMafia ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <MoonIcon className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                      <p className="text-sm">밤입니다. 마피아의 행동을 기다리는 중입니다.</p>
                    </div>
                  </div>
                ) : (
                  groupMessages(messages).map((group, groupIndex) => (
                    <div key={groupIndex} className={`${group.isSystem ? "text-center" : ""}`}>
                      {!group.isSystem ? (
                        <div className="space-y-0.5">
                          {group.messages.map((msg, msgIndex) => {
                            const senderDisplay = parseCharacterFromNickname(msg.sender)
                            return (
                              <div key={msgIndex} className="text-sm leading-relaxed">
                                <span className="font-bold text-primary">
                                  {senderDisplay ? `${senderDisplay.emoji} ${senderDisplay.name}` : msg.sender}:
                                </span>{" "}
                                <span>{msg.content}</span>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        // 시스템 메시지 모바일 스타일
                        <div className="bg-blue-100 dark:bg-blue-900/30 px-3 py-1 rounded-full text-xs flex items-center justify-center text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800/50 my-1 mx-4">
                          <Info className="h-3 w-3 mr-1 text-blue-500" />
                          {group.messages[0].content}
                        </div>
                      )}
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>
            </ScrollArea>
          </div>

          {/* 채팅 입력창 (하단 고정) */}
          <div className="border-t border-border p-3 bg-background">
            <form onSubmit={sendMessage} className="flex gap-2">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={getChatPlaceholder()}
                disabled={!canChat}
                className="text-base" // 모바일에서 확대 방지를 위해 font-size 16px 이상으로 설정
              />
              <Button type="submit" disabled={!canChat} size="sm">
                <SendIcon className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>

        {/* 나머지 공간 - 플레이어 상세 정보나 게임 상태 표시 */}
        <div className="flex-1 bg-secondary/20 p-3 overflow-y-auto" />
      </div>

      {/* 모달들 */}
      {showNominationModal && (
        <NominationVoteModal
          players={players}
          currentPlayer={currentPlayer}
          timeLeft={localTimeLeft}
          onVote={handleNominationVote}
          onClose={() => setShowNominationModal(false)}
        />
      )}

      {showExecutionModal && nominatedPlayerState && (
        <ExecutionVoteModal
          nominatedPlayer={nominatedPlayerState}
          currentPlayerNickname={nickname}
          timeLeft={localTimeLeft}
          onVote={handleExecutionVote}
          onClose={() => setShowExecutionModal(false)}
          players={players}
          voteResult={voteResultState} // 투표 결과 전달
        />
      )}

      {showMafiaTargetModal && isMafia && isAlive && phaseState === "night" && (
        <MafiaTargetModal
          players={players}
          currentPlayerNickname={nickname}
          timeLeft={localTimeLeft}
          onTarget={handleMafiaTarget}
          onClose={() => setShowMafiaTargetModal(false)}
          selectedTarget={mafiaTarget}
        />
      )}

      {showVoteResultPopup && localVoteResult && (
        <VoteResultPopup
          result={localVoteResult}
          timeLeft={localTimeLeft}
          onClose={() => setShowVoteResultPopup(false)}
        />
      )}

      {showNominationResultModal && nominationResult && (
        <NominationResultModal
          result={nominationResult}
          timeLeft={localTimeLeft}
          onClose={() => setShowNominationResultModal(false)}
        />
      )}

      {showPhaseTransitionModal && phaseTransitionInfo && (
        <PhaseTransitionModal
          type={phaseTransitionInfo.type}
          message={phaseTransitionInfo.message}
          onClose={() => setShowPhaseTransitionModal(false)}
        />
      )}

      {renderDeadPlayerMessage()}
    </div>
  )
}

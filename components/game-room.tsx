"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import type { Socket } from "socket.io-client"
import type { Player } from "@/types/game"
import type { ChatMessage } from "@/types/chat"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { UserIcon, MoonIcon, SunIcon, SendIcon } from "lucide-react"

interface GameRoomProps {
  players: Player[]
  role: "mafia" | "citizen" | null
  day: number
  phase: "day" | "night"
  socket: Socket | null
  roomId: string
  nickname: string
  isOfflineMode?: boolean
  offlineGame?: any
  timeLeft?: number
}

export function GameRoom({
  players,
  role,
  day,
  phase,
  socket,
  roomId,
  nickname,
  isOfflineMode = false,
  offlineGame,
  timeLeft = 0,
}: GameRoomProps) {
  const [message, setMessage] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [votedFor, setVotedFor] = useState<string | null>(null)
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>({})
  const [mafiaTarget, setMafiaTarget] = useState<string | null>(null)
  const [systemMessages, setSystemMessages] = useState<string[]>([])
  const chatEndRef = useRef<HTMLDivElement>(null)
  const [localTimeLeft, setLocalTimeLeft] = useState<number>(timeLeft)

  const currentPlayer = players.find((p) => p.nickname === nickname)
  const isAlive = currentPlayer?.isAlive ?? true
  const isMafia = role === "mafia"
  const canChat = isAlive && (phase === "day" || (phase === "night" && isMafia))
  const canVote = isAlive && phase === "day" && !votedFor
  const canTarget = isAlive && phase === "night" && isMafia && !mafiaTarget

  // Get alive players
  const alivePlayers = players.filter((p) => p.isAlive)

  // Get mafia players (only visible to mafia)
  const mafiaPlayers = isMafia ? players.filter((p) => p.role === "mafia" && p.isAlive) : []

  useEffect(() => {
    // 서버에서 받은 timeLeft 값으로 localTimeLeft 업데이트
    setLocalTimeLeft(timeLeft)
  }, [timeLeft])

  useEffect(() => {
    if (isOfflineMode && offlineGame) {
      // Use offline game state
      setMessages(offlineGame.messages)
      setVoteCounts(offlineGame.voteCounts)
      setSystemMessages(offlineGame.systemMessages)
      return
    }

    if (socket) {
      const handleChatMessage = (message: ChatMessage) => {
        setMessages((prev) => [...prev, message])
      }

      const handleSystemMessage = (message: string) => {
        setSystemMessages((prev) => [...prev, message])
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

      const handleVoteUpdate = (votes: Record<string, number>) => {
        setVoteCounts(votes)
      }

      const handlePhaseChange = ({
        phase,
        day,
        timeLeft,
      }: { phase: "day" | "night"; day: number; timeLeft: number }) => {
        setVotedFor(null)
        setMafiaTarget(null)
      }

      // 이벤트 리스너 등록
      socket.on("chatMessage", handleChatMessage)
      socket.on("systemMessage", handleSystemMessage)
      socket.on("voteUpdate", handleVoteUpdate)
      socket.on("phaseChange", handlePhaseChange)

      return () => {
        // 이벤트 리스너 제거
        socket.off("chatMessage", handleChatMessage)
        socket.off("systemMessage", handleSystemMessage)
        socket.off("voteUpdate", handleVoteUpdate)
        socket.off("phaseChange", handlePhaseChange)
      }
    }
  }, [socket, isOfflineMode, offlineGame])

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // 타이머 표시용 로컬 카운트다운
  useEffect(() => {
    if (localTimeLeft <= 0) return

    const timer = setInterval(() => {
      setLocalTimeLeft((prev) => Math.max(0, prev - 1))
    }, 1000)

    return () => clearInterval(timer)
  }, [localTimeLeft])

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim() || !canChat) return

    if (isOfflineMode && offlineGame) {
      offlineGame.sendMessage(message, phase === "night" && isMafia)
    } else if (socket) {
      socket.emit("sendMessage", {
        roomId,
        sender: nickname,
        content: message,
        isMafiaChat: phase === "night" && isMafia,
      })
    }

    setMessage("")
  }

  const handleVote = (targetNickname: string) => {
    if (!canVote) return

    if (isOfflineMode && offlineGame) {
      offlineGame.handleVote(nickname, targetNickname)
      setVotedFor(targetNickname)
    } else if (socket) {
      socket.emit("vote", {
        roomId,
        voter: nickname,
        target: targetNickname,
      })
      setVotedFor(targetNickname)
    }
  }

  const handleMafiaTarget = (targetNickname: string) => {
    if (!canTarget) return

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
  }

  return (
    <div className="flex min-h-screen flex-col p-4 bg-gradient-to-b from-gray-900 to-black">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
        {/* Game info and player list */}
        <div className="md:col-span-1 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  {phase === "day" ? (
                    <SunIcon className="h-5 w-5 mr-2 text-yellow-500" />
                  ) : (
                    <MoonIcon className="h-5 w-5 mr-2 text-blue-500" />
                  )}
                  <span className="font-bold">
                    {day}일차 {phase === "day" ? "낮" : "밤"}
                  </span>
                </div>
                <div className="text-sm">
                  <span className="font-mono">
                    {Math.floor(localTimeLeft / 60)}:{(localTimeLeft % 60).toString().padStart(2, "0")}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <h3 className="text-sm font-medium mb-2">
                생존자 ({alivePlayers.length}/{players.length})
              </h3>
              <div className="space-y-2">
                {players.map((player) => (
                  <div
                    key={player.id}
                    className={`flex items-center justify-between p-2 rounded-md ${
                      player.isAlive ? "bg-secondary" : "bg-secondary/30 text-muted-foreground line-through"
                    }`}
                  >
                    <div className="flex items-center">
                      <UserIcon className="h-4 w-4 mr-2" />
                      <span>{player.nickname}</span>
                      {!player.isAlive && <span className="ml-2 text-xs">(사망)</span>}
                      {isMafia && player.role === "mafia" && (
                        <span className="ml-2 text-xs text-red-500">(마피아)</span>
                      )}
                    </div>

                    {/* Vote button (day phase) */}
                    {phase === "day" && player.isAlive && player.nickname !== nickname && isAlive && (
                      <Button
                        variant={votedFor === player.nickname ? "destructive" : "outline"}
                        size="sm"
                        disabled={!canVote}
                        onClick={() => handleVote(player.nickname)}
                      >
                        {voteCounts[player.nickname] ? `투표 (${voteCounts[player.nickname]})` : "투표"}
                      </Button>
                    )}

                    {/* Target button (night phase, mafia only) */}
                    {phase === "night" && isMafia && player.isAlive && player.role !== "mafia" && (
                      <Button
                        variant={mafiaTarget === player.nickname ? "destructive" : "outline"}
                        size="sm"
                        disabled={!canTarget}
                        onClick={() => handleMafiaTarget(player.nickname)}
                      >
                        {mafiaTarget === player.nickname ? "선택됨" : "암살"}
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              {/* Mafia list (only visible to mafia) */}
              {isMafia && mafiaPlayers.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium mb-2 text-red-500">마피아 팀</h3>
                  <div className="space-y-2">
                    {mafiaPlayers.map((player) => (
                      <div key={player.id} className="flex items-center p-2 rounded-md bg-red-900/30">
                        <UserIcon className="h-4 w-4 mr-2" />
                        <span>{player.nickname}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* System messages */}
          <Card>
            <CardHeader className="pb-2">
              <h3 className="font-medium">게임 로그</h3>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[150px]">
                <div className="space-y-2">
                  {systemMessages.map((msg, index) => (
                    <div key={index} className="text-sm text-muted-foreground">
                      {msg}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Chat area */}
        <div className="md:col-span-2">
          <Card className="h-full flex flex-col">
            <CardHeader className="pb-2">
              <h3 className="font-medium">
                {phase === "day" ? "전체 채팅" : isMafia ? "마피아 채팅" : "밤이 되었습니다"}
              </h3>
            </CardHeader>
            <CardContent className="flex-grow overflow-hidden">
              <ScrollArea className="h-[calc(100vh-300px)]">
                <div className="space-y-4">
                  {phase === "night" && !isMafia ? (
                    <div className="flex items-center justify-center h-[calc(100vh-400px)]">
                      <div className="text-center">
                        <MoonIcon className="h-12 w-12 mx-auto mb-4 text-blue-500" />
                        <p className="text-lg">밤입니다. 마피아의 행동을 기다리는 중입니다.</p>
                      </div>
                    </div>
                  ) : (
                    messages
                      .filter((msg) => {
                        // Filter messages based on phase and role
                        if (msg.isSystem) return true
                        if (phase === "day") return !msg.isMafiaChat
                        if (phase === "night" && isMafia) return msg.isMafiaChat
                        return false
                      })
                      .map((msg, index) => (
                        <div key={index} className={`flex ${msg.isSystem ? "justify-center" : "items-start"}`}>
                          {!msg.isSystem && (
                            <div className="flex flex-col items-start">
                              <div className="bg-secondary p-3 rounded-lg">
                                <div className="text-xs text-muted-foreground mb-1">{msg.sender}</div>
                                <div>{msg.content}</div>
                              </div>
                            </div>
                          )}

                          {msg.isSystem && (
                            <div className="bg-muted/50 px-4 py-2 rounded-full text-sm">{msg.content}</div>
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
                  placeholder={
                    !isAlive
                      ? "사망한 플레이어는 채팅할 수 없습니다"
                      : phase === "night" && !isMafia
                        ? "밤에는 채팅할 수 없습니다"
                        : "메시지를 입력하세요"
                  }
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
    </div>
  )
}

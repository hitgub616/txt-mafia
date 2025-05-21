"use client"

import { useState, useEffect, useRef } from "react"
import type { Player } from "@/types/game"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { UserIcon, Clock } from "lucide-react"

interface NominationVoteModalProps {
  players: Player[]
  currentPlayer: Player
  timeLeft: number
  onVote: (target: string | null) => void
  onClose: () => void
}

export function NominationVoteModal({ players, currentPlayer, timeLeft, onVote, onClose }: NominationVoteModalProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(currentPlayer.nominationVote || null)
  const [isVoted, setIsVoted] = useState(false)
  const [isExiting, setIsExiting] = useState(false)
  const [animateSelection, setAnimateSelection] = useState<string | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const maxTime = 5 // 최대 시간 (초)

  // 투표 가능한 플레이어 목록 (자신 제외, 생존자만)
  const votablePlayers = players.filter((player) => player.isAlive && player.nickname !== currentPlayer.nickname)

  // 타이머가 끝나면 자동으로 투표 처리
  useEffect(() => {
    if (timeLeft <= 0 && !isVoted) {
      handleSubmit()
    }
  }, [timeLeft])

  // 모달 진입 애니메이션
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        handleClose()
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  // 플레이어 선택 처리
  const handlePlayerSelect = (nickname: string) => {
    // 이미 선택된 플레이어를 다시 클릭하면 선택 취소
    if (selectedPlayer === nickname) {
      setSelectedPlayer(null)
      setAnimateSelection(null)
    } else {
      setSelectedPlayer(nickname)
      setAnimateSelection(nickname)

      // 애니메이션 효과 후 리셋
      setTimeout(() => {
        setAnimateSelection(null)
      }, 500)
    }
  }

  // 투표 제출
  const handleSubmit = () => {
    if (isVoted) return

    setIsVoted(true)
    onVote(selectedPlayer)

    // 투표 후 모달 닫기 (약간의 지연 후)
    setTimeout(() => {
      handleClose()
    }, 500)
  }

  // 모달 닫기 (애니메이션 포함)
  const handleClose = () => {
    setIsExiting(true)
    setTimeout(() => {
      onClose()
    }, 200) // 애니메이션 시간과 일치시킴
  }

  return (
    <div
      className={`fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 ${isExiting ? "fade-out" : "fade-in"}`}
    >
      <div ref={modalRef} className={`w-full max-w-md ${isExiting ? "modal-exit" : "modal-enter"}`}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>의심되는 플레이어 지목</span>
              <div className="flex items-center text-sm font-normal">
                <Clock className="h-4 w-4 mr-1" />
                <span>{timeLeft}초</span>
              </div>
            </CardTitle>
            {/* 타이머 바 추가 */}
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1 mt-2">
              <div
                className="countdown-bar rounded-full"
                style={{
                  animationDuration: `${maxTime}s`,
                  width: `${(timeLeft / maxTime) * 100}%`,
                }}
              ></div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground mb-4 slide-in-bottom" style={{ animationDelay: "0.1s" }}>
                가장 의심되는 플레이어를 선택하세요. 최다 득표자는 최후 변론 기회를 갖게 됩니다.
              </p>

              <div className="grid grid-cols-1 gap-2">
                {votablePlayers.map((player, index) => (
                  <Button
                    key={player.id}
                    variant={selectedPlayer === player.nickname ? "destructive" : "outline"}
                    className={`justify-start h-auto py-3 vote-highlight ${
                      selectedPlayer === player.nickname ? "vote-selected border-2 border-destructive" : ""
                    } ${animateSelection === player.nickname ? "pulse-vote" : ""} slide-in-bottom`}
                    onClick={() => handlePlayerSelect(player.nickname)}
                    disabled={isVoted}
                    style={{ animationDelay: `${0.1 + index * 0.05}s` }}
                  >
                    <div className="flex items-center">
                      <UserIcon className="h-4 w-4 mr-2" />
                      <span>{player.nickname}</span>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between slide-in-bottom" style={{ animationDelay: "0.3s" }}>
            <Button variant="ghost" onClick={handleClose} disabled={isVoted}>
              취소
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isVoted}
              className={isVoted ? "bg-green-500 hover:bg-green-600" : ""}
            >
              {isVoted ? "투표 완료" : "투표하기"}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}

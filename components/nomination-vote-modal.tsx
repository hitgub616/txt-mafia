"use client"

import { useState, useEffect, useRef, useCallback } from "react"
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
  const initialRender = useRef(true) // useRef를 컴포넌트 스코프로 이동

  // 투표 가능한 플레이어 목록 (자신 제외, 생존자만) - 사망자 제외 로직 강화
  const votablePlayers = players.filter((player) => {
    // 자신은 제외
    if (player.nickname === currentPlayer.nickname) return false

    // 사망자는 제외 (명시적 검사 강화)
    if (player.isAlive === false) return false

    return true
  })

  // 디버깅 로그 추가
  console.log("All players:", players)
  console.log("Votable players:", votablePlayers)
  console.log(
    "Dead players:",
    players.filter((p) => !p.isAlive).map((p) => p.nickname),
  )

  // 모달 닫기 (애니메이션 포함)
  const handleClose = useCallback(() => {
    setIsExiting(true)
    setTimeout(() => {
      onClose()
    }, 200) // 애니메이션 시간과 일치시킴
  }, [onClose])

  // 투표 제출 함수 수정 - 즉시 모달 닫기
  const handleSubmit = useCallback(() => {
    if (isVoted) return

    setIsVoted(true)
    onVote(selectedPlayer)

    // 투표 후 즉시 모달 닫기 (지연 제거)
    handleClose()
  }, [selectedPlayer, isVoted, onVote, handleClose])

  // 타이머가 끝나면 자동으로 투표 처리
  useEffect(() => {
    // 타이머가 0 이하일 때만 자동 제출 처리
    // 초기 렌더링 시 timeLeft가 0이면 무시하도록 ref 사용
    if (initialRender.current) {
      initialRender.current = false
      // 초기 렌더링 시 timeLeft가 이미 0이면 무시
      if (timeLeft <= 0) return
    }

    if (timeLeft <= 0 && !isVoted) {
      console.log("NominationVoteModal: 타이머 종료, 자동 제출")
      handleSubmit()
    }
  }, [timeLeft, isVoted, handleSubmit])

  // 모달 클릭 이벤트 처리 - 외부 클릭 방지 수정
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        // 투표가 완료되었거나 타이머가 0이 된 경우에만 닫기 허용
        if (isVoted || timeLeft <= 0) {
          handleClose()
        }
        // 그 외의 경우 무시 (외부 클릭 방지)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isVoted, timeLeft, handleClose])

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

  // 타이머 임계값 확인 (5초 이하)
  const isTimerCritical = timeLeft <= 5 && timeLeft > 0

  return (
    <div
      className={`fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 ${isExiting ? "fade-out" : "fade-in"}`}
      // 배경 클릭 이벤트 방지 (이벤트 버블링 차단)
      onClick={(e) => e.stopPropagation()}
    >
      <div ref={modalRef} className={`w-full max-w-md ${isExiting ? "modal-exit" : "modal-enter"}`}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>의심되는 플레이어 지목</span>
              <div
                className={`flex items-center text-sm font-normal px-2 py-1 rounded-full ${
                  isTimerCritical ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 animate-pulse" : ""
                }`}
              >
                <Clock className={`h-4 w-4 mr-1 ${isTimerCritical ? "text-red-500" : ""}`} />
                <span className={isTimerCritical ? "font-bold" : ""}>{timeLeft}초</span>
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
              <p className="text-sm text-muted-foreground mb-4">
                가장 의심되는 플레이어를 선택하세요. 최다 득표자는 최후 변론 기회를 갖게 됩니다.
              </p>

              {votablePlayers.length > 0 ? (
                <div className="grid grid-cols-1 gap-2">
                  {votablePlayers.map((player) => (
                    <Button
                      key={player.id}
                      variant={selectedPlayer === player.nickname ? "destructive" : "outline"}
                      className={`justify-start h-auto py-3 vote-highlight ${
                        selectedPlayer === player.nickname ? "vote-selected border-2 border-destructive" : ""
                      } ${animateSelection === player.nickname ? "pulse-vote" : ""}`}
                      onClick={() => handlePlayerSelect(player.nickname)}
                      disabled={isVoted}
                    >
                      <div className="flex items-center">
                        <UserIcon className="h-4 w-4 mr-2" />
                        <span>{player.nickname}</span>
                      </div>
                    </Button>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center bg-yellow-50 dark:bg-yellow-900/20 rounded-md border border-yellow-200 dark:border-yellow-800/30">
                  <p className="text-yellow-800 dark:text-yellow-200">투표 가능한 플레이어가 없습니다.</p>
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="ghost" onClick={handleClose} disabled={isVoted || timeLeft > 0}>
              취소
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isVoted || votablePlayers.length === 0}
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

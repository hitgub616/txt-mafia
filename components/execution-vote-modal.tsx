"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Clock, ThumbsUp, ThumbsDown, AlertCircle, Skull } from "lucide-react"

interface ExecutionVoteModalProps {
  nominatedPlayer: string
  timeLeft: number
  currentPlayerNickname: string
  onVote: (vote: "yes" | "no" | null) => void
  onClose: () => void
  players?: { nickname: string; isAlive: boolean }[] // players를 선택적으로 변경
}

export function ExecutionVoteModal({
  nominatedPlayer,
  timeLeft,
  currentPlayerNickname,
  onVote,
  onClose,
  players = [], // 기본값으로 빈 배열 제공
}: ExecutionVoteModalProps) {
  const [vote, setVote] = useState<"yes" | "no" | null>(null)
  const [isVoted, setIsVoted] = useState(false)
  const [isExiting, setIsExiting] = useState(false)
  const [animateVote, setAnimateVote] = useState<"yes" | "no" | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const maxTime = 3 // 최대 시간 (초)

  // 현재 플레이어가 지목된 플레이어인지 확인 (사망자 처리 로직 강화)
  const isNominated = currentPlayerNickname === nominatedPlayer

  // 방어 코드 추가: players가 유효한 배열인지 확인 후 find 메소드 사용
  const isPlayerDead =
    Array.isArray(players) && players.length > 0
      ? players.find((p) => p.nickname === currentPlayerNickname)?.isAlive === false
      : false

  // 사망자 또는 지목된 플레이어는 투표할 수 없음
  const canVote = !isNominated && !isPlayerDead

  // 모달 닫기 (애니메이션 포함)
  const handleClose = () => {
    setIsExiting(true)
    setTimeout(() => {
      onClose()
    }, 200) // 애니메이션 시간과 일치시킴
  }

  // 타이머가 끝나면 자동으로 투표 처리
  useEffect(() => {
    if (timeLeft <= 0 && !isVoted && !isNominated) {
      handleSubmit()
    }
  }, [timeLeft, isVoted, isNominated])

  // 모달 클릭 이벤트 처리 - 외부 클릭 방지 수정
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        // 투표가 완료되었거나 타이머가 0이 된 경우에만 닫기 허용
        if (isVoted || timeLeft <= 0 || isNominated) {
          handleClose()
        }
        // 그 외의 경우 무시 (외부 클릭 방지)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isVoted, timeLeft, isNominated])

  // 투표 선택 처리
  const handleVoteSelect = (selectedVote: "yes" | "no") => {
    // 이미 선택된 투표를 다시 클릭하면 선택 취소
    if (vote === selectedVote) {
      setVote(null)
      setAnimateVote(null)
    } else {
      setVote(selectedVote)
      setAnimateVote(selectedVote)

      // 애니메이션 효과 후 리셋
      setTimeout(() => {
        setAnimateVote(null)
      }, 500)
    }
  }

  // 투표 제출
  const handleSubmit = () => {
    if (isVoted || isNominated) return

    setIsVoted(true)
    onVote(vote)

    // 투표 후 모달 닫기 (약간의 지연 후)
    setTimeout(() => {
      handleClose()
    }, 500)
  }

  // 사망자 메시지 추가
  if (isPlayerDead) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="w-full max-w-md">
          <Card>
            <CardHeader>
              <CardTitle>처형 투표</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 p-4">
                <div className="flex justify-center mb-4">
                  <Skull className="h-16 w-16 text-red-500" />
                </div>
                <p className="text-center font-medium text-lg">당신은 사망한 상태입니다</p>
                <p className="text-center text-muted-foreground">
                  사망한 플레이어는 투표에 참여할 수 없습니다. 게임이 끝날 때까지 관전만 가능합니다.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
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
              <span>처형 투표</span>
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
            {isNominated ? (
              // 지목된 플레이어인 경우 투표 대신 기다림 메시지 표시
              <div className="space-y-4 p-4">
                <div className="flex justify-center mb-4">
                  <AlertCircle className="h-16 w-16 text-yellow-500" />
                </div>
                <p className="text-center font-medium text-lg">당신은 투표 대상입니다</p>
                <p className="text-center text-muted-foreground">
                  다른 플레이어들이 당신의 처형 여부를 투표하고 있습니다. 결과를 기다려주세요.
                </p>
              </div>
            ) : (
              // 일반 플레이어인 경우 투표 UI 표시
              <div className="space-y-4">
                <p className="text-center font-medium text-lg">{nominatedPlayer}님을 처형하시겠습니까?</p>
                <p className="text-sm text-muted-foreground text-center mb-4">과반수 찬성으로 처형이 결정됩니다.</p>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <Button
                    variant={vote === "yes" ? "destructive" : "outline"}
                    className={`h-20 vote-highlight ${vote === "yes" ? "vote-selected border-2 border-destructive" : ""} 
                      ${animateVote === "yes" ? "pulse-vote" : ""}`}
                    onClick={() => handleVoteSelect("yes")}
                    disabled={isVoted || !canVote}
                  >
                    <div className="flex flex-col items-center">
                      <ThumbsUp className={`h-6 w-6 mb-2 ${vote === "yes" ? "text-white" : ""}`} />
                      <span>찬성</span>
                    </div>
                  </Button>

                  <Button
                    variant={vote === "no" ? "default" : "outline"}
                    className={`h-20 vote-highlight ${vote === "no" ? "vote-selected border-2 border-primary" : ""} 
                      ${animateVote === "no" ? "pulse-vote" : ""}`}
                    onClick={() => handleVoteSelect("no")}
                    disabled={isVoted || !canVote}
                  >
                    <div className="flex flex-col items-center">
                      <ThumbsDown className={`h-6 w-6 mb-2 ${vote === "no" ? "text-white" : ""}`} />
                      <span>반대</span>
                    </div>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-between">
            {!isNominated && (
              <>
                <Button variant="ghost" onClick={handleClose} disabled={isVoted || timeLeft > 0}>
                  취소
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={isVoted || !canVote}
                  className={isVoted ? "bg-green-500 hover:bg-green-600" : ""}
                >
                  {isVoted ? "투표 완료" : "투표하기"}
                </Button>
              </>
            )}
            {isNominated && (
              <Button variant="outline" className="w-full" disabled>
                투표 결과 대기 중...
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}

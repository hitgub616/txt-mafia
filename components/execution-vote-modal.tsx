"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Clock, ThumbsUp, ThumbsDown, AlertCircle, Skull, Check, X, Loader2 } from "lucide-react"
import type { VoteResult } from "@/types/game"

interface ExecutionVoteModalProps {
  nominatedPlayer: string
  timeLeft: number
  currentPlayerNickname: string
  onVote: (vote: "yes" | "no" | null) => void
  onClose: () => void
  players?: { nickname: string; isAlive: boolean }[]
  voteResult?: VoteResult | null // 투표 결과 prop 추가
}

export function ExecutionVoteModal({
  nominatedPlayer,
  timeLeft,
  currentPlayerNickname,
  onVote,
  onClose,
  players = [],
  voteResult = null, // 투표 결과
}: ExecutionVoteModalProps) {
  const [vote, setVote] = useState<"yes" | "no" | null>(null)
  const [isVoted, setIsVoted] = useState(false)
  const [isLoading, setIsLoading] = useState(false) // 로딩 상태 추가
  const [showResult, setShowResult] = useState(false) // 결과 표시 상태
  const [isExiting, setIsExiting] = useState(false)
  const [animateVote, setAnimateVote] = useState<"yes" | "no" | null>(null)
  const [resultTimer, setResultTimer] = useState(10) // 결과 표시 타이머
  const modalRef = useRef<HTMLDivElement>(null)
  const maxTime = 3 // 최대 시간 (초)
  const initialRender = useRef(true)
  const handleCloseRef = useRef(onClose)

  // 현재 플레이어가 지목된 플레이어인지 확인 (사망자 처리 로직 강화)
  const isNominated = currentPlayerNickname === nominatedPlayer

  // 방어 코드 추가: players가 유효한 배열인지 확인 후 find 메소드 사용
  const isPlayerDead =
    Array.isArray(players) && players.length > 0
      ? players.find((p) => p.nickname === currentPlayerNickname)?.isAlive === false
      : false

  // 사망자 또는 지목된 플레이어는 투표할 수 없음
  const canVote = !isNominated && !isPlayerDead && !isVoted && !isLoading && !showResult

  // 투표 결과가 도착했을 때 결과 표시 모드로 전환
  useEffect(() => {
    if (voteResult && isVoted && !showResult) {
      console.log("Vote result received, showing result:", voteResult)
      setIsLoading(false)
      setShowResult(true)
      setResultTimer(10) // 10초 동안 결과 표시
    }
  }, [voteResult, isVoted, showResult])

  // 결과 표시 타이머
  useEffect(() => {
    if (showResult && resultTimer > 0) {
      const timer = setInterval(() => {
        setResultTimer((prev) => {
          if (prev <= 1) {
            clearInterval(timer)
            handleClose()
            return 0
          }
          return prev - 1
        })
      }, 1000)

      return () => clearInterval(timer)
    }
  }, [showResult, resultTimer])

  // 모달 닫기 (애니메이션 포함)
  const handleClose = useCallback(() => {
    setIsExiting(true)
    setTimeout(() => {
      handleCloseRef.current()
    }, 200)
  }, [])

  useEffect(() => {
    handleCloseRef.current = onClose
  }, [onClose])

  // 투표 제출 함수를 useCallback으로 메모이제이션
  const handleSubmit = useCallback(() => {
    if (isVoted || isNominated || isLoading || showResult) return

    setIsVoted(true)
    setIsLoading(true) // 로딩 상태 시작
    onVote(vote)

    console.log("Vote submitted, waiting for result...")
  }, [vote, isVoted, isNominated, isLoading, showResult, onVote])

  // 타이머가 끝나면 자동으로 투표 처리
  useEffect(() => {
    if (initialRender.current) {
      initialRender.current = false
      if (timeLeft <= 0) return
    }

    if (timeLeft <= 0 && !isVoted && !isNominated && !showResult) {
      console.log("ExecutionVoteModal: 타이머 종료, 자동 제출")
      handleSubmit()
    }
  }, [timeLeft, isVoted, isNominated, showResult, handleSubmit])

  // 모달 클릭 이벤트 처리 - 외부 클릭 방지 수정
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        // 결과 표시 중이거나 투표가 완료된 경우에만 닫기 허용
        if (showResult || (isVoted && !isLoading) || timeLeft <= 0 || isNominated) {
          handleClose()
        }
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isVoted, timeLeft, isNominated, isLoading, showResult, handleClose])

  // 투표 선택 처리
  const handleVoteSelect = (selectedVote: "yes" | "no") => {
    if (isVoted || isLoading || showResult) return

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
      onClick={(e) => e.stopPropagation()}
    >
      <div ref={modalRef} className={`w-full max-w-md ${isExiting ? "modal-exit" : "modal-enter"}`}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{showResult ? "투표 결과" : "처형 투표"}</span>
              {!showResult && (
                <div
                  className={`flex items-center text-sm font-normal px-2 py-1 rounded-full ${
                    isTimerCritical ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 animate-pulse" : ""
                  }`}
                >
                  <Clock className={`h-4 w-4 mr-1 ${isTimerCritical ? "text-red-500" : ""}`} />
                  <span className={isTimerCritical ? "font-bold" : ""}>{timeLeft}초</span>
                </div>
              )}
              {showResult && (
                <div className="flex items-center text-sm font-normal px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30">
                  <Clock className="h-4 w-4 mr-1" />
                  <span>{resultTimer}초</span>
                </div>
              )}
            </CardTitle>
            {/* 타이머 바 추가 */}
            {!showResult && (
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1 mt-2">
                <div
                  className="countdown-bar rounded-full"
                  style={{
                    animationDuration: `${maxTime}s`,
                    width: `${(timeLeft / maxTime) * 100}%`,
                  }}
                ></div>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {showResult && voteResult ? (
              // 투표 결과 표시
              <div className="space-y-6">
                {/* 처형 결과 */}
                <div className="text-center">
                  {voteResult.executed ? (
                    <div className="space-y-2">
                      <div className="text-4xl">⚰️</div>
                      <p className="text-xl font-bold">
                        <span className="text-red-500">{voteResult.target}</span>님이 처형되었습니다.
                      </p>
                      {voteResult.role && (
                        <p className="text-sm">
                          역할:{" "}
                          <span
                            className={`${
                              voteResult.role === "mafia" ? "text-red-500 font-bold" : "text-blue-500 font-bold"
                            } ${voteResult.role === "mafia" ? "shake" : ""}`}
                          >
                            {voteResult.role === "mafia" ? "마피아" : "시민"}
                          </span>
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-4xl">🛡️</div>
                      <p className="text-xl font-bold">
                        <span className="text-blue-500">{voteResult.target}</span>님이 생존하였습니다.
                      </p>
                    </div>
                  )}
                </div>

                {/* 투표 현황 */}
                <div>
                  <h3 className="text-sm font-medium mb-3 text-center">투표 현황</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {/* 찬성 투표 */}
                    <div>
                      <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-t-md">
                        <p className="text-center font-medium text-green-700 dark:text-green-300">찬성</p>
                      </div>
                      <div className="space-y-1 mt-1">
                        {voteResult.votes
                          .filter((v) => v.vote === "yes")
                          .map((vote) => (
                            <div
                              key={vote.nickname}
                              className="flex items-center p-2 rounded-md bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/30"
                            >
                              <Check className="h-4 w-4 mr-2 text-green-500" />
                              <span className="text-sm">{vote.nickname}</span>
                            </div>
                          ))}
                        {voteResult.votes.filter((v) => v.vote === "yes").length === 0 && (
                          <div className="p-2 text-sm text-muted-foreground text-center">찬성 투표 없음</div>
                        )}
                      </div>
                    </div>

                    {/* 반대 투표 */}
                    <div>
                      <div className="bg-red-100 dark:bg-red-900/30 p-2 rounded-t-md">
                        <p className="text-center font-medium text-red-700 dark:text-red-300">반대</p>
                      </div>
                      <div className="space-y-1 mt-1">
                        {voteResult.votes
                          .filter((v) => v.vote === "no")
                          .map((vote) => (
                            <div
                              key={vote.nickname}
                              className="flex items-center p-2 rounded-md bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30"
                            >
                              <X className="h-4 w-4 mr-2 text-red-500" />
                              <span className="text-sm">{vote.nickname}</span>
                            </div>
                          ))}
                        {voteResult.votes.filter((v) => v.vote === "no").length === 0 && (
                          <div className="p-2 text-sm text-muted-foreground text-center">반대 투표 없음</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 무고한 시민 메시지 또는 마피아 처형 성공 메시지 */}
                {voteResult.executed && voteResult.role === "citizen" && (
                  <div className="mt-4 p-4 bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-300 dark:border-blue-700 rounded-lg animate-fade-in">
                    <div className="flex items-center justify-center mb-2">
                      <AlertCircle className="h-6 w-6 text-blue-500 mr-2" />
                      <span className="text-xl font-bold text-blue-600 dark:text-blue-300">무고한 희생</span>
                    </div>
                    <p className="text-2xl font-bold text-center text-blue-700 dark:text-blue-200 mb-2">
                      결백한 시민이 희생되었습니다!
                    </p>
                    <div className="flex justify-center space-x-2 text-xl">
                      <span>😢</span>
                      <span>💔</span>
                    </div>
                  </div>
                )}

                {voteResult.executed && voteResult.role === "mafia" && (
                  <div className="mt-4 p-4 bg-green-100 dark:bg-green-900/30 border-2 border-green-300 dark:border-green-700 rounded-lg animate-fade-in">
                    <div className="flex items-center justify-center mb-2">
                      <AlertCircle className="h-6 w-6 text-green-500 mr-2" />
                      <span className="text-xl font-bold text-green-600 dark:text-green-300">마피아 검거 성공!</span>
                    </div>
                    <p className="text-2xl font-bold text-center text-green-700 dark:text-green-200 mb-2">
                      정의가 승리했습니다!
                    </p>
                    <div className="flex justify-center space-x-2 text-xl">
                      <span>🎉</span>
                      <span>🥳</span>
                    </div>
                  </div>
                )}

                {/* 자동 닫기 안내 */}
                <div className="text-center text-sm text-muted-foreground">{resultTimer}초 후 자동으로 닫힙니다...</div>
              </div>
            ) : isLoading ? (
              // 로딩 상태 표시
              <div className="space-y-4 text-center py-8">
                <Loader2 className="h-12 w-12 mx-auto animate-spin text-blue-500" />
                <p className="text-lg font-medium">투표 결과를 집계하는 중입니다...</p>
                <p className="text-sm text-muted-foreground">잠시만 기다려주세요.</p>
              </div>
            ) : isNominated ? (
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
                    disabled={!canVote}
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
                    disabled={!canVote}
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
            {showResult ? (
              <Button variant="outline" className="w-full" onClick={handleClose}>
                닫기
              </Button>
            ) : isLoading ? (
              <Button variant="outline" className="w-full" disabled>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                투표 처리 중...
              </Button>
            ) : !isNominated ? (
              <>
                <Button variant="ghost" onClick={handleClose} disabled={isVoted || timeLeft > 0}>
                  취소
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!canVote}
                  className={isVoted ? "bg-green-500 hover:bg-green-600" : ""}
                >
                  {isVoted ? "투표 완료" : "투표하기"}
                </Button>
              </>
            ) : (
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

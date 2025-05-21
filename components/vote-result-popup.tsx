"use client"

import { useEffect, useState, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Check, X, Clock } from "lucide-react"
import type { VoteResult } from "@/types/game"

interface VoteResultPopupProps {
  result: VoteResult
  timeLeft: number
  onClose: () => void
}

export function VoteResultPopup({ result, timeLeft, onClose }: VoteResultPopupProps) {
  const [isExiting, setIsExiting] = useState(false)
  const [showVotes, setShowVotes] = useState(false)
  const [showRole, setShowRole] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)
  const maxTime = 10 // 최대 시간 10초로 변경

  // 타이머가 끝나면 자동으로 닫기
  useEffect(() => {
    if (timeLeft <= 0) {
      handleClose()
    }
  }, [timeLeft])

  // 모달 클릭 이벤트 처리
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

  // 단계적으로 결과 표시
  useEffect(() => {
    // 0.5초 후 투표 결과 표시
    const votesTimer = setTimeout(() => {
      setShowVotes(true)
    }, 500)

    // 1초 후 역할 표시 (처형된 경우)
    const roleTimer = setTimeout(() => {
      setShowRole(true)
    }, 1000)

    return () => {
      clearTimeout(votesTimer)
      clearTimeout(roleTimer)
    }
  }, [])

  // 모달 닫기 (애니메이션 포함)
  const handleClose = () => {
    setIsExiting(true)
    setTimeout(() => {
      onClose()
    }, 300) // 애니메이션 시간과 일치시킴
  }

  // 찬성/반대 투표 수 계산
  const yesVotes = result.votes.filter((v) => v.vote === "yes").length
  const noVotes = result.votes.filter((v) => v.vote === "no").length

  // 타이머 임계값 확인 (5초 이하)
  const isTimerCritical = timeLeft <= 5 && timeLeft > 0

  return (
    <div
      className={`fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 ${isExiting ? "fade-out" : "fade-in"}`}
    >
      <div ref={modalRef} className={`w-full max-w-md ${isExiting ? "modal-exit" : "modal-enter"}`}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>투표 결과</span>
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
            <div className="space-y-6">
              {/* 처형 결과 */}
              <div className="text-center">
                {result.executed ? (
                  <div className="space-y-2">
                    <div className="text-4xl">⚰️</div>
                    <p className="text-xl font-bold">
                      <span className="text-red-500">{result.target}</span>님이 처형되었습니다.
                    </p>
                    {result.role && showRole && (
                      <p className="text-sm">
                        역할:{" "}
                        <span
                          className={`${result.role === "mafia" ? "text-red-500 font-bold" : "text-blue-500 font-bold"} ${result.role === "mafia" ? "shake" : ""}`}
                        >
                          {result.role === "mafia" ? "마피아" : "시민"}
                        </span>
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="text-4xl">🛡️</div>
                    <p className="text-xl font-bold">
                      <span className="text-blue-500">{result.target}</span>님이 생존하였습니다.
                    </p>
                  </div>
                )}
              </div>

              {/* 투표 현황 */}
              {showVotes && (
                <div>
                  <h3 className="text-sm font-medium mb-3 text-center">
                    투표 현황 ({yesVotes}:{noVotes})
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {/* 찬성 투표 */}
                    <div>
                      <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-t-md">
                        <p className="text-center font-medium text-green-700 dark:text-green-300">찬성</p>
                      </div>
                      <div className="space-y-1 mt-1">
                        {result.votes
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
                        {result.votes.filter((v) => v.vote === "yes").length === 0 && (
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
                        {result.votes
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
                        {result.votes.filter((v) => v.vote === "no").length === 0 && (
                          <div className="p-2 text-sm text-muted-foreground text-center">반대 투표 없음</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 타이머 */}
              <div className="text-center text-sm text-muted-foreground">{timeLeft}초 후 자동으로 닫힙니다...</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

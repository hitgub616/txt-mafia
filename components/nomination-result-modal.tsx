"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Clock } from "lucide-react"

interface NominationResultModalProps {
  result: {
    nominated: string | null
    votes: Record<string, number>
    voteDetails?: { voter: string; target: string }[]
    tie: boolean
    reason: string
  }
  timeLeft: number
  onClose: () => void
}

export function NominationResultModal({ result, timeLeft, onClose }: NominationResultModalProps) {
  const [isExiting, setIsExiting] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)
  const maxTime = 5 // 최대 시간 (초)

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
    // 0.5초 후 상세 정보 표시
    const detailsTimer = setTimeout(() => {
      setShowDetails(true)
    }, 500)

    return () => {
      clearTimeout(detailsTimer)
    }
  }, [])

  // 모달 닫기 (애니메이션 포함)
  const handleClose = () => {
    setIsExiting(true)
    setTimeout(() => {
      onClose()
    }, 300) // 애니메이션 시간과 일치시킴
  }

  // 타이머 임계값 확인 (5초 이하)
  const isTimerCritical = timeLeft <= 2 && timeLeft > 0

  return (
    <div
      className={`fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 ${isExiting ? "fade-out" : "fade-in"}`}
    >
      <div ref={modalRef} className={`w-full max-w-md ${isExiting ? "modal-exit" : "modal-enter"}`}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>의심 지목 결과</span>
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
              {/* 지목 결과 */}
              <div className="text-center">
                {result.nominated ? (
                  <div className="space-y-2">
                    <div className="text-4xl">🎯</div>
                    <p className="text-xl font-bold">
                      <span className="text-red-500">{result.nominated}</span>님이 최다 득표자로 지목되었습니다.
                    </p>
                    <p className="text-sm text-muted-foreground">잠시 후 최후 변론이 진행됩니다.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="text-4xl">{result.tie ? "🔄" : "❓"}</div>
                    <p className="text-xl font-bold">
                      {result.tie ? "동점자가 발생하여 지목이 무효되었습니다." : "지목된 플레이어가 없습니다."}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      이번 턴에는 최후 변론 및 본투표가 진행되지 않습니다. 곧 밤이 됩니다.
                    </p>
                  </div>
                )}
              </div>

              {/* 투표 상세 정보 (선택적) */}
              {showDetails && result.voteDetails && result.voteDetails.length > 0 && (
                <div className="mt-4 p-3 bg-secondary/50 rounded-md">
                  <h3 className="text-sm font-medium mb-2">투표 요약</h3>
                  <div className="space-y-1 text-xs">
                    {result.voteDetails.map((vote, index) => (
                      <div key={index} className="flex justify-between">
                        <span>{vote.voter}</span>
                        <span className="mx-2">→</span>
                        <span className="font-medium">{vote.target}</span>
                      </div>
                    ))}
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

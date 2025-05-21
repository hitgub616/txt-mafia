"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Clock, ThumbsUp, ThumbsDown } from "lucide-react"

interface ExecutionVoteModalProps {
  nominatedPlayer: string
  timeLeft: number
  onVote: (vote: "yes" | "no" | null) => void
  onClose: () => void
}

export function ExecutionVoteModal({ nominatedPlayer, timeLeft, onVote, onClose }: ExecutionVoteModalProps) {
  const [vote, setVote] = useState<"yes" | "no" | null>(null)
  const [isVoted, setIsVoted] = useState(false)
  const [isExiting, setIsExiting] = useState(false)
  const [animateVote, setAnimateVote] = useState<"yes" | "no" | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const maxTime = 3 // 최대 시간 (초)

  // 타이머가 끝나면 자동으로 투표 처리
  useEffect(() => {
    if (timeLeft <= 0 && !isVoted) {
      handleSubmit()
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
    if (isVoted) return

    setIsVoted(true)
    onVote(vote)

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
              <span>처형 투표</span>
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
            <div className="space-y-4">
              <p className="text-center font-medium text-lg slide-in-bottom" style={{ animationDelay: "0.1s" }}>
                {nominatedPlayer}님을 처형하시겠습니까?
              </p>
              <p
                className="text-sm text-muted-foreground text-center mb-4 slide-in-bottom"
                style={{ animationDelay: "0.2s" }}
              >
                과반수 찬성으로 처형이 결정됩니다.
              </p>

              <div className="grid grid-cols-2 gap-4 mt-4">
                <Button
                  variant={vote === "yes" ? "destructive" : "outline"}
                  className={`h-20 vote-highlight ${vote === "yes" ? "vote-selected border-2 border-destructive" : ""} 
                    ${animateVote === "yes" ? "pulse-vote" : ""} slide-in-bottom`}
                  onClick={() => handleVoteSelect("yes")}
                  disabled={isVoted}
                  style={{ animationDelay: "0.3s" }}
                >
                  <div className="flex flex-col items-center">
                    <ThumbsUp className={`h-6 w-6 mb-2 ${vote === "yes" ? "text-white" : ""}`} />
                    <span>찬성</span>
                  </div>
                </Button>

                <Button
                  variant={vote === "no" ? "default" : "outline"}
                  className={`h-20 vote-highlight ${vote === "no" ? "vote-selected border-2 border-primary" : ""} 
                    ${animateVote === "no" ? "pulse-vote" : ""} slide-in-bottom`}
                  onClick={() => handleVoteSelect("no")}
                  disabled={isVoted}
                  style={{ animationDelay: "0.4s" }}
                >
                  <div className="flex flex-col items-center">
                    <ThumbsDown className={`h-6 w-6 mb-2 ${vote === "no" ? "text-white" : ""}`} />
                    <span>반대</span>
                  </div>
                </Button>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between slide-in-bottom" style={{ animationDelay: "0.5s" }}>
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

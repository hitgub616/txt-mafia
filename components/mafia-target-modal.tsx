"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Clock, UserIcon, Target, Skull } from "lucide-react"
import type { Player } from "@/types/game"

interface MafiaTargetModalProps {
  players: Player[]
  currentPlayerNickname: string
  timeLeft: number
  onTarget: (target: string | null) => void
  onClose: () => void
  selectedTarget: string | null
}

export function MafiaTargetModal({
  players,
  currentPlayerNickname,
  timeLeft,
  onTarget,
  onClose,
  selectedTarget,
}: MafiaTargetModalProps) {
  const [target, setTarget] = useState<string | null>(selectedTarget)
  const [isSelected, setIsSelected] = useState(!!selectedTarget)
  const [isExiting, setIsExiting] = useState(false)
  const [animateTarget, setAnimateTarget] = useState<string | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const maxTime = 15 // 최대 시간 (초)
  const initialRender = useRef(true)
  const handleCloseRef = useRef(onClose)

  // 타겟 가능한 플레이어 목록 (자신 제외, 마피아 제외, 생존자만)
  const targetablePlayers = players.filter((player) => {
    // 자신은 제외
    if (player.nickname === currentPlayerNickname) return false

    // 마피아는 제외
    if (player.role === "mafia") return false

    // 사망자는 제외
    if (player.isAlive === false) return false

    return true
  })

  // 모달 닫기 (애니메이션 포함)
  const handleClose = useCallback(() => {
    setIsExiting(true)
    setTimeout(() => {
      handleCloseRef.current()
    }, 200) // 애니메이션 시간과 일치시킴
  }, [])

  useEffect(() => {
    handleCloseRef.current = onClose
  }, [onClose])

  // 타겟 선택 제출 함수를 useCallback으로 메모이제이션
  const handleSubmit = useCallback(() => {
    if (isSelected) return

    setIsSelected(true)
    onTarget(target)

    // 타겟 선택 후 모달 닫기 (약간의 지연 후)
    setTimeout(() => {
      handleClose()
    }, 500)
  }, [target, isSelected, onTarget, handleClose])

  // 타이머가 끝나면 자동으로 타겟 선택 처리
  useEffect(() => {
    // 초기 렌더링 시 timeLeft가 0이면 무시하도록 ref 사용
    if (initialRender.current) {
      initialRender.current = false
      // 초기 렌더링 시 timeLeft가 이미 0이면 무시
      if (timeLeft <= 0) return
    }

    if (timeLeft <= 0 && !isSelected) {
      console.log("MafiaTargetModal: 타이머 종료, 자동 제출")
      handleSubmit()
    }
  }, [timeLeft, isSelected, handleSubmit])

  // 모달 클릭 이벤트 처리 - 외부 클릭 방지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        // 타겟 선택이 완료되었거나 타이머가 0이 된 경우에만 닫기 허용
        if (isSelected || timeLeft <= 0) {
          handleClose()
        }
        // 그 외의 경우 무시 (외부 클릭 방지)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isSelected, timeLeft, handleClose])

  // 플레이어 선택 처리
  const handlePlayerSelect = (nickname: string) => {
    // 이미 선택된 플레이어를 다시 클릭하면 선택 취소
    if (target === nickname) {
      setTarget(null)
      setAnimateTarget(null)
    } else {
      setTarget(nickname)
      setAnimateTarget(nickname)

      // 애니메이션 효과 후 리셋
      setTimeout(() => {
        setAnimateTarget(null)
      }, 500)
    }
  }

  // 타이머 임계값 확인 (5초 이하)
  const isTimerCritical = timeLeft <= 5 && timeLeft > 0

  return (
    <div
      className={`fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 ${isExiting ? "fade-out" : "fade-in"}`}
      // 배경 클릭 이벤트 방지 (이벤트 버블링 차단)
      onClick={(e) => e.stopPropagation()}
    >
      <div ref={modalRef} className={`w-full max-w-md ${isExiting ? "modal-exit" : "modal-enter"}`}>
        <Card className="bg-gray-900 border-red-900">
          <CardHeader className="border-b border-red-900/50">
            <CardTitle className="flex items-center justify-between text-red-500">
              <span>마피아 타겟 선택</span>
              <div
                className={`flex items-center text-sm font-normal px-2 py-1 rounded-full ${
                  isTimerCritical ? "bg-red-900/30 text-red-400 animate-pulse" : "bg-gray-800 text-gray-300"
                }`}
              >
                <Clock className={`h-4 w-4 mr-1 ${isTimerCritical ? "text-red-500" : ""}`} />
                <span className={isTimerCritical ? "font-bold" : ""}>{timeLeft}초</span>
              </div>
            </CardTitle>
            {/* 타이머 바 추가 */}
            <div className="w-full bg-gray-800 rounded-full h-1 mt-2">
              <div
                className="rounded-full bg-red-600"
                style={{
                  animationDuration: `${maxTime}s`,
                  width: `${(timeLeft / maxTime) * 100}%`,
                  height: "4px",
                }}
              ></div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-3">
              <p className="text-sm text-gray-400 mb-4">
                제거할 타겟을 선택하세요. 밤이 끝나면 선택된 플레이어가 제거됩니다.
              </p>

              {targetablePlayers.length > 0 ? (
                <div className="grid grid-cols-1 gap-2">
                  {targetablePlayers.map((player) => (
                    <Button
                      key={player.id}
                      variant={target === player.nickname ? "destructive" : "outline"}
                      className={`justify-start h-auto py-3 vote-highlight ${
                        target === player.nickname
                          ? "vote-selected border-2 border-red-600 bg-red-900 text-white"
                          : "bg-gray-800 border-gray-700 text-gray-300 hover:bg-red-900/30"
                      } ${animateTarget === player.nickname ? "pulse-vote" : ""}`}
                      onClick={() => handlePlayerSelect(player.nickname)}
                      disabled={isSelected}
                    >
                      <div className="flex items-center">
                        {target === player.nickname ? (
                          <Target className="h-4 w-4 mr-2 text-red-400" />
                        ) : (
                          <UserIcon className="h-4 w-4 mr-2" />
                        )}
                        <span>{player.nickname}</span>
                      </div>
                    </Button>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center bg-gray-800 rounded-md border border-gray-700">
                  <Skull className="h-8 w-8 mx-auto mb-2 text-red-500" />
                  <p className="text-gray-300">제거할 수 있는 플레이어가 없습니다.</p>
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex justify-between border-t border-red-900/50 pt-4">
            <Button
              variant="ghost"
              onClick={handleClose}
              disabled={isSelected || timeLeft > 0}
              className="text-gray-400 hover:text-white hover:bg-gray-800"
            >
              취소
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSelected || targetablePlayers.length === 0}
              className={
                isSelected ? "bg-green-700 hover:bg-green-800 text-white" : "bg-red-700 hover:bg-red-800 text-white"
              }
            >
              {isSelected ? "타겟 선택 완료" : "타겟 선택하기"}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}

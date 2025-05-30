"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"

interface PhaseTransitionModalProps {
  type: "dayStart" | "nightStart" | "nightResult"
  message: string
  onClose: () => void
  nightResult?: {
    killedPlayerNickname: string | null
    noVictim: boolean
    day: number
  }
}

export function PhaseTransitionModal({ type, message, onClose, nightResult }: PhaseTransitionModalProps) {
  const [isExiting, setIsExiting] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)
  const displayTime = type === "nightResult" ? 5000 : 4000 // 밤 결과는 5초, 나머지는 4초

  // 자동으로 닫기
  useEffect(() => {
    const timer = setTimeout(() => {
      handleClose()
    }, displayTime)

    return () => clearTimeout(timer)
  }, [])

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

  // 모달 닫기 (애니메이션 포함)
  const handleClose = () => {
    setIsExiting(true)
    setTimeout(() => {
      onClose()
    }, 300) // 애니메이션 시간과 일치시킴
  }

  // 밤 결과 렌더링
  const renderNightResult = () => {
    if (type !== "nightResult" || !nightResult) return null

    return (
      <Card
        className={`text-center p-8 shadow-2xl ${
          nightResult.noVictim
            ? "bg-white dark:bg-gray-800 border-2 border-green-400 dark:border-green-500"
            : "bg-white dark:bg-gray-800 border-2 border-red-400 dark:border-red-500"
        }`}
      >
        <CardContent className="pt-6">
          <div className="mb-6">
            {nightResult.noVictim ? (
              <div className="text-6xl animate-pulse-slow">🌅</div>
            ) : (
              <div className="text-6xl animate-pulse-slow">💀</div>
            )}
          </div>

          <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
            {nightResult.day}일차 아침이 밝았습니다
          </h2>

          <p
            className={`text-lg mb-4 font-semibold ${
              nightResult.noVictim ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"
            }`}
          >
            {message}
          </p>

          {!nightResult.noVictim && (
            <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/30 border-2 border-red-300 dark:border-red-600 rounded-lg">
              <p className="text-sm font-medium text-red-900 dark:text-red-100">
                마피아의 희생자가 발생했습니다. 토론을 통해 마피아를 찾아내세요.
              </p>
            </div>
          )}

          {nightResult.noVictim && (
            <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/30 border-2 border-green-300 dark:border-green-600 rounded-lg">
              <p className="text-sm font-medium text-green-900 dark:text-green-100">
                평화로운 밤이었습니다. 토론을 시작해주세요.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div
      className={`fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 ${isExiting ? "fade-out" : "fade-in"}`}
    >
      <div
        ref={modalRef}
        className={`w-full max-w-md ${isExiting ? "modal-exit" : "modal-enter"} ${
          type === "dayStart" ? "day-transition" : type === "nightStart" ? "night-transition" : ""
        }`}
      >
        {type === "nightResult" ? (
          renderNightResult()
        ) : (
          <Card
            className={`text-center p-8 ${
              type === "dayStart"
                ? "bg-gradient-to-b from-yellow-50 to-orange-50 border-yellow-200"
                : "bg-gradient-to-b from-blue-900 to-indigo-900 border-blue-700 text-white"
            }`}
          >
            <CardContent className="pt-6">
              <div className="mb-6">
                {type === "dayStart" ? (
                  <div className="text-6xl animate-pulse-slow">☀️</div>
                ) : (
                  <div className="text-6xl animate-pulse-slow">🌙</div>
                )}
              </div>

              <h2 className="text-2xl font-bold mb-4">
                {type === "dayStart" ? "아침이 밝았습니다" : "밤이 깊었습니다"}
              </h2>

              <p
                className={`text-lg ${
                  type === "dayStart" ? "text-orange-800" : "text-blue-200"
                } transition-all duration-500`}
              >
                {message}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

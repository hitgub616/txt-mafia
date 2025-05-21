"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"

interface PhaseTransitionModalProps {
  type: "dayStart" | "nightStart"
  message: string
  onClose: () => void
}

export function PhaseTransitionModal({ type, message, onClose }: PhaseTransitionModalProps) {
  const [isExiting, setIsExiting] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)
  const displayTime = 4000 // 4초 동안 표시

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

  return (
    <div
      className={`fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 ${isExiting ? "fade-out" : "fade-in"}`}
    >
      <div
        ref={modalRef}
        className={`w-full max-w-md ${isExiting ? "modal-exit" : "modal-enter"} ${
          type === "dayStart" ? "day-transition" : "night-transition"
        }`}
      >
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

            <h2 className="text-2xl font-bold mb-4">{type === "dayStart" ? "아침이 밝았습니다" : "밤이 깊었습니다"}</h2>

            <p
              className={`text-lg ${
                type === "dayStart" ? "text-orange-800" : "text-blue-200"
              } transition-all duration-500`}
            >
              {message}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

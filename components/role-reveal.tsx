"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"

interface RoleRevealProps {
  role: "mafia" | "citizen" | null
}

export function RoleReveal({ role }: RoleRevealProps) {
  const [countdown, setCountdown] = useState(5)

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 theme-background">
      <Card className="w-full max-w-md text-center p-8">
        <CardContent className="pt-6">
          <h2 className="text-2xl font-bold mb-6">당신의 역할은</h2>

          <div className="mb-8">
            {role === "mafia" ? (
              <div className="space-y-4">
                <div className="text-5xl">🕵️</div>
                <div className="text-3xl font-bold text-red-500">마피아</div>
                <p className="text-muted-foreground">밤에 시민을 제거할 수 있습니다.</p>
                <p className="text-muted-foreground">다른 마피아와 협력하세요!</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-5xl">👨‍🌾</div>
                <div className="text-3xl font-bold text-blue-500">시민</div>
                <p className="text-muted-foreground">토론을 통해 마피아를 찾아내세요.</p>
              </div>
            )}
          </div>

          <div className="text-sm text-muted-foreground">
            {countdown > 0 ? <p>{countdown}초 후 게임이 시작됩니다...</p> : <p>게임을 시작합니다...</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

"use client"

import { Suspense, useState, useEffect } from "react"
import { ConnectionTest } from "@/components/connection-test"

export default function TestPage() {
  // Add a loading state to handle client-side rendering
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 theme-background">
      <div className="max-w-md w-full mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-2">서버 연결 테스트</h1>
          <p className="text-muted-foreground">마피아 게임 서버 연결 상태를 확인합니다</p>
        </div>

        <Suspense
          fallback={
            <div className="w-full max-w-md p-6 bg-card rounded-lg shadow animate-pulse">
              <div className="h-6 bg-secondary rounded mb-4"></div>
              <div className="h-4 bg-secondary rounded mb-2 w-3/4"></div>
              <div className="h-4 bg-secondary rounded mb-6 w-1/2"></div>
              <div className="space-y-4">
                <div className="h-8 bg-secondary rounded"></div>
                <div className="h-8 bg-secondary rounded"></div>
                <div className="h-8 bg-secondary rounded"></div>
              </div>
            </div>
          }
        >
          {isClient && <ConnectionTest />}
        </Suspense>
      </div>
    </div>
  )
}

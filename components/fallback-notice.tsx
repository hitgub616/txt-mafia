"use client"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertTriangle } from "lucide-react"

export function FallbackNotice() {
  return (
    <Alert className="mb-4 bg-yellow-500/10 border-yellow-500/30">
      <AlertTriangle className="h-4 w-4 text-yellow-500" />
      <AlertTitle>대체 연결 모드로 실행 중</AlertTitle>
      <AlertDescription>
        Socket.IO 연결에 문제가 있어 대체 연결 방식을 사용하고 있습니다. 일부 기능이 제한될 수 있습니다.
      </AlertDescription>
    </Alert>
  )
}

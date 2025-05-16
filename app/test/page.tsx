"use client"

import { ConnectionTest } from "@/components/connection-test"

export default function TestPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-gradient-to-b from-gray-900 to-black">
      <div className="max-w-md w-full mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">서버 연결 테스트</h1>
          <p className="text-gray-400">마피아 게임 서버 연결 상태를 확인합니다</p>
        </div>
        <ConnectionTest />
      </div>
    </div>
  )
}

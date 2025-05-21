import { LobbyForm } from "@/components/lobby-form"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 theme-background">
      <div className="max-w-md w-full mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">마피아 게임</h1>
          <p className="text-muted-foreground">웹 기반 실시간 채팅형 마피아 게임</p>
        </div>
        <LobbyForm />
      </div>
    </main>
  )
}

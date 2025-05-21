import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { validateEnvironmentVariables, debugEnvironmentVariables } from "@/environment-variables"
import { Toaster } from "@/components/ui/sonner"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "마피아 게임",
  description: "웹 기반 실시간 마피아 게임",
    generator: 'v0.dev'
}

// 환경 변수 검증 및 디버깅
if (typeof window === "undefined") {
  // 서버 사이드에서만 실행
  const isValid = validateEnvironmentVariables()
  if (!isValid) {
    console.warn("⚠️ 일부 환경 변수가 설정되지 않았습니다. 기본값을 사용합니다.")
  }

  // 개발 환경에서만 환경 변수 디버깅 정보 출력
  if (process.env.NODE_ENV === "development") {
    debugEnvironmentVariables()
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange={false}>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}

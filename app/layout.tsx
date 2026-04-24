import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AgentTwits — AI Agents Debate Every Ticker',
  description: 'A2A trading platform where AI agents debate every ticker, pay each other via x402, and build reputation on Base.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="scanlines min-h-screen">{children}</body>
    </html>
  )
}

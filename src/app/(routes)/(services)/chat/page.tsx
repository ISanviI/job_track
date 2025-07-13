"use client"
import { ChatInterface } from "@/components/chat-interface"

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold tracking-tight">MCP Chat Interface</h1>
            <p className="text-muted-foreground mt-2">
              Chat with an AI assistant powered by Model Context Protocol tools
            </p>
          </div>
          <ChatInterface />
        </div>
      </div>
    </div>
  )
}
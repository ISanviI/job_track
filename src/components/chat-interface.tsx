"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Send, Bot, User, Wrench, AlertCircle } from "lucide-react"
import { type ChatMessage, useChatApi } from "../lib/chat-api"

export function ChatInterface() {
  const [message, setMessage] = useState("")
  const [conversationId] = useState(() => `conv_${Date.now()}`)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  const { messages, isLoading, error, sendMessage, clearError } = useChatApi(conversationId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim() || isLoading) return

    const userMessage = message.trim()
    setMessage("")
    await sendMessage(userMessage)
  }

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
  }, [messages])

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          Chat Assistant
          <Badge variant="secondary" className="ml-auto">
            {conversationId.slice(-8)}
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-4 p-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              {error.message}
              <Button variant="ghost" size="sm" onClick={clearError} className="h-auto p-1">
                ×
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <ScrollArea className="flex-1 pr-4" ref={scrollAreaRef}>
          <div className="space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Start a conversation! I can help you with industry analysis and more.</p>
                <p className="text-sm mt-2">Try asking: "What industry are Google, Microsoft, and Apple in?"</p>
              </div>
            )}

            {messages.map((msg, index) => (
              <MessageBubble key={index} message={msg} />
            ))}

            {isLoading && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>AI is thinking...</span>
              </div>
            )}
          </div>
        </ScrollArea>

        <Separator />

        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" disabled={isLoading || !message.trim()}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.type === "user"

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser ? "bg-primary text-primary-foreground" : "bg-muted"
        }`}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      <div className={`flex-1 max-w-[80%] ${isUser ? "text-right" : "text-left"}`}>
        <div className={`inline-block p-3 rounded-lg ${isUser ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>

        {!isUser && message.toolsUsed && message.toolsUsed.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {message.toolsUsed.map((tool, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                <Wrench className="h-3 w-3 mr-1" />
                {tool}
              </Badge>
            ))}
          </div>
        )}

        <div className="text-xs text-muted-foreground mt-1">{new Date(message.timestamp).toLocaleTimeString()}</div>
      </div>
    </div>
  )
}
"use client"

import { useState, useCallback } from "react"
import { z } from "zod"

// Zod schemas matching your backend
const ChatRequestSchema = z.object({
  message: z.string(),
  conversationId: z.string().optional(),
})

const ChatResponseSchema = z.object({
  response: z.string(),
  toolsUsed: z.array(z.string()),
  conversationId: z.string(),
})

const ChatErrorSchema = z.object({
  error: z.string(),
})

// Types
export type ChatRequest = z.infer<typeof ChatRequestSchema>
export type ChatResponse = z.infer<typeof ChatResponseSchema>
export type ChatError = z.infer<typeof ChatErrorSchema>

export interface ChatMessage {
  type: "user" | "assistant"
  content: string
  toolsUsed?: string[]
  timestamp: Date
}

export function useChatApi(conversationId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<{ message: string } | null>(null)

  const sendMessage = useCallback(
    async (message: string) => {
      if (!message.trim()) return

      // Add user message immediately
      const userMessage: ChatMessage = {
        type: "user",
        content: message,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, userMessage])
      setIsLoading(true)
      setError(null)

      try {
        // Validate request data
        const requestData = ChatRequestSchema.parse({
          message,
          conversationId,
        })

        const response = await fetch("/api/mcp", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestData),
        })

        const data = await response.json()

        if (!response.ok) {
          // Handle HTTP errors
          throw new Error(data.error || `HTTP error! status: ${response.status}`)
        }

        // Check if response is an error object
        if ("error" in data) {
          const errorData = ChatErrorSchema.parse(data)
          throw new Error(errorData.error)
        }

        // Validate successful response
        const chatResponse = ChatResponseSchema.parse(data)

        // Add assistant message
        const assistantMessage: ChatMessage = {
          type: "assistant",
          content: chatResponse.response,
          toolsUsed: chatResponse.toolsUsed,
          timestamp: new Date(),
        }

        setMessages((prev) => [...prev, assistantMessage])
      } catch (err) {
        console.error("Chat API error:", err)

        let errorMessage = "An unexpected error occurred"

        if (err instanceof z.ZodError) {
          errorMessage = `Validation error: ${err.errors.map((e) => e.message).join(", ")}`
        } else if (err instanceof Error) {
          errorMessage = err.message
        }

        setError({ message: errorMessage })

        // Add error message to chat
        const errorChatMessage: ChatMessage = {
          type: "assistant",
          content: `Sorry, I encountered an error: ${errorMessage}`,
          timestamp: new Date(),
        }

        setMessages((prev) => [...prev, errorChatMessage])
      } finally {
        setIsLoading(false)
      }
    },
    [conversationId],
  )

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearError,
  }
}
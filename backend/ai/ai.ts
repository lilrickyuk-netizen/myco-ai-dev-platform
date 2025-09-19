import { api } from "encore.dev/api";
import type { ChatMessage, GenerateRequest, GenerateResponse } from "./types";

export const generate = api(
  { expose: true, method: "POST", path: "/ai/generate" },
  async (req: GenerateRequest): Promise<GenerateResponse> => {
    // Mock implementation for now
    return {
      content: `This is a mock AI response to: "${req.prompt}"`,
      usage: {
        promptTokens: req.prompt.length / 4,
        completionTokens: 20,
        totalTokens: req.prompt.length / 4 + 20,
      }
    };
  }
);

export const chat = api(
  { expose: true, method: "POST", path: "/ai/chat" },
  async ({ messages }: { messages: ChatMessage[] }): Promise<ChatMessage> => {
    // Mock implementation
    return {
      id: Date.now().toString(),
      role: "assistant",
      content: `This is a mock response to: "${messages[messages.length - 1]?.content || 'your message'}"`,
      timestamp: new Date(),
    };
  }
);
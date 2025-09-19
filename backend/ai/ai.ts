import { api, APIError } from "encore.dev/api";
import type { ChatMessage, GenerateRequest, GenerateResponse, ChatRequest, ChatResponse } from "./types";
import { getAuthData } from "~encore/auth";
import { requireFeature } from "../entitlements/middleware";
import { FEATURES } from "../entitlements/types";
import db from "../db";

// Generates AI responses using the AI engine service.
export const generate = api(
  { expose: true, method: "POST", path: "/ai/generate", auth: true },
  async (req: GenerateRequest): Promise<GenerateResponse> => {
    // Check if user has access to AI generation feature
    await requireFeature(FEATURES.AI_GENERATION);

    if (!req.prompt || typeof req.prompt !== 'string' || req.prompt.trim().length === 0) {
      throw APIError.invalidArgument("Valid prompt is required");
    }

    if (req.prompt.length > 32000) {
      throw APIError.invalidArgument("Prompt too long (max 32000 characters)");
    }

    const auth = getAuthData();
    if (!auth) {
      throw APIError.unauthenticated("Authentication required");
    }

    // Validate project access if provided
    if (req.projectId) {
      const projectAccess = await db.queryRow`
        SELECT p.id FROM projects p
        LEFT JOIN project_collaborators pc ON p.id = pc.project_id
        WHERE p.id = ${req.projectId} 
        AND (p.owner_id = ${auth.userID} OR pc.user_id = ${auth.userID})
      `;

      if (!projectAccess) {
        throw APIError.permissionDenied("Access denied to this project");
      }
    }

    try {
      const aiEngineUrl = process.env.AI_ENGINE_URL || "http://ai-engine:8001";
      const timeoutMs = 30000; // 30 second timeout
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(`${aiEngineUrl}/generation`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            prompt: req.prompt,
            model: req.model || "gpt-3.5-turbo",
            messages: [{ role: "user", content: req.prompt }],
            max_tokens: req.maxTokens || 1000,
            temperature: req.temperature || 0.7
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          if (response.status === 429) {
            throw APIError.resourceExhausted("Rate limit exceeded");
          }
          if (response.status >= 500) {
            throw APIError.unavailable("AI service temporarily unavailable");
          }
          throw APIError.internal(`AI Engine error: ${response.status}`);
        }

        const data = await response.json() as any;
        
        if (data.error) {
          throw APIError.internal(data.error);
        }

        const content = data.choices?.[0]?.message?.content || data.response || "No response from AI";
        const usage = {
          promptTokens: data.usage?.prompt_tokens || Math.ceil(req.prompt.length / 4),
          completionTokens: data.usage?.completion_tokens || Math.ceil(content.length / 4),
          totalTokens: data.usage?.total_tokens || Math.ceil((req.prompt.length + content.length) / 4),
        };

        // Log the generation for analytics
        await db.exec`
          INSERT INTO ai_generations (user_id, project_id, prompt, response, model, prompt_tokens, completion_tokens, total_tokens)
          VALUES (${auth.userID}, ${req.projectId || null}, ${req.prompt}, ${content}, ${req.model || "gpt-3.5-turbo"}, ${usage.promptTokens}, ${usage.completionTokens}, ${usage.totalTokens})
        `;

        return {
          content,
          usage
        };
      } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          throw APIError.deadlineExceeded("Request timeout");
        }
        throw fetchError;
      }
    } catch (error) {
      console.error("AI generation error:", error);
      
      // Re-throw APIErrors as-is
      if (error instanceof APIError) {
        throw error;
      }
      
      throw APIError.unavailable("AI service temporarily unavailable");
    }
  }
);

// ChatRequest and ChatResponse now imported from types

// Handles multi-turn chat conversations with context.
export const chat = api(
  { expose: true, method: "POST", path: "/ai/chat", auth: true },
  async (req: ChatRequest): Promise<ChatResponse> => {
    // Check if user has access to AI generation feature
    await requireFeature(FEATURES.AI_GENERATION);

    if (!req.messages || !Array.isArray(req.messages) || req.messages.length === 0) {
      throw APIError.invalidArgument("Messages array is required");
    }

    const lastMessage = req.messages[req.messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'user') {
      throw APIError.invalidArgument("Last message must be from user");
    }

    const auth = getAuthData();
    if (!auth) {
      throw APIError.unauthenticated("Authentication required");
    }

    // Validate project access if provided
    if (req.projectId) {
      const projectAccess = await db.queryRow`
        SELECT p.id FROM projects p
        LEFT JOIN project_collaborators pc ON p.id = pc.project_id
        WHERE p.id = ${req.projectId} 
        AND (p.owner_id = ${auth.userID} OR pc.user_id = ${auth.userID})
      `;

      if (!projectAccess) {
        throw APIError.permissionDenied("Access denied to this project");
      }
    }

    let sessionId = req.sessionId;

    // Create or validate session
    if (!sessionId) {
      const session = await db.queryRow<{ id: string }>`
        INSERT INTO chat_sessions (user_id, project_id, title)
        VALUES (${auth.userID}, ${req.projectId || null}, ${lastMessage.content.slice(0, 50)})
        RETURNING id::text
      `;
      sessionId = session!.id;
    } else {
      const session = await db.queryRow`
        SELECT id FROM chat_sessions 
        WHERE id = ${sessionId} AND user_id = ${auth.userID}
      `;
      if (!session) {
        throw APIError.notFound("Chat session not found");
      }
    }

    // Store user message
    await db.exec`
      INSERT INTO chat_messages (session_id, role, content)
      VALUES (${sessionId}, ${lastMessage.role}, ${lastMessage.content})
    `;

    try {
      const aiEngineUrl = process.env.AI_ENGINE_URL || "http://ai-engine:8001";
      
      const response = await fetch(`${aiEngineUrl}/chat`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          messages: req.messages,
          model: "gpt-3.5-turbo",
          temperature: 0.7
        })
      });

      if (!response.ok) {
        throw new Error(`AI Engine error: ${response.status}`);
      }

      const data = await response.json() as any;
      const assistantContent = data.choices?.[0]?.message?.content || "I apologize, but I couldn't generate a response at this time.";

      const assistantMessage: ChatMessage = {
        id: Date.now().toString(),
        role: "assistant",
        content: assistantContent,
        timestamp: new Date(),
      };

      // Store assistant message
      await db.exec`
        INSERT INTO chat_messages (session_id, role, content)
        VALUES (${sessionId}, ${assistantMessage.role}, ${assistantMessage.content})
      `;

      return {
        message: assistantMessage,
        sessionId,
        response: assistantMessage.content,
        suggestions: [],
        contextUsed: true
      };
    } catch (error) {
      console.error("Chat error:", error);
      
      // Fallback response
      const fallbackMessage: ChatMessage = {
        id: Date.now().toString(),
        role: "assistant",
        content: "I'm experiencing technical difficulties right now. Please try again in a moment.",
        timestamp: new Date(),
      };

      // Store fallback message
      await db.exec`
        INSERT INTO chat_messages (session_id, role, content)
        VALUES (${sessionId}, ${fallbackMessage.role}, ${fallbackMessage.content})
      `;

      return {
        message: fallbackMessage,
        sessionId,
        response: fallbackMessage.content,
        suggestions: [],
        contextUsed: false
      };
    }
  }
);

// Legacy exports for backward compatibility with tests
export const generateCode = generate;
export async function getModels() {
  return [
    { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo" },
    { id: "gpt-4", name: "GPT-4" },
    { id: "claude-3-sonnet", name: "Claude 3 Sonnet" }
  ];
}
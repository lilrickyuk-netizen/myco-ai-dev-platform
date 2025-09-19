export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

export interface GenerateRequest {
  prompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  projectId?: string;
  context?: string;
}

export interface GenerateResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// Legacy types for backwards compatibility with tests
export interface GenerateCodeRequest extends GenerateRequest {}

export interface ChatRequest {
  sessionId?: string;
  messages: ChatMessage[];
  projectId?: string;
}

export interface ChatResponse {
  message: ChatMessage;
  sessionId: string;
  response?: string;
  suggestions?: string[];
  contextUsed?: boolean;
}
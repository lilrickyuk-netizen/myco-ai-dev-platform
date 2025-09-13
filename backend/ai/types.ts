export interface AIGenerateRequest {
  prompt: string;
  context?: string;
  temperature?: number;
  maxTokens?: number;
  projectId?: string;
}

export interface AIGenerateResponse {
  content: string;
  usage: TokenUsage;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface CodeGenerationRequest {
  description: string;
  language: string;
  framework?: string;
  features?: string[];
  projectId?: string;
}

export interface CodeGenerationResponse {
  files: GeneratedFile[];
  instructions: string;
  dependencies: string[];
}

export interface GeneratedFile {
  path: string;
  content: string;
  description: string;
}

export interface CodeExplanationRequest {
  code: string;
  language?: string;
  focus?: string;
}

export interface CodeExplanationResponse {
  explanation: string;
  suggestions: string[];
  complexity: CodeComplexity;
}

export interface CodeComplexity {
  level: 'low' | 'medium' | 'high';
  score: number;
  factors: string[];
}

export interface DebugRequest {
  code: string;
  error?: string;
  language?: string;
  context?: string;
}

export interface DebugResponse {
  issues: Issue[];
  fixes: CodeFix[];
  explanation: string;
}

export interface Issue {
  type: 'error' | 'warning' | 'suggestion';
  message: string;
  line?: number;
  column?: number;
  severity: number;
}

export interface CodeFix {
  description: string;
  originalCode: string;
  fixedCode: string;
  explanation: string;
}
import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { AIGenerationRequest, AIGenerationResponse } from "./types";
import { secret } from "encore.dev/config";
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

const openAIKey = secret("OpenAIKey");
const openai = createOpenAI({ apiKey: openAIKey() });

// Generates code or content using AI.
export const generate = api<AIGenerationRequest, AIGenerationResponse>(
  { auth: true, expose: true, method: "POST", path: "/ai/generate" },
  async (req) => {
    const auth = getAuthData()!;
    
    try {
      const systemPrompt = getSystemPrompt(req.type, req.language, req.framework);
      const userPrompt = buildUserPrompt(req);

      const { text } = await generateText({
        model: openai("gpt-4o"),
        system: systemPrompt,
        prompt: userPrompt,
        maxTokens: 4000,
        temperature: 0.7,
      });

      return {
        content: text,
        suggestions: generateSuggestions(req.type),
        metadata: {
          type: req.type,
          language: req.language,
          framework: req.framework,
        },
      };
    } catch (error) {
      throw APIError.internal("AI generation failed", error);
    }
  }
);

function getSystemPrompt(type: string, language?: string, framework?: string): string {
  const base = "You are an expert software developer and architect.";
  
  switch (type) {
    case 'code':
      return `${base} Generate clean, well-documented, production-ready code. Follow best practices and include proper error handling.`;
    case 'file':
      return `${base} Generate complete file content with proper structure, imports, and documentation.`;
    case 'project':
      return `${base} Generate project scaffolding with proper file structure, configuration, and initial implementation.`;
    case 'explanation':
      return `${base} Provide clear, detailed explanations of code concepts and implementations.`;
    case 'refactor':
      return `${base} Refactor code to improve readability, performance, and maintainability while preserving functionality.`;
    default:
      return base;
  }
}

function buildUserPrompt(req: AIGenerationRequest): string {
  let prompt = req.prompt;
  
  if (req.language) {
    prompt += `\n\nLanguage: ${req.language}`;
  }
  
  if (req.framework) {
    prompt += `\nFramework: ${req.framework}`;
  }
  
  if (req.context) {
    prompt += `\n\nContext:\n${req.context}`;
  }
  
  return prompt;
}

function generateSuggestions(type: string): string[] {
  const suggestions: Record<string, string[]> = {
    code: [
      "Add error handling",
      "Include unit tests",
      "Add type annotations",
      "Optimize performance",
    ],
    file: [
      "Add documentation",
      "Include imports",
      "Add configuration",
      "Setup linting",
    ],
    project: [
      "Setup CI/CD",
      "Add testing framework",
      "Configure linting",
      "Setup deployment",
    ],
    explanation: [
      "Show examples",
      "Add diagrams",
      "Include best practices",
      "Provide resources",
    ],
    refactor: [
      "Extract functions",
      "Improve naming",
      "Add comments",
      "Optimize imports",
    ],
  };
  
  return suggestions[type] || [];
}

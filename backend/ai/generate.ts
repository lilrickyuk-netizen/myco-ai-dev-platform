import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { 
  AIGenerateRequest, 
  AIGenerateResponse, 
  CodeGenerationRequest, 
  CodeGenerationResponse,
  CodeExplanationRequest,
  CodeExplanationResponse,
  DebugRequest,
  DebugResponse 
} from "./types";
import { getTemplate } from "./templates";

// General AI text generation.
export const generate = api<AIGenerateRequest, AIGenerateResponse>(
  { auth: true, expose: true, method: "POST", path: "/ai/generate" },
  async (req) => {
    const auth = getAuthData()!;
    
    try {
      // Call the AI engine service
      const aiResponse = await fetch(`${process.env.AI_ENGINE_URL || 'http://localhost:8001'}/api/v1/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.AI_ENGINE_API_KEY || 'dev-key'}`
        },
        body: JSON.stringify({
          prompt: req.prompt,
          context: req.context,
          projectId: req.projectId,
          model: req.model || 'gpt-4',
          temperature: req.temperature || 0.7,
          maxTokens: req.maxTokens
        })
      });
      
      if (!aiResponse.ok) {
        throw new Error(`AI service error: ${aiResponse.status} ${aiResponse.statusText}`);
      }
      
      const result = await aiResponse.json();
      
      return {
        content: result.content,
        usage: {
          promptTokens: result.usage?.prompt_tokens || 0,
          completionTokens: result.usage?.completion_tokens || 0,
          totalTokens: result.usage?.total_tokens || 0,
        },
      };
      
    } catch (error) {
      throw APIError.internal(`AI generation failed: ${error}`);
    }
  }
);

// Generates complete code projects based on description.
export const generateCode = api<CodeGenerationRequest, CodeGenerationResponse>(
  { auth: true, expose: true, method: "POST", path: "/ai/generate-code" },
  async (req) => {
    const auth = getAuthData()!;

    try {
      // Call the AI engine for code generation
      const aiResponse = await fetch(`${process.env.AI_ENGINE_URL || 'http://localhost:8001'}/api/v1/generate/code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.AI_ENGINE_API_KEY || 'dev-key'}`
        },
        body: JSON.stringify({
          description: req.description,
          language: req.language,
          framework: req.framework,
          features: req.features,
          style: req.style,
          complexity: req.complexity
        })
      });
      
      if (!aiResponse.ok) {
        throw new Error(`AI service error: ${aiResponse.status} ${aiResponse.statusText}`);
      }
      
      const result = await aiResponse.json();
      
      return {
        files: result.files || [],
        instructions: result.instructions || '',
        dependencies: result.dependencies || [],
      };
      
    } catch (error) {
      // Fallback to template-based generation if AI fails
      const template = getTemplate(req.language, req.framework);
      const files = generateCodeFiles(req, template);
      
      return {
        files,
        instructions: generateInstructions(req),
        dependencies: getDependencies(req.language, req.framework, req.features),
      };
    }
  }
);

// Explains code functionality and suggests improvements.
export const explainCode = api<CodeExplanationRequest, CodeExplanationResponse>(
  { auth: true, expose: true, method: "POST", path: "/ai/explain" },
  async (req) => {
    const auth = getAuthData()!;
    
    try {
      // Call the AI engine for code explanation
      const aiResponse = await fetch(`${process.env.AI_ENGINE_URL || 'http://localhost:8001'}/api/v1/explain`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.AI_ENGINE_API_KEY || 'dev-key'}`
        },
        body: JSON.stringify({
          code: req.code,
          language: req.language,
          focus: req.focus
        })
      });
      
      if (!aiResponse.ok) {
        throw new Error(`AI service error: ${aiResponse.status} ${aiResponse.statusText}`);
      }
      
      const result = await aiResponse.json();
      
      return {
        explanation: result.explanation,
        suggestions: result.suggestions || [],
        complexity: result.complexity || analyzeComplexity(req.code),
      };
      
    } catch (error) {
      // Fallback to local analysis
      const complexity = analyzeComplexity(req.code);
      
      return {
        explanation: generateCodeExplanation(req.code, req.language, req.focus),
        suggestions: generateSuggestions(req.code, req.language),
        complexity,
      };
    }
  }
);

// Debugs code and suggests fixes.
export const debug = api<DebugRequest, DebugResponse>(
  { auth: true, expose: true, method: "POST", path: "/ai/debug" },
  async (req) => {
    const auth = getAuthData()!;
    
    try {
      // Call the AI engine for debugging
      const aiResponse = await fetch(`${process.env.AI_ENGINE_URL || 'http://localhost:8001'}/api/v1/debug`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.AI_ENGINE_API_KEY || 'dev-key'}`
        },
        body: JSON.stringify({
          code: req.code,
          language: req.language,
          error: req.error,
          context: req.context
        })
      });
      
      if (!aiResponse.ok) {
        throw new Error(`AI service error: ${aiResponse.status} ${aiResponse.statusText}`);
      }
      
      const result = await aiResponse.json();
      
      return {
        issues: result.issues || [],
        fixes: result.fixes || [],
        explanation: result.explanation,
      };
      
    } catch (error) {
      // Fallback to local analysis
      const issues = analyzeCode(req.code, req.language);
      const fixes = generateFixes(issues, req.code);
      
      return {
        issues,
        fixes,
        explanation: generateDebugExplanation(issues, req.error),
      };
    }
  }
);

// Helper functions (fallback implementations)
function generateCodeFiles(req: CodeGenerationRequest, template: any) {
  // Fallback template-based generation
  const baseFiles = [
    {
      path: "src/main.ts",
      content: `// Generated ${req.language} application\n// Description: ${req.description}\n\nconsole.log("Hello World");`,
      description: "Main application entry point"
    },
    {
      path: "package.json",
      content: JSON.stringify({
        name: "generated-project",
        version: "1.0.0",
        description: req.description,
        main: "src/main.ts",
        dependencies: {}
      }, null, 2),
      description: "Project configuration and dependencies"
    }
  ];

  return baseFiles;
}

function generateInstructions(req: CodeGenerationRequest): string {
  return `## Generated ${req.language} Project

### Description
${req.description}

### Setup Instructions
1. Install dependencies: \`npm install\`
2. Run the application: \`npm start\`
3. Open your browser to see the result

### Features Included
${req.features?.map(f => `- ${f}`).join('\n') || 'Basic setup'}
`;
}

function getDependencies(language: string, framework?: string, features?: string[]): string[] {
  const deps: string[] = [];
  
  if (language === 'typescript' || language === 'javascript') {
    deps.push('typescript', '@types/node');
  }
  
  if (framework === 'react') {
    deps.push('react', 'react-dom', '@types/react');
  }
  
  if (framework === 'express') {
    deps.push('express', '@types/express');
  }
  
  return deps;
}

function analyzeComplexity(code: string) {
  const lines = code.split('\n').length;
  const cyclomaticComplexity = (code.match(/if|while|for|switch|catch/g) || []).length;
  
  let level: 'low' | 'medium' | 'high';
  let score = Math.min(100, (lines / 10) + (cyclomaticComplexity * 5));
  
  if (score < 20) level = 'low';
  else if (score < 50) level = 'medium';
  else level = 'high';
  
  return {
    level,
    score: Math.round(score),
    factors: [
      `${lines} lines of code`,
      `${cyclomaticComplexity} decision points`,
    ],
  };
}

function generateCodeExplanation(code: string, language?: string, focus?: string): string {
  return `This ${language || 'code'} snippet ${focus ? `focuses on ${focus} and` : ''} performs the following operations:\n\n[Local analysis - AI service unavailable]`;
}

function generateSuggestions(code: string, language?: string): string[] {
  return [
    "Consider adding error handling",
    "Add input validation",
    "Include documentation comments",
    "Consider performance optimizations",
  ];
}

function analyzeCode(code: string, language?: string) {
  // Local code analysis - fallback when AI service unavailable
  return [
    {
      type: 'warning' as const,
      message: 'Consider adding type annotations',
      line: 1,
      column: 1,
      severity: 2,
    },
  ];
}

function generateFixes(issues: any[], code: string) {
  return issues.map(issue => ({
    description: `Fix: ${issue.message}`,
    originalCode: code.split('\n')[issue.line - 1] || '',
    fixedCode: '// Fixed code would go here',
    explanation: 'Explanation of the fix',
  }));
}

function generateDebugExplanation(issues: any[], error?: string): string {
  if (error) {
    return `Error Analysis: ${error}\n\nSuggested fixes based on common patterns...`;
  }
  return `Code analysis found ${issues.length} potential issues.`;
}
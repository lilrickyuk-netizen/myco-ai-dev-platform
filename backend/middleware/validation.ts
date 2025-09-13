import { z } from "zod";

// Project validation schemas
export const CreateProjectSchema = z.object({
  name: z.string().min(1, "Project name is required").max(100, "Project name too long"),
  description: z.string().max(500, "Description too long").optional(),
  templateType: z.string().min(1, "Template type is required"),
  templateName: z.string().min(1, "Template name is required"),
});

export const UpdateProjectSchema = z.object({
  id: z.string().uuid("Invalid project ID"),
  name: z.string().min(1, "Project name is required").max(100, "Project name too long").optional(),
  description: z.string().max(500, "Description too long").optional(),
  status: z.enum(['creating', 'ready', 'building', 'deploying', 'deployed', 'error', 'archived']).optional(),
  gitUrl: z.string().url("Invalid Git URL").optional(),
  deployUrl: z.string().url("Invalid deploy URL").optional(),
  environmentId: z.string().uuid("Invalid environment ID").optional(),
});

// File validation schemas
export const SaveFileSchema = z.object({
  projectId: z.string().uuid("Invalid project ID"),
  path: z.string().min(1, "File path is required").max(500, "File path too long"),
  content: z.string().max(10485760, "File content too large (max 10MB)"), // 10MB limit
  name: z.string().max(255, "File name too long").optional(),
  mimeType: z.string().max(100, "MIME type too long").optional(),
});

export const CreateDirectorySchema = z.object({
  projectId: z.string().uuid("Invalid project ID"),
  path: z.string().min(1, "Directory path is required").max(500, "Directory path too long"),
  name: z.string().min(1, "Directory name is required").max(255, "Directory name too long"),
  parentId: z.string().uuid("Invalid parent ID").optional(),
});

// AI generation schemas
export const AIGenerateSchema = z.object({
  prompt: z.string().min(1, "Prompt is required").max(10000, "Prompt too long"),
  context: z.string().max(20000, "Context too long").optional(),
  projectId: z.string().uuid("Invalid project ID").optional(),
  model: z.string().max(50, "Model name too long").optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().min(1).max(8000).optional(),
});

export const CodeGenerationSchema = z.object({
  description: z.string().min(1, "Description is required").max(2000, "Description too long"),
  language: z.string().min(1, "Language is required").max(50, "Language name too long"),
  framework: z.string().max(50, "Framework name too long").optional(),
  features: z.array(z.string().max(100)).max(20, "Too many features").optional(),
  style: z.string().max(50, "Style name too long").optional(),
  complexity: z.enum(['simple', 'medium', 'complex']).optional(),
});

// Validation helper functions
export function validateUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

export function validateFilePath(path: string): boolean {
  // Check for path traversal attempts
  if (path.includes('..') || path.includes('./') || path.includes('\\')) {
    return false;
  }
  
  // Check for absolute paths
  if (path.startsWith('/') || path.match(/^[A-Za-z]:\//)) {
    return false;
  }
  
  // Check for invalid characters
  const invalidChars = /[<>:"|?*\x00-\x1f]/;
  if (invalidChars.test(path)) {
    return false;
  }
  
  return true;
}

export function sanitizeFileName(fileName: string): string {
  // Remove or replace invalid characters
  return fileName
    .replace(/[<>:"|?*\x00-\x1f]/g, '_')
    .replace(/\.\./g, '_')
    .trim()
    .substring(0, 255);
}

export function validateFileContent(content: string, maxSize: number = 10485760): boolean {
  const sizeInBytes = Buffer.byteLength(content, 'utf8');
  return sizeInBytes <= maxSize;
}

// Rate limiting schemas
export const RateLimitConfig = {
  api: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // limit each IP to 1000 requests per windowMs
  },
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 auth attempts per windowMs
  },
  ai: {
    windowMs: 60 * 1000, // 1 minute
    max: 10, // limit each user to 10 AI requests per minute
  },
  fileUpload: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 50, // limit each user to 50 file operations per 5 minutes
  },
};

// Security headers
export const SecurityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;",
};
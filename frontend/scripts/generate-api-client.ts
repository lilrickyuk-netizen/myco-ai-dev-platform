#!/usr/bin/env ts-node
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const OPENAPI_SPEC_PATH = '../backend/openapi.yaml';
const OUTPUT_DIR = './src/services/api';
const TYPES_FILE = path.join(OUTPUT_DIR, 'types.ts');
const CLIENT_FILE = path.join(OUTPUT_DIR, 'client.ts');

async function generateApiClient() {
  console.log('🔄 Generating API client from OpenAPI specification...');

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  try {
    // Generate TypeScript types from OpenAPI spec
    console.log('📝 Generating TypeScript types...');
    execSync(`npx openapi-typescript ${OPENAPI_SPEC_PATH} --output ${TYPES_FILE}`, {
      stdio: 'inherit'
    });

    // Generate typed client
    console.log('🛠️  Generating typed API client...');
    generateTypedClient();

    console.log('✅ API client generated successfully!');
    console.log(`📁 Types: ${TYPES_FILE}`);
    console.log(`📁 Client: ${CLIENT_FILE}`);
  } catch (error) {
    console.error('❌ Failed to generate API client:', error);
    process.exit(1);
  }
}

function generateTypedClient() {
  const clientCode = `
import type { paths } from './types';

export type ApiPaths = paths;

export type GetHealthResponse = paths['/health']['get']['responses']['200']['content']['application/json'];
export type GetReadinessResponse = paths['/ready']['get']['responses']['200']['content']['application/json'];
export type GetUserInfoResponse = paths['/user/me']['get']['responses']['200']['content']['application/json'];

export type ListProjectsResponse = paths['/projects']['get']['responses']['200']['content']['application/json'];
export type CreateProjectRequest = paths['/projects']['post']['requestBody']['content']['application/json'];
export type CreateProjectResponse = paths['/projects']['post']['responses']['201']['content']['application/json'];
export type GetProjectResponse = paths['/projects/{id}']['get']['responses']['200']['content']['application/json'];
export type UpdateProjectRequest = paths['/projects/{id}']['put']['requestBody']['content']['application/json'];
export type UpdateProjectResponse = paths['/projects/{id}']['put']['responses']['200']['content']['application/json'];

export type FileListResponse = paths['/filesystem/{projectId}']['get']['responses']['200']['content']['application/json'];
export type CreateFileRequest = paths['/filesystem/file']['post']['requestBody']['content']['application/json'];
export type CreateFileResponse = paths['/filesystem/file']['post']['responses']['201']['content']['application/json'];
export type GetFileResponse = paths['/filesystem/file/{id}']['get']['responses']['200']['content']['application/json'];
export type UpdateFileRequest = paths['/filesystem/file/{id}']['put']['requestBody']['content']['application/json'];
export type UpdateFileResponse = paths['/filesystem/file/{id}']['put']['responses']['200']['content']['application/json'];

export type GenerateRequest = paths['/ai/generate']['post']['requestBody']['content']['application/json'];
export type GenerateResponse = paths['/ai/generate']['post']['responses']['200']['content']['application/json'];
export type ChatRequest = paths['/ai/chat']['post']['requestBody']['content']['application/json'];
export type ChatResponse = paths['/ai/chat']['post']['responses']['200']['content']['application/json'];

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

export class ApiClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;

  constructor(baseUrl: string = '', options: { headers?: Record<string, string> } = {}) {
    this.baseUrl = baseUrl;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...options.headers
    };
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = \`\${this.baseUrl}\${path}\`;
    const headers = {
      ...this.defaultHeaders,
      ...options.headers
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      if (!response.ok) {
        let errorData: ApiError;
        try {
          errorData = await response.json();
        } catch {
          errorData = {
            code: 'unknown_error',
            message: \`HTTP \${response.status}: \${response.statusText}\`
          };
        }
        throw new ApiClientError(errorData, response.status);
      }

      // Handle empty responses
      if (response.status === 204 || response.headers.get('Content-Length') === '0') {
        return {} as T;
      }

      return await response.json();
    } catch (error) {
      if (error instanceof ApiClientError) {
        throw error;
      }
      
      throw new ApiClientError({
        code: 'network_error',
        message: error instanceof Error ? error.message : 'Network error occurred'
      });
    }
  }

  // Health endpoints
  async getHealth(): Promise<GetHealthResponse> {
    return this.request<GetHealthResponse>('/health');
  }

  async getReadiness(): Promise<GetReadinessResponse> {
    return this.request<GetReadinessResponse>('/ready');
  }

  // User endpoints
  async getUserInfo(): Promise<GetUserInfoResponse> {
    return this.request<GetUserInfoResponse>('/user/me');
  }

  // Project endpoints
  async listProjects(): Promise<ListProjectsResponse> {
    return this.request<ListProjectsResponse>('/projects');
  }

  async createProject(data: CreateProjectRequest): Promise<CreateProjectResponse> {
    return this.request<CreateProjectResponse>('/projects', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async getProject(id: string): Promise<GetProjectResponse> {
    return this.request<GetProjectResponse>(\`/projects/\${id}\`);
  }

  async updateProject(id: string, data: UpdateProjectRequest): Promise<UpdateProjectResponse> {
    return this.request<UpdateProjectResponse>(\`/projects/\${id}\`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteProject(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(\`/projects/\${id}\`, {
      method: 'DELETE'
    });
  }

  // Filesystem endpoints
  async listFiles(projectId: string): Promise<FileListResponse> {
    return this.request<FileListResponse>(\`/filesystem/\${projectId}\`);
  }

  async createFile(data: CreateFileRequest): Promise<CreateFileResponse> {
    return this.request<CreateFileResponse>('/filesystem/file', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async getFile(id: string): Promise<GetFileResponse> {
    return this.request<GetFileResponse>(\`/filesystem/file/\${id}\`);
  }

  async updateFile(id: string, data: UpdateFileRequest): Promise<UpdateFileResponse> {
    return this.request<UpdateFileResponse>(\`/filesystem/file/\${id}\`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteFile(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(\`/filesystem/file/\${id}\`, {
      method: 'DELETE'
    });
  }

  // AI endpoints
  async generateContent(data: GenerateRequest): Promise<GenerateResponse> {
    return this.request<GenerateResponse>('/ai/generate', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async chat(data: ChatRequest): Promise<ChatResponse> {
    return this.request<ChatResponse>('/ai/chat', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // Utility methods
  setAuthToken(token: string) {
    this.defaultHeaders['Authorization'] = \`Bearer \${token}\`;
  }

  removeAuthToken() {
    delete this.defaultHeaders['Authorization'];
  }

  setBaseUrl(url: string) {
    this.baseUrl = url;
  }
}

export class ApiClientError extends Error {
  public readonly error: ApiError;
  public readonly status?: number;

  constructor(error: ApiError, status?: number) {
    super(error.message);
    this.name = 'ApiClientError';
    this.error = error;
    this.status = status;
  }

  get code() {
    return this.error.code;
  }

  get details() {
    return this.error.details;
  }
}

// Default client instance
export const apiClient = new ApiClient();

export default apiClient;
`;

  fs.writeFileSync(CLIENT_FILE, clientCode.trim());
}

// Run the generator
if (require.main === module) {
  generateApiClient();
}

export { generateApiClient };
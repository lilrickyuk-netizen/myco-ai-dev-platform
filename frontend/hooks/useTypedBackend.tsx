import { useAuth } from "@clerk/clerk-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../src/services/api/client";
import type {
  ListProjectsResponse,
  CreateProjectRequest,
  CreateProjectResponse,
  GetProjectResponse,
  UpdateProjectRequest,
  UpdateProjectResponse,
  FileListResponse,
  CreateFileRequest,
  CreateFileResponse,
  GetFileResponse,
  UpdateFileRequest,
  UpdateFileResponse,
  GenerateRequest,
  GenerateResponse,
  ChatRequest,
  ChatResponse,
  GetUserInfoResponse
} from "../src/services/api/client";

export function useTypedBackend() {
  const { getToken, isSignedIn } = useAuth();
  const queryClient = useQueryClient();

  // Setup authentication
  React.useEffect(() => {
    const setupAuth = async () => {
      if (isSignedIn) {
        const token = await getToken();
        if (token) {
          apiClient.setAuthToken(token);
        }
      } else {
        apiClient.removeAuthToken();
      }
    };
    setupAuth();
  }, [isSignedIn, getToken]);

  return {
    // Health endpoints
    health: {
      check: () => useQuery({
        queryKey: ['health'],
        queryFn: () => apiClient.getHealth(),
        staleTime: 30000, // 30 seconds
      }),
      readiness: () => useQuery({
        queryKey: ['readiness'],
        queryFn: () => apiClient.getReadiness(),
        staleTime: 10000, // 10 seconds
      })
    },

    // User endpoints
    user: {
      me: () => useQuery({
        queryKey: ['user', 'me'],
        queryFn: () => apiClient.getUserInfo(),
        enabled: isSignedIn,
        staleTime: 300000, // 5 minutes
      })
    },

    // Project endpoints
    projects: {
      list: () => useQuery({
        queryKey: ['projects'],
        queryFn: () => apiClient.listProjects(),
        enabled: isSignedIn,
        staleTime: 60000, // 1 minute
      }),

      get: (id: string) => useQuery({
        queryKey: ['projects', id],
        queryFn: () => apiClient.getProject(id),
        enabled: isSignedIn && !!id,
        staleTime: 60000,
      }),

      create: () => useMutation({
        mutationFn: (data: CreateProjectRequest) => apiClient.createProject(data),
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['projects'] });
        },
      }),

      update: () => useMutation({
        mutationFn: ({ id, data }: { id: string; data: UpdateProjectRequest }) => 
          apiClient.updateProject(id, data),
        onSuccess: (_, variables) => {
          queryClient.invalidateQueries({ queryKey: ['projects'] });
          queryClient.invalidateQueries({ queryKey: ['projects', variables.id] });
        },
      }),

      delete: () => useMutation({
        mutationFn: (id: string) => apiClient.deleteProject(id),
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['projects'] });
        },
      })
    },

    // Filesystem endpoints
    filesystem: {
      listFiles: (projectId: string) => useQuery({
        queryKey: ['filesystem', projectId],
        queryFn: () => apiClient.listFiles(projectId),
        enabled: isSignedIn && !!projectId,
        staleTime: 30000,
      }),

      getFile: (id: string) => useQuery({
        queryKey: ['files', id],
        queryFn: () => apiClient.getFile(id),
        enabled: isSignedIn && !!id,
        staleTime: 60000,
      }),

      createFile: () => useMutation({
        mutationFn: (data: CreateFileRequest) => apiClient.createFile(data),
        onSuccess: (_, variables) => {
          queryClient.invalidateQueries({ queryKey: ['filesystem', variables.projectId] });
        },
      }),

      updateFile: () => useMutation({
        mutationFn: ({ id, data }: { id: string; data: UpdateFileRequest }) => 
          apiClient.updateFile(id, data),
        onSuccess: (_, variables) => {
          queryClient.invalidateQueries({ queryKey: ['files', variables.id] });
        },
      }),

      deleteFile: () => useMutation({
        mutationFn: (id: string) => apiClient.deleteFile(id),
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['filesystem'] });
          queryClient.invalidateQueries({ queryKey: ['files'] });
        },
      })
    },

    // AI endpoints
    ai: {
      generate: () => useMutation({
        mutationFn: (data: GenerateRequest) => apiClient.generateContent(data),
      }),

      chat: () => useMutation({
        mutationFn: (data: ChatRequest) => apiClient.chat(data),
      })
    }
  };
}
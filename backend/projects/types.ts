export interface Project {
  id: string;
  name: string;
  description?: string;
  template: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  settings: Record<string, any>;
  status: string;
}

export interface ProjectCollaborator {
  id: string;
  projectId: string;
  userId: string;
  role: string;
  invitedAt: Date;
  acceptedAt?: Date;
}

export type ProjectTemplate = 
  | "react-typescript"
  | "vue-typescript" 
  | "angular-typescript"
  | "nodejs-express"
  | "python-fastapi"
  | "java-spring"
  | "go-gin"
  | "nextjs-typescript"
  | "nuxt-typescript"
  | "svelte-typescript";

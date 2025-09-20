import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";

export interface UserInfo {
  id: string;
  email: string | null;
  imageUrl: string;
  firstName: string | null;
  lastName: string | null;
}

// Legacy types for backwards compatibility with tests
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  name?: string;  // Legacy support for tests
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  imageUrl?: string;
  name?: string;  // Legacy support for tests
  email?: string; // Legacy support for tests
}

// Gets the current user's information.
export const getUserInfo = api<void, UserInfo>(
  { auth: true, expose: true, method: "GET", path: "/user/me" },
  async () => {
    const auth = getAuthData()!;
    return {
      id: auth.userID,
      email: auth.email,
      imageUrl: auth.imageUrl,
      firstName: auth.firstName,
      lastName: auth.lastName,
    };
  }
);
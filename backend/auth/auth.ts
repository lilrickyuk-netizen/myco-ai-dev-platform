import { createClerkClient, verifyToken } from "@clerk/backend";
import { Header, Cookie, APIError, Gateway } from "encore.dev/api";
import { authHandler } from "encore.dev/auth";
import { getAuthData } from "~encore/auth";
import { secret } from "encore.dev/config";

const clerkSecretKey = secret("ClerkSecretKey");
const clerkClient = createClerkClient({ secretKey: clerkSecretKey() });

interface AuthParams {
  authorization?: Header<"Authorization">;
  session?: Cookie<"session">;
}

export interface AuthData {
  userID: string;
  imageUrl: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
}

// Configure the authorized parties.
const AUTHORIZED_PARTIES = [
  "https://myco-ai-dev-platform-d32ldfc82vjkjrpel8hg.lp.dev",
  "http://localhost:5173",
  "localhost:5173"
];

export const auth = authHandler<AuthParams, AuthData>(
  async (data) => {
    // Resolve the authenticated user from the authorization header or session cookie.
    const token = data.authorization?.replace("Bearer ", "") ?? data.session?.value;
    if (!token) {
      throw APIError.unauthenticated("missing token");
    }

    try {
      const verifiedToken = await verifyToken(token, {
        authorizedParties: AUTHORIZED_PARTIES,
        secretKey: clerkSecretKey(),
      });

      const user = await clerkClient.users.getUser(verifiedToken.sub);
      return {
        userID: user.id,
        imageUrl: user.imageUrl,
        email: user.emailAddresses[0]?.emailAddress ?? null,
        firstName: user.firstName,
        lastName: user.lastName,
      };
    } catch (err) {
      throw APIError.unauthenticated("invalid token", err as Error);
    }
  }
);

// Configure the API gateway to use the auth handler.
export const gw = new Gateway({ authHandler: auth });

// Legacy exports for backward compatibility with tests
export async function login(req: { email: string; password: string }) {
  throw new Error("Legacy login not implemented - use Clerk authentication");
}

export async function register(req: { email: string; password: string; firstName?: string; lastName?: string }) {
  throw new Error("Legacy register not implemented - use Clerk authentication");
}

export async function getProfile() {
  const auth = getAuthData();
  if (!auth) {
    throw new Error("Not authenticated");
  }
  return {
    id: auth.userID,
    email: auth.email,
    imageUrl: auth.imageUrl,
    firstName: auth.firstName,
    lastName: auth.lastName,
  };
}

export async function updateProfile(req: { firstName?: string; lastName?: string; imageUrl?: string }) {
  throw new Error("Legacy profile update not implemented - use Clerk user management");
}
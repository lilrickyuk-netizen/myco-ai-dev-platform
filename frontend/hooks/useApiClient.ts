import { useAuth } from "@clerk/clerk-react";
import { useEffect } from "react";
import { apiClient, ApiClient } from "../src/services/api/client";

// Returns the API client with authentication.
export function useApiClient(): ApiClient {
  const { getToken, isSignedIn } = useAuth();
  
  useEffect(() => {
    const updateAuth = async () => {
      if (isSignedIn) {
        try {
          const token = await getToken();
          if (token) {
            apiClient.setAuthToken(token);
          } else {
            apiClient.removeAuthToken();
          }
        } catch (error) {
          console.error('Failed to get auth token:', error);
          apiClient.removeAuthToken();
        }
      } else {
        apiClient.removeAuthToken();
      }
    };
    
    updateAuth();
  }, [isSignedIn, getToken]);
  
  return apiClient;
}
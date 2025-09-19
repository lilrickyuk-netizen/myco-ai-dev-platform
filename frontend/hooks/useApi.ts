import { useAuth } from "@clerk/clerk-react";
import { useEffect, useMemo } from "react";
import { apiClient } from "../src/services/api/client";

/**
 * Hook for accessing the typed API client with automatic authentication
 */
export function useApi() {
  const { getToken, isSignedIn } = useAuth();
  
  const client = useMemo(() => {
    return apiClient;
  }, []);

  useEffect(() => {
    if (isSignedIn) {
      // Set up authentication for all future requests
      getToken().then(token => {
        if (token) {
          client.setAuthToken(token);
        }
      });
    } else {
      client.removeAuthToken();
    }
  }, [isSignedIn, getToken, client]);

  return client;
}
/**
 * Gets the backend URL based on user preference stored in localStorage.
 * Returns local backend (http://localhost:8080) if enabled, otherwise returns the online backend.
 */
export function getBackendUrl(): string {
  // Check if we're in the browser environment
  if (typeof window === "undefined") {
    // Server-side: return the default online backend
    return process.env.NEXT_PUBLIC_API_URL || "https://ai-portal-dev.zetachain.com";
  }

  // Client-side: check localStorage for user preference
  const useLocalBackend = localStorage.getItem("use_local_backend") === "true";

  if (useLocalBackend) {
    return "http://localhost:8080";
  }

  return process.env.NEXT_PUBLIC_API_URL || "https://ai-portal-dev.zetachain.com";
}

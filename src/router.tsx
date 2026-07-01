import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Let our IndexedDB-backed query functions run even when the browser is
        // offline; otherwise React Query can pause before the cache fallback is read.
        networkMode: "always",
        refetchOnWindowFocus: false,
      },
      mutations: {
        // Critical for offline-first writes: mutationFns must execute while
        // offline so they can update IndexedDB and enqueue sync operations.
        networkMode: "always",
        retry: false,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};

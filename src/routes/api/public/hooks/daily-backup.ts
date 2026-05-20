import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/daily-backup")({
  server: {
    handlers: {
      GET: async () => new Response("ok"),
    },
  },
});

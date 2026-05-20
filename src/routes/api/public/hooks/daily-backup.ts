import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const TABLES = ["battalions", "companies", "students", "recitations", "attendance"] as const;

export const Route = createFileRoute("/api/public/hooks/daily-backup")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const payload: Record<string, unknown[]> = {};
          for (const t of TABLES) {
            const { data, error } = await supabaseAdmin.from(t).select("*");
            if (error) throw error;
            payload[t] = data ?? [];
          }

          const { error: insertErr } = await supabaseAdmin
            .from("backups")
            .insert({ kind: "daily", note: "نسخة يومية تلقائية", payload });
          if (insertErr) throw insertErr;

          // Retention: keep last 30 daily backups
          const { data: olds } = await supabaseAdmin
            .from("backups")
            .select("id")
            .eq("kind", "daily")
            .order("created_at", { ascending: false })
            .range(30, 1000);
          if (olds && olds.length > 0) {
            await supabaseAdmin
              .from("backups")
              .delete()
              .in("id", olds.map((o) => o.id));
          }

          return Response.json({ success: true, counts: Object.fromEntries(TABLES.map((t) => [t, payload[t].length])) });
        } catch (e) {
          console.error("daily-backup failed", e);
          return new Response(
            JSON.stringify({ success: false, error: (e as Error).message }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      },
    },
  },
});

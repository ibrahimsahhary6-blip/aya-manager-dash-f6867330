import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

export const inviteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      email: z.string().email().max(255),
      notes: z.string().max(500).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const email = data.email.trim().toLowerCase();

    // 1) add to allowlist (idempotent)
    const { error: allowErr } = await supabaseAdmin
      .from("allowed_emails")
      .upsert(
        { email, invited_by: context.userId, notes: data.notes ?? null },
        { onConflict: "email" },
      );
    if (allowErr) throw new Error(allowErr.message);

    // 2) send invitation via Supabase Auth
    const redirectTo =
      (process.env.SITE_URL as string | undefined) ?? undefined;
    const { error: invErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      redirectTo ? { redirectTo } : undefined,
    );
    // If the user already exists, Supabase returns an error — that's ok, allowlist is updated.
    const alreadyExists =
      invErr?.message?.toLowerCase().includes("already") ?? false;
    if (invErr && !alreadyExists) {
      // Don't fail the whole call — return a soft warning
      return { ok: true, invited: false, warning: invErr.message };
    }

    return { ok: true, invited: !invErr, alreadyExists };
  });

export const notifyFirstLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Mark first_login_at if not set
    const { data: profile, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("first_login_at, first_login_notified, email")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (profile?.first_login_at) return { ok: true, alreadyNotified: true };

    const now = new Date().toISOString();
    await supabaseAdmin
      .from("profiles")
      .update({ first_login_at: now, first_login_notified: true })
      .eq("user_id", context.userId);

    // Read admin notification email (best-effort log)
    const { data: setting } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "notification_email")
      .maybeSingle();

    console.log(
      `[first-login] user=${profile?.email ?? context.userId} at=${now} notify=${setting?.value ?? "(no admin email set)"}`,
    );

    return { ok: true, alreadyNotified: false };
  });

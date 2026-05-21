import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const ok = data?.some((r) => r.role === "admin" || r.role === "super_admin");
  if (!ok) throw new Error("Forbidden: admin only");
}

async function sendMagicOrInvite(email: string, redirectTo?: string) {
  // Try magic link first (works if user already exists)
  const { error: otpErr } = await supabaseAdmin.auth.signInWithOtp({
    email,
    options: redirectTo ? { shouldCreateUser: false, emailRedirectTo: redirectTo } : { shouldCreateUser: false },
  });
  if (!otpErr) return { mode: "magic_link" as const };

  // Fall back to invite (creates auth user + sends confirmation link)
  const { error: invErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
    email,
    redirectTo ? { redirectTo } : undefined,
  );
  if (invErr && !invErr.message.toLowerCase().includes("already")) {
    throw new Error(invErr.message);
  }
  return { mode: "invite" as const };
}

export const submitAccessRequest = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({
      email: z.string().trim().email().max(255),
      fullName: z.string().trim().min(2).max(120),
      redirectTo: z.string().url().optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const email = data.email.toLowerCase();

    // Already approved (profile.is_approved OR in allowed_emails)?
    const [{ data: profile }, { data: allowed }] = await Promise.all([
      supabaseAdmin.from("profiles").select("is_approved").eq("email", email).maybeSingle(),
      supabaseAdmin.from("allowed_emails").select("email").eq("email", email).maybeSingle(),
    ]);

    if (profile?.is_approved || allowed) {
      await sendMagicOrInvite(email, data.redirectTo);
      return { status: "magic_link_sent" as const };
    }

    // Create or refresh pending request
    const { error } = await supabaseAdmin
      .from("access_requests")
      .upsert(
        { email, full_name: data.fullName, status: "pending", requested_at: new Date().toISOString() },
        { onConflict: "email", ignoreDuplicates: false },
      );
    // Unique partial index protects against duplicate pending; ignore if conflict
    if (error && !error.message.toLowerCase().includes("duplicate")) {
      // Try plain insert if upsert failed due to missing constraint
      const { error: insErr } = await supabaseAdmin
        .from("access_requests")
        .insert({ email, full_name: data.fullName, status: "pending" });
      if (insErr && !insErr.message.toLowerCase().includes("duplicate")) {
        throw new Error(insErr.message);
      }
    }

    // Log notification target (admin email)
    const { data: setting } = await supabaseAdmin
      .from("app_settings").select("value").eq("key", "notification_email").maybeSingle();
    console.log(`[access-request] new request from ${email} (${data.fullName}); notify=${setting?.value ?? "(unset)"}`);

    return { status: "pending" as const };
  });

export const listPendingAccessRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("access_requests")
      .select("id, email, full_name, status, requested_at")
      .eq("status", "pending")
      .order("requested_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { requests: data ?? [] };
  });

export const approveAccessRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), redirectTo: z.string().url().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    const { data: req, error: rErr } = await supabaseAdmin
      .from("access_requests").select("*").eq("id", data.id).maybeSingle();
    if (rErr) throw new Error(rErr.message);
    if (!req) throw new Error("Request not found");

    const email = req.email.toLowerCase();

    // Add to allowlist
    const { error: aErr } = await supabaseAdmin
      .from("allowed_emails")
      .upsert(
        { email, invited_by: context.userId, notes: req.full_name },
        { onConflict: "email" },
      );
    if (aErr) throw new Error(aErr.message);

    // Send invite / magic link
    await sendMagicOrInvite(email, data.redirectTo);

    // Mark approved
    await supabaseAdmin
      .from("access_requests")
      .update({
        status: "approved",
        processed_at: new Date().toISOString(),
        processed_by: context.userId,
      })
      .eq("id", data.id);

    return { ok: true };
  });

export const rejectAccessRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("access_requests")
      .update({
        status: "rejected",
        processed_at: new Date().toISOString(),
        processed_by: context.userId,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const requestLoginLink = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({
      email: z.string().trim().email().max(255),
      redirectTo: z.string().url().optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const email = data.email.toLowerCase();
    const [{ data: profile }, { data: allowed }] = await Promise.all([
      supabaseAdmin.from("profiles").select("is_approved").eq("email", email).maybeSingle(),
      supabaseAdmin.from("allowed_emails").select("email").eq("email", email).maybeSingle(),
    ]);
    if (!(profile?.is_approved || allowed)) {
      return { status: "not_approved" as const };
    }
    await sendMagicOrInvite(email, data.redirectTo);
    return { status: "sent" as const };
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertSuperAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: super_admin only");
}

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const ok = data?.some((r) => r.role === "admin" || r.role === "super_admin");
  if (!ok) throw new Error("Forbidden: admin only");
}

export const createPlatformUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      email: z.string().trim().email().max(255),
      password: z.string().min(8).max(100),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const email = data.email.toLowerCase();

    // 1) Allowlist
    const { error: aErr } = await supabaseAdmin
      .from("allowed_emails")
      .upsert(
        { email, invited_by: context.userId, notes: "created_by_admin" },
        { onConflict: "email" },
      );
    if (aErr) throw new Error(aErr.message);

    // 2) Create auth user with password, auto-confirmed
    const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
    });
    if (cErr) {
      const msg = cErr.message.toLowerCase();
      if (msg.includes("already") || msg.includes("registered")) {
        // Update password for existing user
        const { data: list } = await supabaseAdmin.auth.admin.listUsers();
        const existing = list.users.find((u) => u.email?.toLowerCase() === email);
        if (!existing) throw new Error(cErr.message);
        const { error: uErr } = await supabaseAdmin.auth.admin.updateUserById(existing.id, {
          password: data.password,
          email_confirm: true,
        });
        if (uErr) throw new Error(uErr.message);
        await supabaseAdmin
          .from("profiles")
          .update({ is_approved: true, approved_at: new Date().toISOString() })
          .eq("user_id", existing.id);
        return { ok: true, updated: true };
      }
      throw new Error(cErr.message);
    }

    // 3) Approve profile (trigger should have created it)
    if (created?.user) {
      await supabaseAdmin
        .from("profiles")
        .update({ is_approved: true, approved_at: new Date().toISOString() })
        .eq("user_id", created.user.id);
    }

    return { ok: true, updated: false };
  });

export const inviteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      email: z.string().email().max(255),
      notes: z.string().max(500).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
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

const ROLE_VALUES = ["admin", "moderator", "viewer", "user"] as const;

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      targetUserId: z.string().uuid(),
      role: z.enum(ROLE_VALUES),
      departmentId: z.string().uuid().nullable().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);

    // Block changing a super_admin's role from the UI
    const { data: existing } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.targetUserId);
    if (existing?.some((r) => r.role === "super_admin")) {
      throw new Error("لا يمكن تعديل صلاحية المدير العام من الواجهة");
    }

    // Replace non-super_admin roles
    const { error: delErr } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.targetUserId)
      .neq("role", "super_admin");
    if (delErr) throw new Error(delErr.message);

    const { error: insErr } = await supabaseAdmin
      .from("user_roles")
      .insert({
        user_id: data.targetUserId,
        role: data.role,
        department_id: data.departmentId ?? null,
      } as never);
    if (insErr) throw new Error(insErr.message);

    return { ok: true };
  });

export const setUserApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      targetUserId: z.string().uuid(),
      approved: z.boolean(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        is_approved: data.approved,
        approved_at: data.approved ? new Date().toISOString() : null,
      })
      .eq("user_id", data.targetUserId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


export const removePlatformUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ targetUserId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    if (data.targetUserId === context.userId) {
      throw new Error("لا يمكنك إزالة حسابك");
    }

    // Reject if target is super_admin
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.targetUserId);
    if (roles?.some((r) => r.role === "super_admin")) {
      throw new Error("لا يمكن إزالة حساب المدير العام");
    }

    // Fetch email
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("user_id", data.targetUserId)
      .maybeSingle();

    // Remove from allowlist (by email)
    if (profile?.email) {
      await supabaseAdmin.from("allowed_emails").delete().eq("email", profile.email);
    }
    // Remove roles
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.targetUserId);
    // Remove profile
    await supabaseAdmin.from("profiles").delete().eq("user_id", data.targetUserId);
    // Remove auth user
    const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(data.targetUserId);
    if (authErr) {
      // Log a soft error in audit but don't fail hard
      await supabaseAdmin.from("audit_log").insert({
        actor_id: context.userId,
        action: "user_removed_auth_error",
        target_user_id: data.targetUserId,
        target_email: profile?.email,
        metadata: { error: authErr.message },
      });
    }

    return { ok: true };
  });

export const transferSuperAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      targetEmail: z.string().email().max(255),
      confirmEmail: z.string().email().max(255),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);

    const target = data.targetEmail.trim().toLowerCase();
    const confirm = data.confirmEmail.trim().toLowerCase();
    if (target !== confirm) {
      throw new Error("الإيميل المُدخل للتأكيد لا يطابق");
    }

    // Find target user by email
    const { data: targetProfile, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("user_id, email")
      .ilike("email", target)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!targetProfile) {
      throw new Error("لا يوجد مستخدم بهذا الإيميل. يجب أن يسجّل دخول مرة واحدة أولاً");
    }
    if (targetProfile.user_id === context.userId) {
      throw new Error("أنت المدير العام بالفعل");
    }

    // 1) Grant super_admin to target
    const { error: insErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: targetProfile.user_id, role: "super_admin" });
    if (insErr && !insErr.message.toLowerCase().includes("duplicate")) {
      throw new Error(insErr.message);
    }

    // 2) Ensure target profile is approved
    await supabaseAdmin
      .from("profiles")
      .update({ is_approved: true, approved_at: new Date().toISOString() })
      .eq("user_id", targetProfile.user_id);

    // 3) Remove super_admin from current user, demote to admin
    const { error: delErr } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", context.userId)
      .eq("role", "super_admin");
    if (delErr) throw new Error(delErr.message);

    await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: context.userId, role: "admin" });

    // Audit
    await supabaseAdmin.from("audit_log").insert({
      actor_id: context.userId,
      action: "super_admin_transferred",
      target_user_id: targetProfile.user_id,
      target_email: targetProfile.email,
    });

    return { ok: true, newSuperAdminEmail: targetProfile.email };
  });


import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCachedQuery } from "@/lib/local-cache";

function readInitialUserId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("offline-auth-session-v1");
    if (raw) {
      const s = JSON.parse(raw);
      if (s?.user?.id) return s.user.id;
    }
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i) ?? "";
      if (!k.startsWith("sb-") || !k.endsWith("-auth-token")) continue;
      const s = JSON.parse(window.localStorage.getItem(k) ?? "null");
      if (s?.user?.id) return s.user.id;
    }
  } catch {
    // ignore
  }
  return null;
}

export function useCurrentUserId() {
  const [userId, setUserId] = useState<string | null>(() => readInitialUserId());
  const [isLoading, setIsLoading] = useState(false);
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setUserId(data.session?.user?.id ?? null);
      setIsLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) =>
      {
        setUserId(s?.user?.id ?? null);
        setIsLoading(false);
      },
    );
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);
  return { userId, isLoading };
}

function useIsAdminQuery() {
  const { userId, isLoading: isUserLoading } = useCurrentUserId();
  return useCachedQuery<boolean>({
    queryKey: ["is-admin", userId],
    queryFn: async () => {
      if (!userId) return false;
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .limit(1);
      if (error) {
        console.error("[useIsAdmin]", error);
        throw error;
      }
      return (data ?? []).length > 0;
    },
    enabled: !isUserLoading && !!userId,
  });
}

export function useIsAdmin() {
  return useIsAdminQuery().data === true;
}

function useIsSuperAdminQuery() {
  const { userId, isLoading: isUserLoading } = useCurrentUserId();
  return useCachedQuery<boolean>({
    queryKey: ["is-super-admin", userId],
    queryFn: async () => {
      if (!userId) return false;
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "super_admin")
        .limit(1);
      if (error) {
        console.error("[useIsSuperAdmin]", error);
        throw error;
      }
      return (data ?? []).length > 0;
    },
    enabled: !isUserLoading && !!userId,
  });
}

export function useIsSuperAdmin() {
  return useIsSuperAdminQuery().data === true;
}

/**
 * Admin-gate helper: returns { allowed, isLoading } so route guards can wait
 * for the role queries to settle instead of redirecting on the initial
 * `false` value.
 */
export function useAdminAccess() {
  const adminQ = useIsAdminQuery();
  const superQ = useIsSuperAdminQuery();
  const allowed = adminQ.data === true || superQ.data === true;
  return {
    allowed,
    isLoading:
      !allowed &&
      (adminQ.isLoading ||
        adminQ.isPending ||
        adminQ.isFetching ||
        superQ.isLoading ||
        superQ.isPending ||
        superQ.isFetching),
  };
}


export function usePermissionFlag(key: "admins_can_manage_students" | "users_can_manage_students") {
  return useCachedQuery<boolean>({
    queryKey: ["setting", key],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", key)
        .maybeSingle();
      if (error) {
        console.error(`[setting ${key}]`, error);
        throw error;
      }
      return data?.value === "true";
    },
  });
}

export function useAdminsCanManageStudentsSetting() {
  return usePermissionFlag("admins_can_manage_students");
}

export function useUsersCanManageStudentsSetting() {
  return usePermissionFlag("users_can_manage_students");
}

export function useCanManageStudents() {
  const isAdmin = useIsAdmin();
  const isSuper = useIsSuperAdmin();
  const { data: adminFlag } = useAdminsCanManageStudentsSetting();
  const { data: userFlag } = useUsersCanManageStudentsSetting();
  if (isSuper) return true;
  if (isAdmin && adminFlag) return true;
  if (userFlag) return true;
  return false;
}

/**
 * Returns the list of department ids the current user can access.
 * `null` means "all departments" (super_admin or globally-scoped admin).
 * `[]` means the user has no department access (regular user).
 */
export function useUserDepartmentAccess() {
  const { userId, isLoading: isUserLoading } = useCurrentUserId();
  const isSuper = useIsSuperAdmin();
  const q = useCachedQuery<{ allowedIds: string[]; all: boolean }>({
    queryKey: ["user-department-access", userId],
    queryFn: async () => {
      if (!userId) return { allowedIds: [] as string[], all: false };
      const { data, error } = await supabase
        .from("user_roles")
        .select("role, department_id")
        .eq("user_id", userId);
      if (error) {
        console.error("[useUserDepartmentAccess]", error);
        throw error;
      }
      const rows = (data ?? []) as Array<{ role: string; department_id: string | null }>;
      const adminRows = rows.filter(
        (r) => r.role === "admin" || r.role === "moderator" || r.role === "super_admin",
      );
      const hasGlobalAdmin = adminRows.some((r) => r.department_id === null);
      if (hasGlobalAdmin) return { allowedIds: [] as string[], all: true };
      const ids = Array.from(
        new Set(rows.map((r) => r.department_id).filter((x): x is string => !!x)),
      );
      return { allowedIds: ids, all: false };
    },
    enabled: !isUserLoading && !!userId,
  });
  if (isSuper) return { allowedIds: [] as string[], all: true, isLoading: false };
  return {
    allowedIds: q.data?.allowedIds ?? [],
    all: q.data?.all ?? false,
    isLoading: q.isLoading,
  };
}


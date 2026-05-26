import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useCurrentUserId() {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) =>
      setUserId(s?.user?.id ?? null),
    );
    return () => subscription.unsubscribe();
  }, []);
  return userId;
}

export function useIsAdmin() {
  const userId = useCurrentUserId();
  const q = useQuery({
    queryKey: ["is-admin", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return false;
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      if (error) {
        console.error("[useIsAdmin]", error);
        return false;
      }
      return !!data;
    },
  });
  return q.data === true;
}

export function useIsSuperAdmin() {
  const userId = useCurrentUserId();
  const q = useQuery({
    queryKey: ["is-super-admin", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return false;
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "super_admin")
        .maybeSingle();
      if (error) {
        console.error("[useIsSuperAdmin]", error);
        return false;
      }
      return !!data;
    },
  });
  return q.data === true;
}

export function usePermissionFlag(key: "admins_can_manage_students" | "users_can_manage_students") {
  return useQuery({
    queryKey: ["setting", key],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", key)
        .maybeSingle();
      if (error) {
        console.error(`[setting ${key}]`, error);
        return false;
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

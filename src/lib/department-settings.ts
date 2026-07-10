import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCachedQuery } from "@/lib/local-cache";
import { useBattalions } from "@/lib/orgs";

export type DepartmentSetting = {
  department_id: string;
  admins_can_manage_students: boolean | null;
  users_can_manage_students: boolean | null;
  extra_juz_enabled: boolean;
};

export function useDepartmentSettings() {
  return useCachedQuery<DepartmentSetting[]>({
    queryKey: ["department_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("department_settings")
        .select("department_id, admins_can_manage_students, users_can_manage_students, extra_juz_enabled");
      if (error) throw error;
      return (data ?? []) as DepartmentSetting[];
    },
  });
}

export function useDepartmentSetting(departmentId: string | null | undefined) {
  const { data = [] } = useDepartmentSettings();
  return data.find((s) => s.department_id === departmentId) ?? null;
}

export function useUpsertDepartmentSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<DepartmentSetting> & { department_id: string }) => {
      const { data: existing } = await supabase
        .from("department_settings")
        .select("*")
        .eq("department_id", patch.department_id)
        .maybeSingle();
      const row = {
        department_id: patch.department_id,
        admins_can_manage_students:
          patch.admins_can_manage_students !== undefined
            ? patch.admins_can_manage_students
            : (existing?.admins_can_manage_students ?? null),
        users_can_manage_students:
          patch.users_can_manage_students !== undefined
            ? patch.users_can_manage_students
            : (existing?.users_can_manage_students ?? null),
        extra_juz_enabled:
          patch.extra_juz_enabled !== undefined
            ? patch.extra_juz_enabled
            : (existing?.extra_juz_enabled ?? true),
      };
      const { error } = await supabase
        .from("department_settings")
        .upsert(row, { onConflict: "department_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["department_settings"] });
    },
  });
}

/** Resolve extra_juz_enabled for a student's department (via battalion). Defaults to true. */
export function useStudentDepartmentExtraJuzEnabled(battalionId: string | null | undefined) {
  const { data: battalions = [] } = useBattalions();
  const { data: settings = [] } = useDepartmentSettings();
  if (!battalionId) return true;
  const dept = battalions.find((b) => b.id === battalionId)?.department_id;
  if (!dept) return true;
  const s = settings.find((x) => x.department_id === dept);
  return s?.extra_juz_enabled ?? true;
}

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Search } from "lucide-react";
import { useIsAdmin, useIsSuperAdmin } from "@/lib/roles";
import { getErrorMessage } from "@/lib/errors";
import { normalizeArabic } from "@/lib/normalize";
import { useDepartments, useBattalions } from "@/lib/orgs";
import {
  useDepartmentSettings,
  useUpsertDepartmentSetting,
} from "@/lib/department-settings";

type StudentRow = {
  id: string;
  full_name: string;
  student_code: string | null;
  extra_juz: number[] | null;
  battalion_id: string | null;
};

export function StudentJuzManagerCard() {
  const isAdmin = useIsAdmin();
  const isSuper = useIsSuperAdmin();
  const qc = useQueryClient();
  const [q, setQ] = useState("");

  const { data: departments = [] } = useDepartments();
  const { data: battalions = [] } = useBattalions();
  const { data: deptSettings = [] } = useDepartmentSettings();
  const upsertDept = useUpsertDepartmentSetting();
  void isAdmin;


  const battalionDept = useMemo(() => {
    const m = new Map<string, string>();
    battalions.forEach((b) => m.set(b.id, b.department_id));
    return m;
  }, [battalions]);

  const deptExtraEnabled = (departmentId: string | null | undefined) => {
    if (!departmentId) return true;
    const s = deptSettings.find((x) => x.department_id === departmentId);
    return s?.extra_juz_enabled ?? true;
  };

  const { data: students = [], isLoading } = useQuery({
    queryKey: ["students-juz-manager"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, full_name, student_code, extra_juz, battalion_id")
        .is("deleted_at", null)
        .order("full_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as StudentRow[];
    },
    enabled: true,
  });

  const filtered = useMemo(() => {
    const term = normalizeArabic(q.trim());
    if (!term) return students.slice(0, 0);
    return students
      .filter((s) => {
        const name = normalizeArabic(s.full_name);
        const code = (s.student_code ?? "").toLowerCase();
        return name.includes(term) || code.includes(term.toLowerCase());
      })
      .slice(0, 20);
  }, [q, students]);

  const mutation = useMutation({
    mutationFn: async ({ id, extra_juz }: { id: string; extra_juz: number[] }) => {
      const { error } = await supabase.from("students").update({ extra_juz }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success("تم تحديث الأجزاء المتاحة");
      qc.setQueryData<StudentRow[]>(["students-juz-manager"], (old) =>
        (old ?? []).map((s) => (s.id === vars.id ? { ...s, extra_juz: vars.extra_juz } : s)),
      );
      qc.invalidateQueries({ queryKey: ["student", vars.id] });
    },
    onError: (e: Error) => toast.error(getErrorMessage(e)),
  });

  const toggle = (s: StudentRow, juz: 28 | 29, enabled: boolean) => {
    const current = s.extra_juz ?? [];
    const next = enabled
      ? Array.from(new Set([...current, juz])).sort()
      : current.filter((j) => j !== juz);
    mutation.mutate({ id: s.id, extra_juz: next });
  };

  

  return (
    <section className="rounded-2xl border bg-card p-5 shadow-soft" dir="rtl">
      <div className="flex items-start gap-3 mb-4">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <BookOpen className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h2 className="font-bold text-sm sm:text-base">الأجزاء المتاحة للتسميع</h2>
          <p className="text-xs text-muted-foreground mt-1">
            فعّل ميزة الأجزاء الإضافية (28/29) لكل قسم، ثم اختر الطلاب المستفيدين. جزء عمّ (30) مفعّل دائماً.
          </p>
        </div>
      </div>

      {/* Department toggles — super_admin only */}
      {isSuper && departments.length > 0 && (
        <div className="mb-4 rounded-xl border bg-muted/30 p-3">
          <div className="text-xs font-semibold mb-2">تفعيل الميزة لكل قسم</div>
          <ul className="grid gap-2">
            {departments.map((d) => {
              const enabled = deptExtraEnabled(d.id);
              return (
                <li
                  key={d.id}
                  className="flex items-center justify-between rounded-lg bg-background border px-3 py-2"
                >
                  <span className="text-xs">{d.name}</span>
                  <Switch
                    checked={enabled}
                    disabled={upsertDept.isPending}
                    onCheckedChange={(v) =>
                      upsertDept
                        .mutateAsync({ department_id: d.id, extra_juz_enabled: v })
                        .then(() => toast.success("تم التحديث"))
                        .catch((e) => toast.error(getErrorMessage(e as Error)))
                    }
                  />
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="relative mb-3">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ابحث باسم الطالب أو رقمه..."
          className="pr-9"
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-4 text-center">جارٍ التحميل...</p>
      ) : !q.trim() ? (
        <p className="text-xs text-muted-foreground py-3 text-center">
          اكتب اسم الطالب لعرض النتائج
        </p>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-muted-foreground py-3 text-center">لا توجد نتائج</p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((s) => {
            const has28 = (s.extra_juz ?? []).includes(28);
            const has29 = (s.extra_juz ?? []).includes(29);
            const deptId = s.battalion_id ? battalionDept.get(s.battalion_id) : undefined;
            const enabledForDept = deptExtraEnabled(deptId);
            return (
              <li
                key={s.id}
                className="rounded-xl border bg-muted/30 p-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate">{s.full_name}</div>
                  {s.student_code && (
                    <Badge variant="outline" className="mt-1 font-mono text-[10px]">
                      {s.student_code}
                    </Badge>
                  )}
                </div>
                {enabledForDept ? (
                  <div className="flex flex-wrap gap-2">
                    <label className="flex items-center gap-2 text-xs border rounded-md px-2.5 py-1.5 bg-background">
                      <Switch
                        checked={has29}
                        onCheckedChange={(v) => toggle(s, 29, v)}
                        disabled={mutation.isPending}
                      />
                      <span>تبارك (29)</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs border rounded-md px-2.5 py-1.5 bg-background">
                      <Switch
                        checked={has28}
                        onCheckedChange={(v) => toggle(s, 28, v)}
                        disabled={mutation.isPending}
                      />
                      <span>قد سمع (28)</span>
                    </label>
                  </div>
                ) : (
                  <span className="text-[11px] text-muted-foreground">
                    الميزة معطّلة لقسم هذا الطالب
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

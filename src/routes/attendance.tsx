import { getErrorMessage } from "@/lib/errors";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { ArrowRight, Users, UserCheck, UserX, Percent, ClipboardCheck, FileWarning, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBattalions, useCompanies } from "@/lib/orgs";
import { BrandLogo } from "@/components/BrandLogo";

type Student = Tables<"students">;
type Attendance = Tables<"attendance">;

export const Route = createFileRoute("/attendance")({
  component: AttendancePage,
});

function AttendancePage() {
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);

  const [date, setDate] = useState(today);
  const [battalionId, setBattalionId] = useState<string>("all");
  const [companyId, setCompanyId] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data: battalions = [] } = useBattalions();
  const { data: companies = [] } = useCompanies();

  const availableCompanies = useMemo(
    () =>
      battalionId === "all"
        ? companies
        : companies.filter((c) => c.battalion_id === battalionId),
    [companies, battalionId],
  );

  const { data: students = [], isLoading: studentsLoading } = useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .order("full_name");
      if (error) throw error;
      return data as Student[];
    },
  });

  const normalizedSearch = search.trim().toLowerCase();
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      if (battalionId !== "all" && s.battalion_id !== battalionId) return false;
      if (companyId !== "all" && s.company_id !== companyId) return false;
      if (
        normalizedSearch &&
        !s.full_name.toLowerCase().includes(normalizedSearch) &&
        !s.student_code.toLowerCase().includes(normalizedSearch)
      ) {
        return false;
      }
      return true;
    });
  }, [students, battalionId, companyId, normalizedSearch]);

  const { data: attendance = [] } = useQuery({
    queryKey: ["attendance", date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("attended_on", date);
      if (error) throw error;
      return data as Attendance[];
    },
  });

  const { data: dayRecitations = [] } = useQuery({
    queryKey: ["recitations-by-day", date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recitations")
        .select("student_id")
        .eq("recited_on", date);
      if (error) throw error;
      return data as { student_id: string }[];
    },
  });

  const attendanceMap = useMemo(() => {
    const map = new Map<string, Attendance>();
    attendance.forEach((a) => map.set(a.student_id, a));
    return map;
  }, [attendance]);

  const recitedSet = useMemo(
    () => new Set(dayRecitations.map((r) => r.student_id)),
    [dayRecitations],
  );

  type AttStatus = "present" | "absent" | "excused";
  const getStudentStatus = (studentId: string): AttStatus => {
    const rec = attendanceMap.get(studentId);
    if (rec) {
      if (rec.excused) return "excused";
      return rec.present ? "present" : "absent";
    }
    return recitedSet.has(studentId) ? "present" : "absent";
  };

  const isStudentPresent = (studentId: string) => getStudentStatus(studentId) === "present";

  const setStatusMutation = useMutation({
    mutationFn: async ({
      studentId,
      status,
      rating,
    }: {
      studentId: string;
      status: AttStatus;
      rating?: string | null;
    }) => {
      const payload = {
        student_id: studentId,
        attended_on: date,
        present: status === "present",
        excused: status === "excused",
        ...(rating !== undefined ? { rating } : {}),
      };
      const { error } = await supabase
        .from("attendance")
        .upsert(payload, { onConflict: "student_id,attended_on" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance", date] });
    },
    onError: (e: Error) => toast.error(getErrorMessage(e)),
  });

  const total = filteredStudents.length;
  const present = filteredStudents.filter((s) => getStudentStatus(s.id) === "present").length;
  const excused = filteredStudents.filter((s) => getStudentStatus(s.id) === "excused").length;
  const absent = total - present - excused;
  const percent = total === 0 ? 0 : Math.round((present / total) * 100);


  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/60 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
          <Button asChild variant="ghost" size="sm" className="gap-2">
            <Link to="/">
              <ArrowRight className="h-4 w-4" />
              <span>العودة</span>
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <BrandLogo size="sm" />
            <span className="font-bold text-sm sm:text-base text-primary">سجل الحضور والغياب</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* Filters */}
        <section className="bg-card rounded-2xl border p-4 shadow-soft">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="att-date">التاريخ</Label>
              <Input
                id="att-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>الكتيبة</Label>
              <Select
                value={battalionId}
                onValueChange={(v) => {
                  setBattalionId(v);
                  setCompanyId("all");
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الكتائب</SelectItem>
                  {battalions.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>السرية</Label>
              <Select value={companyId} onValueChange={setCompanyId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل السرايا</SelectItem>
                  {availableCompanies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <StatBox
            icon={<Users className="h-5 w-5" />}
            label="إجمالي الطلاب"
            value={total}
            tone="muted"
          />
          <StatBox
            icon={<UserCheck className="h-5 w-5" />}
            label="الحاضرون"
            value={present}
            tone="primary"
          />
          <StatBox
            icon={<UserX className="h-5 w-5" />}
            label="الغائبون"
            value={absent}
            tone="destructive"
          />
          <StatBox
            icon={<Percent className="h-5 w-5" />}
            label="نسبة الحضور"
            value={`${percent}%`}
            tone="success"
          />
        </section>

        {/* Hierarchical Students by Battalion → Company */}
        {studentsLoading ? (
          <section className="bg-card rounded-2xl border shadow-soft p-12 text-center text-muted-foreground">
            جارٍ التحميل...
          </section>
        ) : filteredStudents.length === 0 ? (
          <section className="bg-card rounded-2xl border shadow-soft p-12 text-center text-muted-foreground">
            لا يوجد طلاب لعرضهم.
          </section>
        ) : (
          <div className="space-y-6">
            {battalions
              .filter((b) => battalionId === "all" || b.id === battalionId)
              .map((b) => {
                const battStudents = filteredStudents.filter(
                  (s) => s.battalion_id === b.id,
                );
                const battCompanies = companies.filter(
                  (c) => c.battalion_id === b.id,
                );
                const unassigned = battStudents.filter((s) => !s.company_id);
                if (battStudents.length === 0) return null;
                const bPresent = battStudents.filter((s) =>
                  isStudentPresent(s.id),
                ).length;
                return (
                  <section
                    key={b.id}
                    className="bg-card rounded-2xl border shadow-soft overflow-hidden"
                  >
                    <header className="px-4 py-3 bg-primary/10 border-b flex items-center justify-between gap-2">
                      <h2 className="font-bold text-base text-primary">
                        كتيبة: {b.name}
                      </h2>
                      <span className="text-xs font-medium text-primary/80">
                        {bPresent}/{battStudents.length} حاضر
                      </span>
                    </header>
                    <div className="divide-y">
                      {battCompanies
                        .filter(
                          (c) => companyId === "all" || c.id === companyId,
                        )
                        .map((c) => {
                          const compStudents = battStudents.filter(
                            (s) => s.company_id === c.id,
                          );
                          if (compStudents.length === 0) return null;
                          const cPresent = compStudents.filter((s) =>
                            isStudentPresent(s.id),
                          ).length;
                          return (
                            <CompanyGroup
                              key={c.id}
                              title={`سرية: ${c.name}`}
                              students={compStudents}
                              presentCount={cPresent}
                              attendanceMap={attendanceMap}
                              recitedSet={recitedSet}
                              onToggle={(id, v, rating) =>
                                toggleMutation.mutate({
                                  studentId: id,
                                  present: v,
                                  rating,
                                })
                              }
                            />
                          );
                        })}
                      {unassigned.length > 0 && companyId === "all" && (
                        <CompanyGroup
                          title="بدون سرية"
                          students={unassigned}
                          presentCount={
                            unassigned.filter((s) => isStudentPresent(s.id))
                              .length
                          }
                          attendanceMap={attendanceMap}
                          recitedSet={recitedSet}
                          onToggle={(id, v, rating) =>
                            toggleMutation.mutate({
                              studentId: id,
                              present: v,
                              rating,
                            })
                          }
                        />
                      )}
                    </div>
                  </section>
                );
              })}
            {(() => {
              const noBatt = filteredStudents.filter((s) => !s.battalion_id);
              if (noBatt.length === 0 || battalionId !== "all") return null;
              return (
                <section className="bg-card rounded-2xl border shadow-soft overflow-hidden">
                  <header className="px-4 py-3 bg-muted border-b">
                    <h2 className="font-bold text-base">بدون كتيبة</h2>
                  </header>
                  <CompanyGroup
                    title="غير مصنّف"
                    students={noBatt}
                    presentCount={
                      noBatt.filter((s) => isStudentPresent(s.id)).length
                    }
                    attendanceMap={attendanceMap}
                    recitedSet={recitedSet}
                    onToggle={(id, v, rating) =>
                      toggleMutation.mutate({ studentId: id, present: v, rating })
                    }
                  />
                </section>
              );
            })()}
          </div>
        )}
      </main>
    </div>
  );
}

function CompanyGroup({
  title,
  students,
  presentCount,
  attendanceMap,
  recitedSet,
  onToggle,
}: {
  title: string;
  students: Student[];
  presentCount: number;
  attendanceMap: Map<string, Attendance>;
  recitedSet: Set<string>;
  onToggle: (
    id: string,
    v: boolean,
    rating?: string | null,
  ) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-accent/40 hover:bg-accent/60 transition-colors text-right"
      >
        <span className="font-semibold text-sm">{title}</span>
        <span className="text-xs text-muted-foreground">
          {presentCount}/{students.length} {open ? "▾" : "▸"}
        </span>
      </button>
      {open && (
        <ul className="divide-y">
          {students.map((s) => {
            const rec = attendanceMap.get(s.id);
            const recited = recitedSet.has(s.id);
            const isPresent = rec ? rec.present : recited;
            const auto = !rec && recited;
            const rating = (rec as (Attendance & { rating?: string | null }) | undefined)?.rating ?? "";
            return (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-accent/20"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className={`h-9 w-9 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${
                      isPresent
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {s.full_name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{s.full_name}</div>
                    <div className="text-xs font-mono text-muted-foreground">
                      {s.student_code}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Select
                    value={rating || "none"}
                    onValueChange={(v) => {
                      if (v === "repeat") {
                        toast.warning(`${s.full_name}: تم تسجيل "إعادة" — لن تُحتسب ضمن معدّل الإتقان.`);
                        onToggle(s.id, isPresent, "repeat");
                      } else if (v === "none") {
                        onToggle(s.id, isPresent, null);
                      } else {
                        // 8 / 9 / 10 → اعتبار الطالب حاضراً تلقائياً
                        onToggle(s.id, true, v);
                      }
                    }}
                  >
                    <SelectTrigger className="h-8 w-24 text-xs">
                      <SelectValue placeholder="التقييم" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— تقييم —</SelectItem>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="9">9</SelectItem>
                      <SelectItem value="8">8</SelectItem>
                      <SelectItem value="repeat">إعادة</SelectItem>
                    </SelectContent>
                  </Select>
                  {auto && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
                      تلقائي
                    </span>
                  )}
                  <span
                    className={`text-xs font-medium ${
                      isPresent ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {isPresent ? "حاضر" : "غائب"}
                  </span>
                  <Switch
                    checked={isPresent}
                    onCheckedChange={(v) => onToggle(s.id, v)}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function StatBox({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  tone: "muted" | "primary" | "destructive" | "success";
}) {
  const tones: Record<string, string> = {
    muted: "bg-card",
    primary: "bg-primary text-primary-foreground",
    destructive: "bg-destructive/10 border-destructive/30 text-destructive",
    success: "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400",
  };
  const iconTones: Record<string, string> = {
    muted: "bg-primary/10 text-primary",
    primary: "bg-primary-foreground/15 text-primary-foreground",
    destructive: "bg-destructive/15 text-destructive",
    success: "bg-emerald-500/15",
  };
  return (
    <div className={`rounded-2xl border p-4 shadow-soft ${tones[tone]}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium opacity-80">{label}</span>
        <div
          className={`h-8 w-8 rounded-lg flex items-center justify-center ${iconTones[tone]}`}
        >
          {icon}
        </div>
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  );
}

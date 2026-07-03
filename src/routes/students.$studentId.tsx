import { getErrorMessage } from "@/lib/errors";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { readCache, useCachedQuery, writeCache } from "@/lib/local-cache";
import { runOrQueue } from "@/lib/offline-queue";
import {
  ArrowRight,
  BookOpen,
  Plus,
  Pencil,
  Trash2,
  Calendar as CalendarIcon,
  ScrollText,
  Printer,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSurahByName, getSurahsForStudent } from "@/lib/quran";
import { Switch } from "@/components/ui/switch";

import { Button } from "@/components/ui/button";
import { BrandLogo, BRAND_LOGO_URL, BRAND_NAME } from "@/components/BrandLogo";
import { OfflineSyncButton } from "@/components/OfflineSyncButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useBattalions, useCompanies } from "@/lib/orgs";
import { useCurrentUserId, useIsAdmin, useIsSuperAdmin } from "@/lib/roles";
import {
  compareReportDates,
  formatArabicReportDate,
  formatRecitationRating,
  validateStudentReportData,
} from "@/lib/reportService";

type Student = Tables<"students">;
type Recitation = Tables<"recitations">;
type Attendance = Tables<"attendance">;

export const Route = createFileRoute("/students/$studentId")({
  component: StudentProfilePage,
});

function StudentProfilePage() {
  const { studentId } = Route.useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const { userId: currentUserId } = useCurrentUserId();
  const isAdmin = useIsAdmin();
  const isSuper = useIsSuperAdmin();
  const isManager = isAdmin || isSuper;
  const canDeleteRecitation = (r: Recitation) => {
    if (isManager) return true;
    const createdBy = (r as Recitation & { created_by?: string | null }).created_by;
    if (!currentUserId || createdBy !== currentUserId) return false;
    return Date.now() - new Date(r.created_at).getTime() < 24 * 60 * 60 * 1000;
  };
  const goBack = () => {
    if (window.history.length > 1) router.history.back();
    else router.navigate({ to: "/" });
  };

  const { data: battalions = [] } = useBattalions();
  const { data: companies = [] } = useCompanies();

  const { data: student, isLoading } = useCachedQuery<Student | null>({
    queryKey: ["student", studentId],
    queryFn: async () => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        const cachedRows = (qc.getQueryData<Student[]>(["students"]) ?? (await readCache<Student[]>(["students"]))) ?? [];
        const cachedStudent = cachedRows.find((s) => s.id === studentId) ?? null;
        if (cachedStudent) return cachedStudent;
      }
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("id", studentId)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        writeCache(["student", studentId], data as Student).catch(() => undefined);
        const rows = qc.getQueryData<Student[]>(["students"]) ?? [];
        const nextRows = rows.some((s) => s.id === studentId)
          ? rows.map((s) => (s.id === studentId ? (data as Student) : s))
          : [data as Student, ...rows];
        qc.setQueryData(["students"], nextRows);
        writeCache(["students"], nextRows).catch(() => undefined);
      }
      return data as Student | null;
    },
  });

  const { data: recitations = [] } = useCachedQuery<Recitation[]>({
    queryKey: ["recitations", studentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recitations")
        .select("*")
        .eq("student_id", studentId)
        .order("recited_on", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      writeCache(["recitations", studentId], data as Recitation[]).catch(() => undefined);
      return data as Recitation[];
    },
  });

  const patchRecitationsCache = (mutator: (rows: Recitation[]) => Recitation[]) => {
    const current = (qc.getQueryData<Recitation[]>(["recitations", studentId]) ?? []) as Recitation[];
    const next = mutator(current);
    qc.setQueryData(["recitations", studentId], next);
    writeCache(["recitations", studentId], next).catch(() => undefined);
  };

  const patchStudentsCache = (mutator: (rows: Student[]) => Student[]) => {
    const current = (qc.getQueryData<Student[]>(["students"]) ?? []) as Student[];
    const next = mutator(current);
    qc.setQueryData(["students"], next);
    writeCache(["students"], next).catch(() => undefined);
  };

  const markLocalPresent = (day: string) => {
    const nowIso = new Date().toISOString();
    const attendanceKey = ["attendance", day] as const;
    const currentAttendance = (qc.getQueryData<Attendance[]>(attendanceKey) ?? []) as Attendance[];
    const existing = currentAttendance.find((a) => a.student_id === studentId);
    const nextAttendance = existing
      ? currentAttendance.map((a) =>
          a.student_id === studentId
            ? ({ ...a, present: true, excused: false, updated_at: nowIso } as Attendance)
            : a,
        )
      : [
          {
            id: `tmp_${studentId}_${day}`,
            student_id: studentId,
            attended_on: day,
            present: true,
            excused: false,
            rating: null,
            created_by: currentUserId,
            created_at: nowIso,
            updated_at: nowIso,
          } as Attendance,
          ...currentAttendance,
        ];
    qc.setQueryData(attendanceKey, nextAttendance);
    writeCache(attendanceKey, nextAttendance).catch(() => undefined);

    const recitationDayKey = ["recitations-by-day", day] as const;
    const currentDayRecitations =
      (qc.getQueryData<{ student_id: string }[]>(recitationDayKey) ?? []) as { student_id: string }[];
    const nextDayRecitations = currentDayRecitations.some((r) => r.student_id === studentId)
      ? currentDayRecitations
      : [{ student_id: studentId }, ...currentDayRecitations];
    qc.setQueryData(recitationDayKey, nextDayRecitations);
    writeCache(recitationDayKey, nextDayRecitations).catch(() => undefined);
  };

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      readCache<Student[]>(["students"]).then((rows) => {
        if (cancelled || student || !rows) return;
        const cached = rows.find((s) => s.id === studentId);
        if (cached) qc.setQueryData(["student", studentId], cached);
      }),
      readCache<Recitation[]>(["recitations", studentId]).then((cached) => {
        if (cancelled || !cached) return;
        const existing = qc.getQueryData<Recitation[]>(["recitations", studentId]);
        if (!existing || existing.length === 0) qc.setQueryData(["recitations", studentId], cached);
      }),
    ]).finally(() => {
      if (!cancelled) setLocalStudentCheckKey(studentId);
    });
    return () => {
      cancelled = true;
    };
  }, [qc, student, studentId]);

  // Cumulative recitation rating from recitations (per-surah)
  const ratingStats = (() => {
    const rows = (recitations as (Recitation & { rating?: string | null })[]) ?? [];
    const scored = rows
      .map((r) => (r.rating && /^(8|9|10)$/.test(r.rating) ? Number(r.rating) : null))
      .filter((n): n is number => n !== null);
    const repeats = rows.filter((r) => r.rating === "repeat").length;
    const avg = scored.length ? scored.reduce((a, b) => a + b, 0) / scored.length : null;
    return { avg, count: scored.length, repeats };
  })();

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Recitation | null>(null);
  const [deleting, setDeleting] = useState<Recitation | null>(null);
  const [exporting, setExporting] = useState(false);
  const [localStudentCheckKey, setLocalStudentCheckKey] = useState<string | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  // Export date-range dialog
  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  const monthAgoStr = (() => {
    const d = new Date(Date.now() - 30 * 86400000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFrom, setExportFrom] = useState(monthAgoStr);
  const [exportTo, setExportTo] = useState(todayStr);
  const [exportRange, setExportRange] = useState<{ from: string; to: string } | null>(null);

  const filteredForExport = exportRange
    ? recitations.filter(
        (r) => r.recited_on >= exportRange.from && r.recited_on <= exportRange.to,
      )
    : recitations;

  const filteredStats = (() => {
    const rows = filteredForExport as (Recitation & { rating?: string | null })[];
    const scored = rows
      .map((r) => (r.rating && /^(8|9|10)$/.test(r.rating) ? Number(r.rating) : null))
      .filter((n): n is number => n !== null);
    const repeats = rows.filter((r) => r.rating === "repeat").length;
    const avg = scored.length ? scored.reduce((a, b) => a + b, 0) / scored.length : null;
    return { avg, count: scored.length, repeats };
  })();


  const handleExportPdf = async (from: string, to: string) => {
    setExportRange({ from, to });
    // Wait two frames so the off-screen report re-renders with filtered data
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    const node = reportRef.current;
    if (!node) {
      setExportRange(null);
      return;
    }
    const filtered = recitations.filter(
      (r) => r.recited_on >= from && r.recited_on <= to,
    );
    const validationErrors = validateStudentReportData(student, filtered);
    if (validationErrors.length > 0) {
      console.error("PDF Validation Error:", validationErrors);
      toast.error(validationErrors[0]);
      setExportRange(null);
      return;
    }
    setExporting(true);
    const prevStyle = node.getAttribute("style") ?? "";

    try {
      // Preload Tajawal in the main document so html2canvas's clone can use it
      if (!document.getElementById("__tajawal_pdf_font__")) {
        const link = document.createElement("link");
        link.id = "__tajawal_pdf_font__";
        link.rel = "stylesheet";
        link.href = "https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap";
        document.head.appendChild(link);
      }
      try {
        await (document as Document & { fonts?: { load: (f: string) => Promise<unknown>; ready: Promise<unknown> } }).fonts?.load("700 16px Tajawal");
        await (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts?.ready;
      } catch {
        // ignore font loading errors
      }
      // Temporarily make it visible for capture
      node.setAttribute(
        "style",
        "position:fixed;top:0;left:-9999px;width:794px;background:#fff;color:#000;padding:24px;font-family:Tajawal,system-ui,sans-serif;",
      );
      await new Promise((r) => setTimeout(r, 100));
      const canvas = await html2canvas(node, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        onclone: (doc) => {
          doc.querySelectorAll("style, link[rel='stylesheet']").forEach((el) => el.remove());
          // Inject Tajawal font so Arabic shaping renders correctly in html2canvas
          const fontLink = doc.createElement("link");
          fontLink.rel = "stylesheet";
          fontLink.href = "https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap";
          doc.head.appendChild(fontLink);
          const fontStyle = doc.createElement("style");
          fontStyle.textContent = `*, *::before, *::after { font-family: 'Tajawal', 'Segoe UI', Tahoma, Arial, sans-serif !important; }`;
          doc.head.appendChild(fontStyle);
          const safeVars: Record<string, string> = {
            "--background": "#ffffff",
            "--foreground": "#111111",
            "--card": "#ffffff",
            "--card-foreground": "#111111",
            "--popover": "#ffffff",
            "--popover-foreground": "#111111",
            "--primary": "#111111",
            "--primary-foreground": "#ffffff",
            "--secondary": "#f3f4f6",
            "--secondary-foreground": "#111111",
            "--muted": "#f3f4f6",
            "--muted-foreground": "#4b5563",
            "--accent": "#f3f4f6",
            "--accent-foreground": "#111111",
            "--border": "#d1d5db",
            "--input": "#d1d5db",
            "--ring": "#111111",
          };
          Object.entries(safeVars).forEach(([key, value]) => {
            doc.documentElement.style.setProperty(key, value);
          });
          doc.documentElement.style.backgroundColor = "#ffffff";
          doc.documentElement.style.color = "#111111";
          doc.body.style.backgroundColor = "#ffffff";
          doc.body.style.color = "#111111";
          const clonedReport = doc.getElementById("print-report")?.parentElement;
          clonedReport?.querySelectorAll<HTMLElement>("*").forEach((el) => {
            el.style.color = el.style.color || "#111111";
            el.style.borderColor = el.style.borderColor || "#d1d5db";
            el.style.boxShadow = "none";
            if (!el.style.backgroundColor) el.style.backgroundColor = "transparent";
          });
        },
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pageW = 210;
      const pageH = 297;
      const imgH = (canvas.height * pageW) / canvas.width;
      let heightLeft = imgH;
      let position = 0;
      pdf.addImage(imgData, "PNG", 0, position, pageW, imgH);
      heightLeft -= pageH;
      while (heightLeft > 0) {
        position = heightLeft - imgH;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, pageW, imgH);
        heightLeft -= pageH;
      }
      pdf.save(`تقرير-${student?.full_name ?? "طالب"}.pdf`);
    } catch (e) {
      console.error("PDF Generation Error:", e);
      const message = e instanceof Error ? e.message : getErrorMessage(e);
      toast.error(`فشل توليد PDF: ${message}`);
    } finally {
      node.setAttribute("style", prevStyle);
      setExporting(false);
      setExportRange(null);
    }
  };


  const battalionName =
    battalions.find((b) => b.id === student?.battalion_id)?.name ?? "—";
  const companyName =
    companies.find((c) => c.id === student?.company_id)?.name ?? "—";

  const addMutation = useMutation({
    mutationFn: async (values: RecitationFormValues) => {
      const nowIso = new Date().toISOString();
      const tempId = crypto.randomUUID();
      const optimistic = {
        id: tempId,
        student_id: studentId,
        created_at: nowIso,
        updated_at: nowIso,
        created_by: currentUserId,
        ...values,
      } as Recitation;
      patchRecitationsCache((rows) => [optimistic, ...rows]);
      markLocalPresent(values.recited_on);
      const recRes = await runOrQueue({
        kind: "recitation_insert",
        payload: {
          id: tempId,
          student_id: studentId,
          created_at: nowIso,
          updated_at: nowIso,
          created_by: currentUserId,
          ...values,
        },
      });
      const attRes = await runOrQueue({
        kind: "attendance_upsert",
        payload: {
          student_id: studentId,
          attended_on: values.recited_on,
          present: true,
          excused: false,
        },
      });
      return { queued: recRes.queued || attRes.queued };
    },
    onSuccess: (res) => {
      toast.success(
        res.queued
          ? "تم الحفظ محلياً وسيُزامَن عند عودة الاتصال"
          : "تم حفظ التسميع وتسجيل الحضور تلقائياً",
      );
      if (typeof navigator === "undefined" || navigator.onLine) {
        qc.invalidateQueries({ queryKey: ["recitations", studentId] });
        qc.invalidateQueries({ queryKey: ["attendance"] });
      }
      setAddOpen(false);
    },
    onError: (e: Error) => toast.error(getErrorMessage(e)),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: RecitationFormValues }) => {
      patchRecitationsCache((rows) =>
        rows.map((r) => (r.id === id ? ({ ...r, ...values, updated_at: new Date().toISOString() } as Recitation) : r)),
      );
      markLocalPresent(values.recited_on);
      const r1 = await runOrQueue({
        kind: "recitation_update",
        payload: { id, patch: values as unknown as Record<string, unknown> },
      });
      const r2 = await runOrQueue({
        kind: "attendance_upsert",
        payload: {
          student_id: studentId,
          attended_on: values.recited_on,
          present: true,
          excused: false,
        },
      });
      return { queued: r1.queued || r2.queued };
    },
    onSuccess: (res) => {
      toast.success(res.queued ? "تم الحفظ محلياً وسيُزامَن لاحقاً" : "تم تحديث التسميع");
      if (typeof navigator === "undefined" || navigator.onLine) {
        qc.invalidateQueries({ queryKey: ["recitations", studentId] });
        qc.invalidateQueries({ queryKey: ["attendance"] });
      }
      setEditing(null);
    },
    onError: (e: Error) => toast.error(getErrorMessage(e)),
  });

  const inlineMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Recitation> }) => {
      patchRecitationsCache((rows) =>
        rows.map((r) => (r.id === id ? ({ ...r, ...patch, updated_at: new Date().toISOString() } as Recitation) : r)),
      );
      await runOrQueue({
        kind: "recitation_update",
        payload: { id, patch: patch as unknown as Record<string, unknown> },
      });
    },
    onSuccess: () => {
      if (typeof navigator === "undefined" || navigator.onLine) {
        qc.invalidateQueries({ queryKey: ["recitations", studentId] });
      }
    },
    onError: (e: Error) => toast.error(getErrorMessage(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      patchRecitationsCache((rows) => rows.filter((r) => r.id !== id));
      return runOrQueue({ kind: "recitation_delete", payload: { id } });
    },
    onSuccess: (res) => {
      toast.success(res.queued ? "تم الحذف محلياً وسيُزامَن لاحقاً" : "تم حذف التسميع");
      if (typeof navigator === "undefined" || navigator.onLine) {
        qc.invalidateQueries({ queryKey: ["recitations", studentId] });
      }
      setDeleting(null);
    },
    onError: (e: Error) => toast.error(getErrorMessage(e)),
  });


  const juzMutation = useMutation({
    mutationFn: async (extra_juz: number[]) => {
      qc.setQueryData(["student", studentId], student ? ({ ...student, extra_juz } as Student) : student);
      patchStudentsCache((rows) =>
        rows.map((r) => (r.id === studentId ? ({ ...r, extra_juz, updated_at: new Date().toISOString() } as Student) : r)),
      );
      const { queued } = await runOrQueue({
        kind: "student_update",
        payload: { id: studentId, patch: { extra_juz } },
      });
      return { queued };
    },
    onSuccess: (res) => {
      toast.success(res.queued ? "تم حفظ الأجزاء محلياً وسيُزامَن لاحقاً" : "تم تحديث الأجزاء المتاحة");
      if (typeof navigator === "undefined" || navigator.onLine) {
        qc.invalidateQueries({ queryKey: ["student", studentId] });
      }
    },
    onError: (e: Error) => toast.error(getErrorMessage(e)),
  });

  const toggleJuz = (juz: 28 | 29, enabled: boolean) => {
    const current = ((student as (Student & { extra_juz?: number[] | null }) | null | undefined)?.extra_juz) ?? [];
    const next = enabled
      ? Array.from(new Set([...current, juz])).sort()
      : current.filter((j) => j !== juz);
    juzMutation.mutate(next);
  };

  if (isLoading || (!student && localStudentCheckKey !== studentId)) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        جارٍ التحميل...
      </div>
    );
  }

  if (!student) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <p className="text-muted-foreground">الطالب غير موجود</p>
        <Button asChild variant="outline">
          <Link to="/">العودة للوحة التحكم</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/60 backdrop-blur sticky top-0 z-30 no-print">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" className="gap-2" onClick={goBack}>
            <ArrowRight className="h-4 w-4" />
            <span>العودة</span>
          </Button>
          <div className="hidden sm:flex items-center gap-2 min-w-0">
            <BrandLogo size="sm" />
            <span className="font-bold text-sm text-primary truncate">منصة البناء القرآني</span>
          </div>
          <div className="flex items-center gap-2">
            <OfflineSyncButton compact />
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setExportOpen(true)}
              disabled={exporting}
            >
              <Printer className="h-4 w-4" />
              <span>{exporting ? "جارٍ التوليد..." : "تصدير PDF"}</span>
            </Button>

            <span className="font-mono text-xs text-primary font-semibold">
              {student.student_code}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 no-print">
        {/* Profile card */}
        <section className="bg-card rounded-2xl border shadow-soft p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-2xl font-bold shrink-0">
              {student.full_name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold">{student.full_name}</h1>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant="secondary">{battalionName}</Badge>
                <Badge variant="outline">{companyName}</Badge>
              </div>
            </div>
          </div>

          {student.notes?.trim() && (
            <div className="mt-5 pt-5 border-t">
              <div className="text-xs text-muted-foreground mb-2">معلومات إضافية</div>
              <p className="text-sm whitespace-pre-wrap">{student.notes}</p>
            </div>
          )}


          <div className="mt-5 pt-5 border-t grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border bg-background p-3">
              <div className="text-xs text-muted-foreground">معدل التسميع التراكمي</div>
              <div className="mt-1 text-2xl font-bold text-primary">
                {ratingStats?.avg != null ? ratingStats.avg.toFixed(2) : "—"}
                <span className="text-xs text-muted-foreground font-normal mr-1">/ 10</span>
              </div>
            </div>
            <div className="rounded-xl border bg-background p-3">
              <div className="text-xs text-muted-foreground">عدد التسميعات المُقيَّمة</div>
              <div className="mt-1 text-2xl font-bold">{ratingStats?.count ?? 0}</div>
            </div>
            <div className="rounded-xl border bg-background p-3">
              <div className="text-xs text-muted-foreground">مرات الإعادة</div>
              <div className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">
                {ratingStats?.repeats ?? 0}
              </div>
            </div>
          </div>
        </section>


        {/* Recitations log — grouped by date */}
        <section className="bg-card rounded-2xl border shadow-soft overflow-hidden">
          <div className="flex items-center justify-between p-4 sm:p-6 border-b">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <ScrollText className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-bold">سجل المتابعة القرآنية</h2>
                <p className="text-xs text-muted-foreground">
                  عدد التسميعات: {recitations.length}
                </p>
              </div>
            </div>
            <Button onClick={() => setAddOpen(true)} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">إضافة تسميع جديد</span>
              <span className="sm:hidden">إضافة</span>
            </Button>
          </div>

          {recitations.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <BookOpen className="h-10 w-10 mx-auto opacity-40 mb-2" />
              <p>لا يوجد تسميعات بعد</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAddOpen(true)}
                className="gap-1 mt-2"
              >
                <Plus className="h-4 w-4" /> سجّل أول تسميع
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              {groupByDate(recitations).map((group) => (
                <DateGroup
                  key={group.date}
                  date={group.date}
                  rows={group.rows}
                  onPatch={(id, patch) => inlineMutation.mutate({ id, patch })}
                  onEdit={(r) => setEditing(r)}
                  onDelete={(r) => setDeleting(r)}
                  canDelete={canDeleteRecitation}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Printable report (off-screen, used for PDF capture) */}
      <div ref={reportRef} style={{ position: "fixed", top: 0, left: "-9999px", width: "794px" }}>
        <PrintableReport
          student={student}
          battalionName={battalionName}
          companyName={companyName}
          recitations={filteredForExport}
          stats={exportRange ? filteredStats : ratingStats}
          dateRange={exportRange}
        />
      </div>

      {/* Export date-range dialog */}
      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>تصدير تقرير الطالب</DialogTitle>
            <DialogDescription>
              حدّد الفترة الزمنية لتضمين سجلات التسميع ضمن التقرير.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="exp-from">من تاريخ</Label>
              <Input
                id="exp-from"
                type="date"
                value={exportFrom}
                max={exportTo}
                onChange={(e) => setExportFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="exp-to">إلى تاريخ</Label>
              <Input
                id="exp-to"
                type="date"
                value={exportTo}
                min={exportFrom}
                onChange={(e) => setExportTo(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setExportOpen(false)} disabled={exporting}>
              إلغاء
            </Button>
            <Button
              onClick={async () => {
                if (!exportFrom || !exportTo) return toast.error("حدد الفترة الزمنية");
                if (exportFrom > exportTo) return toast.error("تاريخ البداية بعد تاريخ النهاية");
                setExportOpen(false);
                await handleExportPdf(exportFrom, exportTo);
              }}
              disabled={exporting}
            >
              {exporting ? "جارٍ التوليد..." : "تصدير PDF"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>




      {/* Add recitation */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>إضافة تسميع جديد</DialogTitle>
            <DialogDescription>سجّل تسميع الطالب لهذا اليوم.</DialogDescription>
          </DialogHeader>
          <RecitationForm
            submitLabel="حفظ التسميع"
            loading={addMutation.isPending}
            onSubmit={(v) => addMutation.mutate(v)}
            onCancel={() => setAddOpen(false)}
            extraJuz={((student as Student & { extra_juz?: number[] | null }).extra_juz) ?? []}
          />
        </DialogContent>
      </Dialog>

      {/* Edit recitation */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تعديل التسميع</DialogTitle>
          </DialogHeader>
          {editing && (
            <RecitationForm
              initial={{
                recited_on: editing.recited_on,
                surah: editing.surah,
                from_ayah: editing.from_ayah,
                to_ayah: editing.to_ayah,
                notes: editing.notes ?? "",
                rating: editing.rating ?? "",
                is_review: editing.is_review ?? false,
              }}
              submitLabel="حفظ التغييرات"
              loading={updateMutation.isPending}
              onSubmit={(values) =>
                updateMutation.mutate({ id: editing.id, values })
              }
              onCancel={() => setEditing(null)}
              extraJuz={((student as Student & { extra_juz?: number[] | null }).extra_juz) ?? []}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف التسميع</AlertDialogTitle>
            <AlertDialogDescription>
              هل تريد حذف هذا التسميع؟ لا يمكن التراجع.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleting && deleteMutation.mutate(deleting.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

type RecitationFormValues = {
  recited_on: string;
  surah: string;
  from_ayah: number;
  to_ayah: number;
  notes: string;
  rating: string | null;
  is_review: boolean;
};

const RATING_BUTTONS: {
  value: string;
  label: string;
  activeClass: string;
  idleClass: string;
}[] = [
  {
    value: "10",
    label: "10",
    activeClass: "bg-foreground text-background border-foreground shadow-sm",
    idleClass: "bg-background text-foreground border-border hover:bg-muted",
  },
  {
    value: "9",
    label: "9",
    activeClass: "bg-foreground text-background border-foreground shadow-sm",
    idleClass: "bg-background text-foreground border-border hover:bg-muted",
  },
  {
    value: "8",
    label: "8",
    activeClass: "bg-foreground text-background border-foreground shadow-sm",
    idleClass: "bg-background text-foreground border-border hover:bg-muted",
  },
  {
    value: "repeat",
    label: "إعادة",
    activeClass: "bg-foreground text-background border-foreground shadow-sm",
    idleClass: "bg-background text-foreground border-border hover:bg-muted",
  },
  {
    value: "review",
    label: "مراجعة",
    activeClass: "bg-foreground text-background border-foreground shadow-sm",
    idleClass: "bg-background text-foreground border-border hover:bg-muted",
  },
];

function groupByDate(rows: Recitation[]): { date: string; rows: Recitation[] }[] {
  const map = new Map<string, Recitation[]>();
  for (const r of rows) {
    const arr = map.get(r.recited_on) ?? [];
    arr.push(r);
    map.set(r.recited_on, arr);
  }
  return Array.from(map.entries())
    .sort((a, b) => compareReportDates(b[0], a[0]))
    .map(([date, rows]) => ({
      date,
      rows: [...rows].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))),
    }));
}

function formatArabicDate(iso: string): string {
  return formatArabicReportDate(iso);
}

function DateGroup({
  rows,
  onPatch,
  onEdit,
  onDelete,
  canDelete,
}: {
  date: string;
  rows: Recitation[];
  onPatch: (id: string, patch: Partial<Recitation>) => void;
  onEdit: (r: Recitation) => void;
  onDelete: (r: Recitation) => void;
  canDelete: (r: Recitation) => boolean;
}) {
  return (
    <div className="divide-y" dir="rtl">
      {rows.map((r) => (
        <RecitationCard
          key={r.id}
          rec={r}
          onPatch={(patch) => onPatch(r.id, patch)}
          onEdit={() => onEdit(r)}
          onDelete={() => onDelete(r)}
          canDelete={canDelete(r)}
        />
      ))}
    </div>
  );
}

function RecitationCard({
  rec,
  onPatch,
  onEdit,
  onDelete,
  canDelete,
}: {
  rec: Recitation;
  onPatch: (patch: Partial<Recitation>) => void;
  onEdit: () => void;
  onDelete: () => void;
  canDelete: boolean;
}) {
  const [notes, setNotes] = useState(rec.notes ?? "");
  const [lastSyncedId, setLastSyncedId] = useState(rec.id);
  if (lastSyncedId !== rec.id) {
    setLastSyncedId(rec.id);
    setNotes(rec.notes ?? "");
  }

  const currentRating: string | null = rec.is_review ? "review" : rec.rating ?? null;

  const setRating = (value: string) => {
    if (value === "review") {
      const next = !rec.is_review;
      onPatch({ is_review: next, rating: next ? null : rec.rating });
      if (next) toast("تم تسجيل السجل كجلسة مراجعة");
      return;
    }
    const same = rec.rating === value && !rec.is_review;
    if (value === "repeat" && !same) {
      toast.warning("تم اختيار 'إعادة' — لن تُحتسب ضمن معدّل الإتقان.");
    }
    onPatch({ rating: same ? null : value, is_review: false });
  };

  const saveNotes = () => {
    const trimmed = notes.trim().slice(0, 2000);
    if (trimmed === (rec.notes ?? "")) return;
    onPatch({ notes: trimmed });
  };

  return (
    <div className="px-4 py-4 space-y-3">
      <div className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground font-mono">
        <span>{formatArabicDate(rec.recited_on)}</span>
        <CalendarIcon className="h-3.5 w-3.5" />
      </div>
      <div className="flex items-center gap-2 font-bold">
        <BookOpen className="h-4 w-4 text-primary shrink-0" />
        <span className="break-words">{rec.surah}</span>
        <span className="text-xs text-muted-foreground font-mono">({rec.from_ayah}-{rec.to_ayah})</span>
        {rec.is_review && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30">
            مراجعة
          </span>
        )}
      </div>
      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={saveNotes}
        placeholder="ملاحظات..."
        maxLength={2000}
        rows={1}
        className="text-sm resize-none min-h-[36px] rounded-full px-4"
        dir="rtl"
      />
      <div className="flex items-center gap-1.5 flex-wrap">
        {canDelete && (
          <Button size="icon" variant="ghost" onClick={onDelete} className="h-8 w-8" title="حذف">
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        )}
        <Button size="icon" variant="ghost" onClick={onEdit} className="h-8 w-8" title="تعديل">
          <Pencil className="h-4 w-4" />
        </Button>
        {RATING_BUTTONS.map((b) => {
          const active = currentRating === b.value;
          return (
            <button
              key={b.value}
              onClick={() => setRating(b.value)}
              type="button"
              className={`h-8 px-3 min-w-[40px] text-xs font-semibold rounded-md border transition-colors ${
                active ? b.activeClass : b.idleClass
              }`}
            >
              {b.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}



function PrintableReport({
  student,
  battalionName,
  companyName,
  recitations,
  stats,
  dateRange,
}: {
  student: Student;
  battalionName: string;
  companyName: string;
  recitations: Recitation[];
  stats: { avg: number | null; count: number; repeats: number };
  dateRange?: { from: string; to: string } | null;
}) {
  const groups = groupByDate(recitations);
  const uniqueSurahs = new Set(recitations.map((r) => r.surah)).size;
  const printedAt = new Date().toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const rangeText = dateRange
    ? `من ${formatArabicReportDate(dateRange.from)} إلى ${formatArabicReportDate(dateRange.to)}`
    : null;

  return (
    <div
      id="print-report"
      dir="rtl"
      style={{ fontFamily: "Tajawal, system-ui, sans-serif", background: "#fff", color: "#000", padding: "16px" }}
    >
      <div style={{ borderBottom: "2px solid #1f6b6b", paddingBottom: "10px", marginBottom: "14px", display: "flex", alignItems: "center", gap: "12px" }}>
        <img
          src={BRAND_LOGO_URL}
          alt="شعار"
          crossOrigin="anonymous"
          style={{ height: "64px", width: "64px", objectFit: "cover", borderRadius: "8px", border: "1px solid #1f6b6b" }}
        />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "18px", fontWeight: 700, color: "#1f6b6b" }}>{BRAND_NAME}</div>
          <h1 style={{ margin: "2px 0 0", fontSize: "16px", fontWeight: 700, color: "#111" }}>
            التقرير الفردي للطالب
          </h1>
          <div style={{ fontSize: "11px", color: "#555", marginTop: "4px" }}>
            وشؤون المساجد — الفرقة 64 · تاريخ الطباعة: {printedAt}
          </div>
          {rangeText && (
            <div style={{
              marginTop: "6px",
              display: "inline-block",
              background: "#1f6b6b",
              color: "#fff",
              padding: "4px 10px",
              borderRadius: "4px",
              fontSize: "12px",
              fontWeight: 700,
            }}>
              الفترة: {rangeText}
            </div>
          )}
        </div>
      </div>


      <table style={{ width: "100%", fontSize: "12px", marginBottom: "14px", borderCollapse: "collapse" }}>
        <tbody>
          <tr>
            <td style={{ padding: "4px 6px", fontWeight: 700, width: "20%" }}>الاسم:</td>
            <td style={{ padding: "4px 6px" }}>{student.full_name}</td>
            <td style={{ padding: "4px 6px", fontWeight: 700, width: "20%" }}>الرقم:</td>
            <td style={{ padding: "4px 6px" }}>{student.student_code}</td>
          </tr>
          <tr>
            <td style={{ padding: "4px 6px", fontWeight: 700 }}>الكتيبة:</td>
            <td style={{ padding: "4px 6px" }}>{battalionName}</td>
            <td style={{ padding: "4px 6px", fontWeight: 700 }}>السرية:</td>
            <td style={{ padding: "4px 6px" }}>{companyName}</td>
          </tr>
          {student.notes?.trim() && (
            <tr>
              <td style={{ padding: "4px 6px", fontWeight: 700 }}>ملاحظات:</td>
              <td style={{ padding: "4px 6px" }} colSpan={3}>{student.notes}</td>
            </tr>
          )}
        </tbody>
      </table>

      <h2 style={{ fontSize: "14px", fontWeight: 700, margin: "10px 0 6px" }}>
        سجل التسميع ({recitations.length})
      </h2>

      {groups.length === 0 ? (
        <p style={{ fontSize: "12px", color: "#666" }}>لا توجد سجلات.</p>
      ) : (
        groups.map((g) => (
          <div key={g.date} style={{ marginBottom: "12px" }}>
            <div style={{
              fontWeight: 700,
              fontSize: "13px",
              background: "#0f5132",
              color: "#ffffff",
              padding: "6px 10px",
              borderRadius: "3px 3px 0 0",
            }}>
              {formatArabicDate(g.date)}
            </div>
            <table style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "12px",
              tableLayout: "fixed",
            }}>
              <colgroup>
                <col style={{ width: "30%" }} />
                <col style={{ width: "18%" }} />
                <col style={{ width: "17%" }} />
                <col style={{ width: "35%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={thStyle}>السورة</th>
                  <th style={thStyle}>الآيات</th>
                  <th style={thStyle}>التقييم</th>
                  <th style={thStyle}>الملاحظات</th>
                </tr>
              </thead>
              <tbody>
                {g.rows.map((r, i) => (
                  <tr key={r.id} style={{ background: i % 2 ? "#f5f7f6" : "#ffffff" }}>
                    <td style={tdStyle}>{r.surah}</td>
                    <td style={tdStyle}>{r.from_ayah}–{r.to_ayah}</td>
                    <td style={tdStyle}>{formatRecitationRating(r)}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>{r.notes ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}

      <div style={{
        marginTop: "14px",
        paddingTop: "8px",
        borderTop: "2px solid #111",
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: "8px",
        fontSize: "12px",
      }}>
        <StatBox label="متوسط التقييم العام" value={stats.avg != null ? `${stats.avg.toFixed(2)} / 10` : "—"} />
        <StatBox label="عدد التسميعات المُقيَّمة" value={String(stats.count)} />
        <StatBox label="مرات الإعادة" value={String(stats.repeats)} />
        <StatBox label="إجمالي السور" value={String(uniqueSurahs)} />
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  border: "1.5px solid #0f5132",
  padding: "8px 6px",
  textAlign: "center",
  fontWeight: 700,
  background: "#0f5132",
  color: "#ffffff",
  lineHeight: 1.6,
};
const tdStyle: React.CSSProperties = {
  border: "1px solid #999",
  padding: "8px 6px",
  textAlign: "center",
  verticalAlign: "middle",
  lineHeight: 1.7,
  wordBreak: "break-word",
};

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: "1px solid #ccc", padding: "6px 8px", borderRadius: "4px" }}>
      <div style={{ fontSize: "10px", color: "#555" }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: "13px", marginTop: "2px" }}>{value}</div>
    </div>
  );
}

function RecitationForm({
  initial,
  submitLabel = "حفظ",
  onSubmit,
  onCancel,
  loading,
  extraJuz = [],
}: {
  initial?: Partial<RecitationFormValues>;
  submitLabel?: string;
  onSubmit: (v: RecitationFormValues) => void;
  onCancel?: () => void;
  loading?: boolean;
  extraJuz?: number[];
}) {
  const availableSurahs = getSurahsForStudent(extraJuz);
  const getToday = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  const [date, setDate] = useState(initial?.recited_on ?? getToday());
  // Parse initial surah which may be a range "X - Y"
  const initSurahParts = (initial?.surah ?? "").split(" - ");
  const [fromSurah, setFromSurah] = useState(initSurahParts[0] ?? "");
  const [toSurah, setToSurah] = useState(initSurahParts[1] ?? initSurahParts[0] ?? "");
  const [fromAyah, setFromAyah] = useState<string>(
    initial?.from_ayah?.toString() ?? "",
  );
  const [toAyah, setToAyah] = useState<string>(
    initial?.to_ayah?.toString() ?? "",
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [rating, setRating] = useState<string>(initial?.rating ?? "");
  const [isReview, setIsReview] = useState<boolean>(initial?.is_review ?? false);




  const selectedSurah = getSurahByName(fromSurah);
  const maxAyahs = selectedSurah?.ayahs ?? 0;
  const ayahNumbers = Array.from({ length: maxAyahs }, (_, i) => i + 1);
  const toSurahMeta = getSurahByName(toSurah);
  const toMaxAyahs = toSurahMeta?.ayahs ?? 0;
  const toAyahNumbers = Array.from({ length: toMaxAyahs }, (_, i) => i + 1).filter(
    (n) => fromSurah !== toSurah || !fromAyah || n >= Number(fromAyah),
  );

  const from = Number(fromAyah);
  const to = Number(toAyah);
  const sameSurah = fromSurah === toSurah;
  const valid =
    !!fromSurah &&
    !!toSurah &&
    !!date &&
    !!fromAyah &&
    !!toAyah &&
    from >= 1 &&
    to >= 1 &&
    from <= maxAyahs &&
    to <= toMaxAyahs &&
    (!sameSurah || to >= from);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        const surahValue = sameSurah ? fromSurah : `${fromSurah} - ${toSurah}`;
        onSubmit({
          recited_on: date,
          surah: surahValue,
          from_ayah: from,
          to_ayah: to,
          notes: notes.trim().slice(0, 2000),
          rating: isReview ? null : (rating || null),
          is_review: isReview,
        });
      }}
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label htmlFor="date">التاريخ</Label>
        <Input
          id="date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
      </div>

      <div className="rounded-md border bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-300">
        ✓ سيتم تسجيل الطالب <span className="font-bold">حاضراً</span> تلقائياً عند حفظ التسميع. يمكنك تعديل حالة الحضور لاحقاً من صفحة الحضور.
      </div>



      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>من سورة</Label>
          <Select
            value={fromSurah}
            onValueChange={(v) => {
              setFromSurah(v);
              // Auto-mirror to "إلى سورة" so single-surah is the default
              setToSurah(v);
              setFromAyah("");
              setToAyah("");
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="اختر .." />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {availableSurahs.map((s) => (
                <SelectItem key={s.number} value={s.name}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>إلى سورة</Label>
          <Select
            value={toSurah}
            onValueChange={(v) => {
              setToSurah(v);
              setToAyah("");
            }}
            disabled={!fromSurah}
          >
            <SelectTrigger>
              <SelectValue placeholder={fromSurah ? "اختر .." : "اختر من سورة أولاً"} />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {availableSurahs.filter(
                (s) => !selectedSurah || s.number >= selectedSurah.number,
              ).map((s) => (
                <SelectItem key={s.number} value={s.name}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>


      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>من آية</Label>
          <Select
            value={fromAyah}
            onValueChange={(v) => {
              setFromAyah(v);
              if (!toAyah || Number(toAyah) < Number(v)) setToAyah(v);
            }}
            disabled={!selectedSurah}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={selectedSurah ? "اختر..." : "اختر سورة أولاً"}
              />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              {ayahNumbers.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>إلى آية</Label>
          <Select
            value={toAyah}
            onValueChange={setToAyah}
            disabled={!selectedSurah || !fromAyah}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={fromAyah ? "اختر..." : "اختر من آية أولاً"}
              />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              {toAyahNumbers.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>تقييم التسميع</Label>
        <div className="flex gap-2 flex-wrap">
          {(["10", "9", "8", "repeat"] as const).map((v) => {
            const isActive = !isReview && rating === v;
            const isRepeat = v === "repeat";
            return (
              <Button
                key={v}
                type="button"
                size="sm"
                variant={isActive ? (isRepeat ? "destructive" : "default") : "outline"}
                onClick={() => {
                  if (isRepeat && !isActive) {
                    toast.warning("تم اختيار 'إعادة' — لن تُحتسب ضمن معدّل الإتقان.");
                  }
                  setIsReview(false);
                  setRating(isActive ? "" : v);
                }}
                className="min-w-[56px]"
              >
                {isRepeat ? "إعادة" : `${v}/10`}
              </Button>
            );
          })}
          <Button
            type="button"
            size="sm"
            variant={isReview ? "secondary" : "outline"}
            onClick={() => {
              const next = !isReview;
              setIsReview(next);
              if (next) {
                setRating("");
                toast("سيُسجل كجلسة مراجعة");
              }
            }}
            className="min-w-[56px]"
          >
            مراجعة
          </Button>
        </div>
      </div>



      <div className="space-y-2">
        <Label htmlFor="rec-notes">ملاحظات (اختياري)</Label>
        <Textarea
          id="rec-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="ممتاز، يحتاج مراجعة، أخطاء في..."
        />
      </div>

      <div className="flex gap-2 justify-end pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            إلغاء
          </Button>
        )}
        <Button type="submit" disabled={loading || !valid}>
          {loading ? "جارٍ الحفظ..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}

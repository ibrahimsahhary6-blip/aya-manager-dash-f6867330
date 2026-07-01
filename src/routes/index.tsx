import { getErrorMessage } from "@/lib/errors";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { useCachedQuery, writeCache } from "@/lib/local-cache";
import { runOrQueue } from "@/lib/offline-queue";

import {
  Plus,
  Search,
  BookOpen,
  Users,
  Pencil,
  Trash2,
  Filter,
  Settings,
  ClipboardCheck,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { StudentForm, type StudentFormValues } from "@/components/StudentForm";
import { useBattalions, useCompanies } from "@/lib/orgs";
import { DepartmentSwitcher, useDepartmentContext } from "@/lib/department";
import { NotificationsBell } from "@/components/NotificationsBell";
import { BrandLogo } from "@/components/BrandLogo";
import { OfflineSyncButton } from "@/components/OfflineSyncButton";
import { useIsAdmin, useCanManageStudents } from "@/lib/roles";

import { normalizeArabic } from "@/lib/normalize";

type Student = Tables<"students">;

export const Route = createFileRoute("/")({
  component: DashboardPage,
});

function DashboardPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const isAdmin = useIsAdmin();
  const canManage = useCanManageStudents();
  // Persist filters so returning from a student profile preserves context
  const FILTERS_KEY = "dashboard-filters-v1";
  const initialFilters = (() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = sessionStorage.getItem(FILTERS_KEY);
      return raw ? (JSON.parse(raw) as { search: string; battalionFilter: string; companyFilter: string; expandedBattalion: string | null }) : null;
    } catch {
      return null;
    }
  })();
  const [search, setSearch] = useState(initialFilters?.search ?? "");
  const [battalionFilter, setBattalionFilter] = useState<string>(initialFilters?.battalionFilter ?? "all");
  const [companyFilter, setCompanyFilter] = useState<string>(initialFilters?.companyFilter ?? "all");
  const [expandedBattalion, setExpandedBattalion] = useState<string | null>(initialFilters?.expandedBattalion ?? null);
  useEffect(() => {
    try {
      sessionStorage.setItem(
        FILTERS_KEY,
        JSON.stringify({ search, battalionFilter, companyFilter, expandedBattalion }),
      );
    } catch {
      // ignore quota errors
    }
  }, [search, battalionFilter, companyFilter, expandedBattalion]);

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [deleting, setDeleting] = useState<Student | null>(null);
  const PAGE_SIZE = 20;
  const [page, setPage] = useState(1);

  const { data: battalionsAll = [] } = useBattalions();
  const { data: companiesAll = [] } = useCompanies();
  const { scopedBattalionIds } = useDepartmentContext();
  const battalions = useMemo(
    () => (scopedBattalionIds === null ? battalionsAll : battalionsAll.filter((b) => scopedBattalionIds.includes(b.id))),
    [battalionsAll, scopedBattalionIds],
  );
  const companies = useMemo(
    () => (scopedBattalionIds === null ? companiesAll : companiesAll.filter((c) => scopedBattalionIds.includes(c.battalion_id))),
    [companiesAll, scopedBattalionIds],
  );

  const battalionName = (id: string | null) =>
    battalions.find((b) => b.id === id)?.name ?? "—";
  const companyName = (id: string | null) =>
    companies.find((c) => c.id === id)?.name ?? "—";

  const { data: students = [], isLoading } = useCachedQuery<Student[]>({
    queryKey: ["students"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, full_name, student_code, battalion_id, company_id, created_at, deleted_at, notes, updated_at, extra_juz")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Student[];
    },
    staleTime: 60_000,
  });


  const filtered = useMemo(() => {
    const q = normalizeArabic(search);
    const scopedSet = scopedBattalionIds === null ? null : new Set(scopedBattalionIds);
    return students.filter((s) => {
      if (scopedSet && (!s.battalion_id || !scopedSet.has(s.battalion_id))) return false;
      if (battalionFilter !== "all" && s.battalion_id !== battalionFilter) return false;
      if (companyFilter !== "all" && s.company_id !== companyFilter) return false;
      if (!q) return true;
      return (
        normalizeArabic(s.full_name).includes(q) ||
        s.student_code.toLowerCase().includes(q)
      );
    });
  }, [students, search, battalionFilter, companyFilter, scopedBattalionIds]);

  useEffect(() => {
    setPage(1);
  }, [search, battalionFilter, companyFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(pageStart, pageStart + PAGE_SIZE);


  // Optimistically patch the cached students list + persist to IndexedDB so
  // offline mutations are visible immediately and survive a page reload.
  const patchStudentsCache = (mutator: (rows: Student[]) => Student[]) => {
    const current = (qc.getQueryData<Student[]>(["students"]) ?? []) as Student[];
    const next = mutator(current);
    qc.setQueryData(["students"], next);
    writeCache(["students"], next).catch(() => undefined);
  };

  const addMutation = useMutation({
    mutationFn: async (values: StudentFormValues) => {
      // Optimistic local insert so UI updates instantly even when offline.
      const tempId = crypto.randomUUID();
      const nowIso = new Date().toISOString();
      const optimistic: Student = {
        id: tempId,
        full_name: values.full_name,
        student_code: (values as { student_code?: string }).student_code ?? "",
        battalion_id: values.battalion_id ?? null,
        company_id: values.company_id ?? null,
        created_at: nowIso,
        updated_at: nowIso,
        deleted_at: null,
        extra_juz: [],
        notes: (values as { notes?: string | null }).notes ?? null,
      } as Student;
      patchStudentsCache((rows) => [optimistic, ...rows]);
      const { queued } = await runOrQueue({
        kind: "student_insert",
        payload: { ...values, id: tempId, created_at: nowIso, updated_at: nowIso, extra_juz: [] },
      });
      return { queued };
    },
    onSuccess: ({ queued }) => {
      toast.success(queued ? "تم حفظ الطالب محلياً وسيتم رفعه عند عودة الاتصال" : "تم إضافة الطالب بنجاح");
      if (typeof navigator === "undefined" || navigator.onLine) {
        qc.invalidateQueries({ queryKey: ["students"] });
      }
      setAddOpen(false);
    },
    onError: (e: Error) => toast.error(getErrorMessage(e)),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: StudentFormValues }) => {
      const payload: Partial<StudentFormValues> = { ...values };
      if (!isAdmin) delete payload.full_name;
      patchStudentsCache((rows) =>
        rows.map((r) => (r.id === id ? ({ ...r, ...payload, updated_at: new Date().toISOString() } as Student) : r)),
      );
      const { queued } = await runOrQueue({
        kind: "student_update",
        payload: { id, patch: payload as Record<string, unknown> },
      });
      return { queued };
    },
    onSuccess: ({ queued }) => {
      toast.success(queued ? "تم حفظ التعديل محلياً وسيتم رفعه عند عودة الاتصال" : "تم تحديث بيانات الطالب");
      if (typeof navigator === "undefined" || navigator.onLine) {
        qc.invalidateQueries({ queryKey: ["students"] });
      }
      setEditing(null);
    },
    onError: (e: Error) => toast.error(getErrorMessage(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      patchStudentsCache((rows) => rows.filter((r) => r.id !== id));
      const { queued } = await runOrQueue({ kind: "student_soft_delete", payload: { id } });
      return { queued };
    },
    onSuccess: ({ queued }) => {
      toast.success(queued ? "تم الحذف محلياً وسيتم تنفيذه عند عودة الاتصال" : "تم نقل الطالب إلى سلة المحذوفات");
      if (typeof navigator === "undefined" || navigator.onLine) {
        qc.invalidateQueries({ queryKey: ["students"] });
      }
      setDeleting(null);
    },
    onError: (e: Error) => toast.error(getErrorMessage(e)),
  });


  const scopedStudents = useMemo(() => {
    if (scopedBattalionIds === null) return students;
    const set = new Set(scopedBattalionIds);
    return students.filter((s) => s.battalion_id && set.has(s.battalion_id));
  }, [students, scopedBattalionIds]);

  const battalionCounts = useMemo(() => {
    const map = new Map<string, number>();
    scopedStudents.forEach((s) => {
      if (s.battalion_id) map.set(s.battalion_id, (map.get(s.battalion_id) ?? 0) + 1);
    });
    return map;
  }, [scopedStudents]);

  const companyCounts = useMemo(() => {
    const map = new Map<string, number>();
    scopedStudents.forEach((s) => {
      if (s.company_id) map.set(s.company_id, (map.get(s.company_id) ?? 0) + 1);
    });
    return map;
  }, [scopedStudents]);

  const companiesByBattalion = useMemo(() => {
    const map = new Map<string, typeof companies>();
    companies.forEach((c) => {
      const list = map.get(c.battalion_id) ?? [];
      list.push(c);
      map.set(c.battalion_id, list);
    });
    return map;
  }, [companies]);

  const clearFilters = () => {
    setBattalionFilter("all");
    setCompanyFilter("all");
    setExpandedBattalion(null);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/60 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <BrandLogo size="md" />
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-bold leading-tight truncate text-primary">
                منصة البناء القرآني
              </h1>
              <p className="text-[11px] sm:text-xs text-muted-foreground hidden sm:block truncate">
                وشؤون المساجد — إدارة حلقات اللواء 642
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <DepartmentSwitcher />
            <NotificationsBell />
            <OfflineSyncButton />
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link to="/attendance">
                <ClipboardCheck className="h-4 w-4" />
                <span className="hidden sm:inline">الحضور والغياب</span>
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link to="/settings">
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">الإعدادات</span>
              </Link>
            </Button>
            {canManage && (
              <Button onClick={() => setAddOpen(true)} className="gap-2" size="sm">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">إضافة طالب جديد</span>
                <span className="sm:hidden">إضافة</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* Total */}
        <section className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={<Users className="h-5 w-5" />}
            label="إجمالي الطلاب"
            value={scopedStudents.length}
            highlight
          />
          <div className="sm:col-span-1 lg:col-span-3 rounded-2xl border bg-card p-4 shadow-soft flex items-center text-xs text-muted-foreground">
            اضغط على بطاقة كتيبة لعرض سراياها، ثم اختر سرية لتصفية الطلاب.
          </div>
        </section>

        {/* Battalions tree */}
        <section className="space-y-3">
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            {battalions.map((b) => {
              const isOpen = expandedBattalion === b.id;
              const isActive = battalionFilter === b.id;
              return (
                <button
                  type="button"
                  key={b.id}
                  onClick={() => {
                    if (isOpen) {
                      setExpandedBattalion(null);
                    } else {
                      setExpandedBattalion(b.id);
                    }
                  }}
                  className={`text-right rounded-2xl border p-4 shadow-soft transition-all ${
                    isActive || isOpen
                      ? "bg-primary/5 border-primary/40 ring-1 ring-primary/30"
                      : "bg-card hover:border-primary/30 hover:bg-accent/30"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      كتيبة
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
                    />
                  </div>
                  <div className="mt-1 font-bold">{b.name}</div>
                  <div className="mt-2 text-2xl font-bold text-primary">
                    {battalionCounts.get(b.id) ?? 0}
                    <span className="text-xs text-muted-foreground font-normal mr-1">طالب</span>
                  </div>
                </button>
              );
            })}
          </div>

          {expandedBattalion && (
            <div className="rounded-2xl border bg-card p-4 shadow-soft animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="text-xs text-muted-foreground mb-3">
                سرايا {battalionName(expandedBattalion)}
              </div>
              <div className="grid gap-2 grid-cols-2 sm:grid-cols-4">
                {(companiesByBattalion.get(expandedBattalion) ?? []).map((c) => {
                  const active = companyFilter === c.id;
                  return (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() => {
                        if (active) {
                          setCompanyFilter("all");
                          setBattalionFilter("all");
                        } else {
                          setCompanyFilter(c.id);
                          setBattalionFilter(expandedBattalion);
                        }
                      }}
                      className={`rounded-xl border p-3 text-right transition-colors ${
                        active
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background hover:bg-accent"
                      }`}
                    >
                      <div className="text-sm font-semibold truncate">{c.name}</div>
                      <div
                        className={`text-xs ${active ? "text-primary-foreground/80" : "text-muted-foreground"}`}
                      >
                        {companyCounts.get(c.id) ?? 0} طالب
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* Toolbar */}
        <section className="bg-card rounded-2xl border p-4 shadow-soft">
          <div className="flex flex-col md:flex-row gap-3 md:items-center">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث بالاسم أو الرقم التعريفي..."
                className="pr-9 pl-9"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="مسح البحث"
                  className="absolute left-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
              <Select
                value={battalionFilter}
                onValueChange={(v) => {
                  setBattalionFilter(v);
                  setCompanyFilter("all");
                }}
              >
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="الكتيبة" />
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
              {(battalionFilter !== "all" || companyFilter !== "all") && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
                  <X className="h-4 w-4" /> مسح
                </Button>
              )}
            </div>
          </div>
          {(battalionFilter !== "all" || companyFilter !== "all") && (
            <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
              {battalionFilter !== "all" && (
                <Badge variant="secondary">{battalionName(battalionFilter)}</Badge>
              )}
              {companyFilter !== "all" && (
                <Badge>{companyName(companyFilter)}</Badge>
              )}
            </div>
          )}
        </section>


        {/* Table */}
        <section className="bg-card rounded-2xl border shadow-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-fixed break-words">
              <colgroup>
                <col style={{ width: "18%" }} />
                <col style={{ width: "34%" }} />
                <col style={{ width: "22%" }} />
                <col className="hidden sm:table-column" style={{ width: "14%" }} />
                <col className="hidden md:table-column" style={{ width: "12%" }} />
                <col style={{ width: "20%" }} />
              </colgroup>
              <thead className="bg-primary text-primary-foreground">
                <tr>
                  <Th className="whitespace-nowrap">الرقم التعريفي</Th>
                  <Th>الاسم الكامل</Th>
                  <Th>الكتيبة</Th>
                  <Th className="hidden sm:table-cell">السرية</Th>
                  <Th className="hidden md:table-cell whitespace-nowrap">تاريخ الإضافة</Th>
                  <Th className="text-left whitespace-nowrap">إجراءات</Th>
                </tr>
              </thead>
              <tbody className="[&_tr:nth-child(even)]:bg-muted/30">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-muted-foreground">
                      جارٍ التحميل...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-16 text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <Users className="h-10 w-10 opacity-40" />
                        <p>لا يوجد طلاب لعرضهم</p>
                        {canManage && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setAddOpen(true)}
                            className="gap-1"
                          >
                            <Plus className="h-4 w-4" /> أضف أول طالب
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  pageItems.map((s) => (
                    <tr
                      key={s.id}
                      onClick={() =>
                        navigate({
                          to: "/students/$studentId",
                          params: { studentId: s.id },
                        })
                      }
                      className="border-t hover:bg-accent/40 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-primary font-semibold col-nowrap">
                        {s.student_code}
                      </td>
                      <td className="px-4 py-3 font-medium col-name">{s.full_name}</td>
                      <td className="px-2 py-3">
                        <Badge variant="secondary" className="font-normal whitespace-normal text-center leading-tight">
                          {battalionName(s.battalion_id)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground col-nowrap">
                        {companyName(s.company_id)}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-muted-foreground col-nowrap">
                        {new Date(s.created_at).toLocaleDateString("ar-EG")}
                      </td>
                      <td className="px-4 py-3 text-left">
                        <div className="flex gap-1 justify-end">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditing(s);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {canManage && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleting(s);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {filtered.length > 0 && (
            <div className="border-t px-4 py-2 bg-muted/30 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between text-xs text-muted-foreground">
              <div>
                عرض <span className="font-semibold text-foreground">{pageStart + 1}</span>
                {" - "}
                <span className="font-semibold text-foreground">
                  {Math.min(pageStart + PAGE_SIZE, filtered.length)}
                </span>
                {" من "}
                <span className="font-semibold text-foreground">{filtered.length}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                  السابق
                </Button>
                <span className="px-2">
                  صفحة {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  التالي
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>إضافة طالب جديد</DialogTitle>
            <DialogDescription>
              سيتم توليد رقم تعريفي فريد للطالب تلقائياً.
            </DialogDescription>
          </DialogHeader>
          <StudentForm
            submitLabel="إضافة الطالب"
            loading={addMutation.isPending}
            onSubmit={(v) => addMutation.mutate(v)}
            onCancel={() => setAddOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تعديل بيانات الطالب</DialogTitle>
            <DialogDescription className="font-mono text-primary">
              {editing?.student_code}
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <StudentForm
              initial={{
                full_name: editing.full_name,
                battalion_id: editing.battalion_id ?? "",
                company_id: editing.company_id ?? "",
                notes: editing.notes ?? "",
              }}
              submitLabel="حفظ التغييرات"
              loading={updateMutation.isPending}
              lockName={!isAdmin}
              onSubmit={(values) =>
                updateMutation.mutate({ id: editing.id, values })
              }
              onCancel={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>نقل الطالب إلى سلة المحذوفات</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم نقل الطالب{" "}
              <span className="font-semibold text-foreground">
                {deleting?.full_name}
              </span>
              {" "}إلى سلة المحذوفات. يمكن استرجاعه لاحقاً من السلة.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleting && deleteMutation.mutate(deleting.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              نقل للسلة
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={`px-4 py-3 text-right text-xs font-bold tracking-wide ${className}`}
    >
      {children}
    </th>
  );
}

function StatCard({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 shadow-soft ${
        highlight ? "bg-primary text-primary-foreground" : "bg-card"
      }`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`text-xs font-medium ${
            highlight ? "text-primary-foreground/80" : "text-muted-foreground"
          }`}
        >
          {label}
        </span>
        <div
          className={`h-8 w-8 rounded-lg flex items-center justify-center ${
            highlight ? "bg-primary-foreground/15" : "bg-primary/10 text-primary"
          }`}
        >
          {icon}
        </div>
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  );
}

import { getErrorMessage } from "@/lib/errors";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
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
  X,
  Trash,
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
import { ExportReportDialog } from "@/components/ExportReportDialog";
import { BackupDataButton } from "@/components/BackupDataButton";
import { normalizeArabic } from "@/lib/normalize";

type Student = Tables<"students">;

export const Route = createFileRoute("/")({
  component: DashboardPage,
});

function DashboardPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [battalionFilter, setBattalionFilter] = useState<string>("all");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [expandedBattalion, setExpandedBattalion] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [deleting, setDeleting] = useState<Student | null>(null);

  const { data: battalions = [] } = useBattalions();
  const { data: companies = [] } = useCompanies();

  const battalionName = (id: string | null) =>
    battalions.find((b) => b.id === id)?.name ?? "—";
  const companyName = (id: string | null) =>
    companies.find((c) => c.id === id)?.name ?? "—";

  const { data: students = [], isLoading } = useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Student[];
    },
  });

  const filtered = useMemo(() => {
    const q = normalizeArabic(search);
    return students.filter((s) => {
      if (battalionFilter !== "all" && s.battalion_id !== battalionFilter) return false;
      if (companyFilter !== "all" && s.company_id !== companyFilter) return false;
      if (!q) return true;
      return (
        normalizeArabic(s.full_name).includes(q) ||
        s.student_code.toLowerCase().includes(q)
      );
    });
  }, [students, search, battalionFilter, companyFilter]);

  const addMutation = useMutation({
    mutationFn: async (values: StudentFormValues) => {
      const { error } = await supabase.from("students").insert(values);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم إضافة الطالب بنجاح");
      qc.invalidateQueries({ queryKey: ["students"] });
      setAddOpen(false);
    },
    onError: (e: Error) => toast.error(getErrorMessage(e)),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: StudentFormValues }) => {
      const { error } = await supabase.from("students").update(values).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم تحديث بيانات الطالب");
      qc.invalidateQueries({ queryKey: ["students"] });
      setEditing(null);
    },
    onError: (e: Error) => toast.error(getErrorMessage(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { createBackup } = await import("@/lib/backup");
      await createBackup("pre_delete", `قبل نقل طالب ${id} إلى المهملات`).catch(() => null);
      const { error } = await supabase
        .from("students")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم نقل الطالب إلى سلة المحذوفات");
      qc.invalidateQueries({ queryKey: ["students"] });
      setDeleting(null);
    },
    onError: (e: Error) => toast.error(getErrorMessage(e)),
  });

  const battalionCounts = useMemo(() => {
    const map = new Map<string, number>();
    students.forEach((s) => {
      if (s.battalion_id) map.set(s.battalion_id, (map.get(s.battalion_id) ?? 0) + 1);
    });
    return map;
  }, [students]);

  const companyCounts = useMemo(() => {
    const map = new Map<string, number>();
    students.forEach((s) => {
      if (s.company_id) map.set(s.company_id, (map.get(s.company_id) ?? 0) + 1);
    });
    return map;
  }, [students]);

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
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <BookOpen className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold leading-tight truncate">
                منصة إدارة الطلاب القرآنية
              </h1>
              <p className="text-xs text-muted-foreground hidden sm:block">
                لوحة تحكم لإدارة الطلاب والمتابعة
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ExportReportDialog />
            <BackupDataButton />
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link to="/trash">
                <Trash className="h-4 w-4" />
                <span className="hidden sm:inline">سلة المحذوفات</span>
              </Link>
            </Button>
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
            <Button onClick={() => setAddOpen(true)} className="gap-2" size="sm">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">إضافة طالب جديد</span>
              <span className="sm:hidden">إضافة</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* Total */}
        <section className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={<Users className="h-5 w-5" />}
            label="إجمالي الطلاب"
            value={students.length}
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
                className="pr-9"
              />
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
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <Th>الرقم التعريفي</Th>
                  <Th>الاسم الكامل</Th>
                  <Th>الكتيبة</Th>
                  <Th className="hidden sm:table-cell">السرية</Th>
                  <Th className="hidden md:table-cell">تاريخ الإضافة</Th>
                  <Th className="text-left">إجراءات</Th>
                </tr>
              </thead>
              <tbody>
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setAddOpen(true)}
                          className="gap-1"
                        >
                          <Plus className="h-4 w-4" /> أضف أول طالب
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((s) => (
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
                      <td className="px-4 py-3 font-mono text-xs text-primary font-semibold">
                        {s.student_code}
                      </td>
                      <td className="px-4 py-3 font-medium">{s.full_name}</td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className="font-normal">
                          {battalionName(s.battalion_id)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">
                        {companyName(s.company_id)}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
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
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {filtered.length > 0 && (
            <div className="border-t px-4 py-2 text-xs text-muted-foreground bg-muted/30">
              عدد النتائج: {filtered.length}
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
      className={`px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide ${className}`}
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

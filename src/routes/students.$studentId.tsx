import { getErrorMessage } from "@/lib/errors";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import {
  ArrowRight,
  BookOpen,
  Plus,
  Pencil,
  Trash2,
  Calendar as CalendarIcon,
  ScrollText,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SURAHS, getSurahByName } from "@/lib/quran";

import { Button } from "@/components/ui/button";
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

type Student = Tables<"students">;
type Recitation = Tables<"recitations">;

export const Route = createFileRoute("/students/$studentId")({
  component: StudentProfilePage,
});

function StudentProfilePage() {
  const { studentId } = Route.useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const goBack = () => {
    if (window.history.length > 1) router.history.back();
    else router.navigate({ to: "/" });
  };

  const { data: battalions = [] } = useBattalions();
  const { data: companies = [] } = useCompanies();

  const { data: student, isLoading } = useQuery({
    queryKey: ["student", studentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("id", studentId)
        .maybeSingle();
      if (error) throw error;
      return data as Student | null;
    },
  });

  const { data: recitations = [] } = useQuery({
    queryKey: ["recitations", studentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recitations")
        .select("*")
        .eq("student_id", studentId)
        .order("recited_on", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Recitation[];
    },
  });

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

  const battalionName =
    battalions.find((b) => b.id === student?.battalion_id)?.name ?? "—";
  const companyName =
    companies.find((c) => c.id === student?.company_id)?.name ?? "—";

  const addMutation = useMutation({
    mutationFn: async (values: RecitationFormValues) => {
      const { error } = await supabase.from("recitations").insert({
        student_id: studentId,
        ...values,
      });
      if (error) throw error;
      // Auto-mark attendance as present for that day
      const { error: attErr } = await supabase
        .from("attendance")
        .upsert(
          { student_id: studentId, attended_on: values.recited_on, present: true },
          { onConflict: "student_id,attended_on" },
        );
      if (attErr) throw attErr;
    },
    onSuccess: () => {
      toast.success("تم حفظ التسميع وتسجيل الحضور");
      qc.invalidateQueries({ queryKey: ["recitations", studentId] });
      qc.invalidateQueries({ queryKey: ["attendance"] });
      setAddOpen(false);
    },
    onError: (e: Error) => toast.error(getErrorMessage(e)),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: RecitationFormValues }) => {
      const { error } = await supabase
        .from("recitations")
        .update(values)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم تحديث التسميع");
      qc.invalidateQueries({ queryKey: ["recitations", studentId] });
      setEditing(null);
    },
    onError: (e: Error) => toast.error(getErrorMessage(e)),
  });

  const inlineMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Recitation> }) => {
      const { error } = await supabase.from("recitations").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recitations", studentId] });
    },
    onError: (e: Error) => toast.error(getErrorMessage(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("recitations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حذف التسميع");
      qc.invalidateQueries({ queryKey: ["recitations", studentId] });
      setDeleting(null);
    },
    onError: (e: Error) => toast.error(getErrorMessage(e)),
  });

  if (isLoading) {
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
      <header className="border-b bg-card/60 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" className="gap-2" onClick={goBack}>
            <ArrowRight className="h-4 w-4" />
            <span>العودة</span>
          </Button>
          <span className="font-mono text-xs text-primary font-semibold">
            {student.student_code}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
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


        {/* Recitations log */}
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
            <ul className="divide-y">
              {recitations.map((r) => (
                <RecitationRow
                  key={r.id}
                  rec={r}
                  onPatch={(patch) => inlineMutation.mutate({ id: r.id, patch })}
                  onEdit={() => setEditing(r)}
                  onDelete={() => setDeleting(r)}
                />
              ))}
            </ul>
          )}
        </section>
      </main>


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
                rating: (editing as Recitation & { rating?: string | null }).rating ?? "",
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

const RATING_BUTTONS: { value: string; label: string; tone: "score" | "repeat" | "review" }[] = [
  { value: "10", label: "10", tone: "score" },
  { value: "9", label: "9", tone: "score" },
  { value: "8", label: "8", tone: "score" },
  { value: "repeat", label: "إعادة", tone: "repeat" },
  { value: "review", label: "مراجعة", tone: "review" },
];

function RecitationRow({
  rec,
  onPatch,
  onEdit,
  onDelete,
}: {
  rec: Recitation;
  onPatch: (patch: Partial<Recitation>) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [notes, setNotes] = useState(rec.notes ?? "");
  // Keep local notes in sync if upstream changes (e.g. after refetch)
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
    // Numeric or repeat — clear review and toggle rating
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
    <li className="px-3 sm:px-4 py-3 hover:bg-accent/30">
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        {/* Date */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap lg:w-28">
          <CalendarIcon className="h-3.5 w-3.5" />
          {new Date(rec.recited_on).toLocaleDateString("ar-EG")}
        </div>

        {/* Surah */}
        <div className="font-semibold text-sm lg:w-44 truncate flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary shrink-0" />
          <span className="truncate">{rec.surah}</span>
          {rec.is_review && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30 shrink-0">
              مراجعة
            </span>
          )}
          <span className="text-[10px] text-muted-foreground font-mono shrink-0">
            ({rec.from_ayah}–{rec.to_ayah})
          </span>
        </div>

        {/* Notes inline */}
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={saveNotes}
          placeholder="ملاحظات..."
          maxLength={2000}
          className="flex-1 h-9 text-sm"
        />

        {/* Rating buttons */}
        <div className="flex gap-1 flex-wrap lg:flex-nowrap">
          {RATING_BUTTONS.map((b) => {
            const active = currentRating === b.value;
            const variant =
              active
                ? b.tone === "repeat"
                  ? "destructive"
                  : b.tone === "review"
                    ? "secondary"
                    : "default"
                : "outline";
            return (
              <Button
                key={b.value}
                size="sm"
                variant={variant}
                onClick={() => setRating(b.value)}
                className="h-8 px-2 min-w-[40px] text-xs"
                type="button"
              >
                {b.label}
              </Button>
            );
          })}
          <Button
            size="icon"
            variant="ghost"
            onClick={onEdit}
            className="h-8 w-8"
            title="تعديل كامل"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={onDelete}
            className="h-8 w-8"
            title="حذف"
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      </div>
    </li>
  );
}

function RecitationForm({
  initial,
  submitLabel = "حفظ",
  onSubmit,
  onCancel,
  loading,
}: {
  initial?: Partial<RecitationFormValues>;
  submitLabel?: string;
  onSubmit: (v: RecitationFormValues) => void;
  onCancel?: () => void;
  loading?: boolean;
}) {
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
              {SURAHS.map((s) => (
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
              {SURAHS.filter(
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
            const isActive = rating === v;
            const isRepeat = v === "repeat";
            return (
              <Button
                key={v}
                type="button"
                size="sm"
                variant={
                  isActive ? (isRepeat ? "destructive" : "default") : "outline"
                }
                onClick={() => {
                  if (isRepeat && !isActive) {
                    toast.warning(
                      "تم اختيار 'إعادة' — لن تُحتسب ضمن معدّل الإتقان.",
                    );
                  }
                  setRating(isActive ? "" : v);
                }}
                className="min-w-[56px]"
              >
                {isRepeat ? "إعادة" : `${v}/10`}
              </Button>
            );
          })}
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

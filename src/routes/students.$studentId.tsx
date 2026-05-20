import { getErrorMessage } from "@/lib/errors";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState, useRef } from "react";
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
  ChevronsUpDown,
  ChevronUp,
  ChevronDown,
  Check,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase">
                      التاريخ
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase">
                      السورة
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase">
                      الآيات
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase hidden md:table-cell">
                      التقييم / ملاحظات
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase">
                      إجراءات
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recitations.map((r) => (
                    <tr key={r.id} className="border-t hover:bg-accent/30">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <CalendarIcon className="h-3.5 w-3.5" />
                          {new Date(r.recited_on).toLocaleDateString("ar-EG")}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span>{r.surah}</span>
                          <RatingBadge rating={(r as Recitation & { rating?: string | null }).rating ?? null} />
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {r.from_ayah} – {r.to_ayah}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-muted-foreground max-w-xs">
                        <div className="line-clamp-2 whitespace-pre-wrap">
                          {r.notes?.trim() || "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-left">
                        <div className="flex gap-1 justify-end">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setEditing(r)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setDeleting(r)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
};

function RatingBadge({ rating }: { rating: string | null }) {
  if (!rating) return null;
  if (rating === "repeat") {
    return (
      <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
        إعادة
      </span>
    );
  }
  return (
    <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
      {rating}/10
    </span>
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
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(initial?.recited_on ?? today);
  const [surah, setSurah] = useState(initial?.surah ?? "");
  const [fromAyah, setFromAyah] = useState<string>(
    initial?.from_ayah?.toString() ?? "",
  );
  const [toAyah, setToAyah] = useState<string>(
    initial?.to_ayah?.toString() ?? "",
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [rating, setRating] = useState<string>(initial?.rating ?? "");
  const [surahOpen, setSurahOpen] = useState(false);
  const surahListRef = useRef<HTMLDivElement | null>(null);
  const scrollSurahList = (delta: number) => {
    surahListRef.current?.scrollBy({ top: delta, behavior: "smooth" });
  };

  const selectedSurah = getSurahByName(surah);
  const maxAyahs = selectedSurah?.ayahs ?? 0;
  const ayahNumbers = Array.from({ length: maxAyahs }, (_, i) => i + 1);
  const fromNum = Number(fromAyah);
  const toAyahNumbers = ayahNumbers.filter((n) => !fromAyah || n >= fromNum);

  const from = Number(fromAyah);
  const to = Number(toAyah);
  const valid =
    !!surah &&
    !!date &&
    !!fromAyah &&
    !!toAyah &&
    from >= 1 &&
    to >= from &&
    to <= maxAyahs;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        onSubmit({
          recited_on: date,
          surah,
          from_ayah: from,
          to_ayah: to,
          notes: notes.trim().slice(0, 2000),
        });
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
        <div className="space-y-2">
          <Label>اسم السورة</Label>
          <Popover open={surahOpen} onOpenChange={setSurahOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                className="w-full justify-between font-normal"
              >
                <span className={surah ? "" : "text-muted-foreground"}>
                  {surah || "اختر سورة..."}
                </span>
                <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="p-0 w-[--radix-popover-trigger-width]"
              dir="rtl"
              align="start"
            >
              <Command>
                <CommandInput placeholder="ابحث عن سورة..." />
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => scrollSurahList(-200)}
                    className="absolute top-0 left-0 right-0 z-10 flex items-center justify-center h-7 bg-gradient-to-b from-popover to-transparent hover:from-accent text-muted-foreground"
                    aria-label="تمرير لأعلى"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <CommandList
                    ref={surahListRef}
                    className="overflow-y-auto overscroll-contain"
                    style={{
                      maxHeight: "min(60vh, 420px)",
                      WebkitOverflowScrolling: "touch",
                      touchAction: "pan-y",
                      paddingTop: "1.75rem",
                      paddingBottom: "1.75rem",
                    }}
                  >
                    <CommandEmpty>لا توجد نتائج</CommandEmpty>
                    <CommandGroup>
                      {SURAHS.map((s) => (
                        <CommandItem
                          key={s.number}
                          value={`${s.number} ${s.name}`}
                          onSelect={() => {
                            setSurah(s.name);
                            setFromAyah("");
                            setToAyah("");
                            setSurahOpen(false);
                          }}
                        >
                          <Check
                            className={`ml-2 h-4 w-4 ${surah === s.name ? "opacity-100" : "opacity-0"}`}
                          />
                          <span className="font-mono text-xs text-muted-foreground ml-2">
                            {s.number}.
                          </span>
                          <span>{s.name}</span>
                          <span className="mr-auto text-xs text-muted-foreground">
                            {s.ayahs} آية
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                  <button
                    type="button"
                    onClick={() => scrollSurahList(200)}
                    className="absolute bottom-0 left-0 right-0 z-10 flex items-center justify-center h-7 bg-gradient-to-t from-popover to-transparent hover:from-accent text-muted-foreground"
                    aria-label="تمرير لأسفل"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>من آية</Label>
          <Select
            value={fromAyah}
            onValueChange={(v) => {
              setFromAyah(v);
              if (toAyah && Number(toAyah) < Number(v)) setToAyah("");
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
        <Label htmlFor="rec-notes">التقييم / ملاحظات (اختياري)</Label>
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

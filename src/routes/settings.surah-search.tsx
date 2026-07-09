import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Search, BookOpen, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrandLogo } from "@/components/BrandLogo";
import { supabase } from "@/integrations/supabase/client";
import { SURAHS } from "@/lib/quran";
import { useBattalions, useCompanies } from "@/lib/orgs";
import { useScopedBattalions, useScopedByBattalion } from "@/lib/department";

export const Route = createFileRoute("/settings/surah-search")({
  component: SurahSearchPage,
});

type Row = {
  id: string;
  student_id: string;
  surah: string;
  from_ayah: number;
  to_ayah: number;
  recited_on: string;
  rating: string | null;
  is_review: boolean;
  students: { id: string; full_name: string; battalion_id: string | null; company_id: string | null } | null;
};

function SurahSearchPage() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const suggestions = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    return SURAHS.filter((s) => s.name.includes(q)).slice(0, 8);
  }, [query]);

  const activeSurah = selected ?? query.trim();

  const { data: battalions = [] } = useBattalions();
  const { data: companies = [] } = useCompanies();
  const scopedBattalions = useScopedBattalions(battalions);
  const scopedBattalionIds = useMemo(() => new Set(scopedBattalions.map((b) => b.id)), [scopedBattalions]);

  const { data: rows = [], isFetching } = useQuery<Row[]>({
    queryKey: ["surah-search", activeSurah],
    enabled: activeSurah.length > 0,
    queryFn: async () => {
      // Find target surah metadata (by exact name or fuzzy contains)
      const target =
        SURAHS.find((s) => s.name === activeSurah) ??
        SURAHS.find((s) => s.name.includes(activeSurah) || activeSurah.includes(s.name));

      // Fetch all distinct surah strings stored in DB
      const { data: distinctRows, error: dErr } = await supabase
        .from("recitations")
        .select("surah")
        .limit(5000);
      if (dErr) throw dErr;
      const allSurahs = Array.from(
        new Set((distinctRows ?? []).map((r: { surah: string }) => r.surah).filter(Boolean)),
      );

      // Match: exact contains target name, OR is a range "A - B" whose span includes target
      const matching = allSurahs.filter((s) => {
        if (!target) return s.includes(activeSurah);
        if (s.includes(target.name)) return true;
        const parts = s.split(/\s*[-–]\s*/);
        if (parts.length !== 2) return false;
        const a = SURAHS.find((x) => x.name === parts[0].trim());
        const b = SURAHS.find((x) => x.name === parts[1].trim());
        if (!a || !b) return false;
        const lo = Math.min(a.number, b.number);
        const hi = Math.max(a.number, b.number);
        return target.number >= lo && target.number <= hi;
      });

      if (matching.length === 0) return [];

      const { data, error } = await supabase
        .from("recitations")
        .select(
          "id, student_id, surah, from_ayah, to_ayah, recited_on, rating, is_review, students!inner(id, full_name, battalion_id, company_id)",
        )
        .in("surah", matching)
        .is("students.deleted_at", null)
        .order("recited_on", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const scopedRows = useScopedByBattalion(
    rows
      .filter((r) => r.students)
      .map((r) => ({ ...r, battalion_id: r.students!.battalion_id })),
  );

  // Group by student
  const grouped = useMemo(() => {
    const map = new Map<string, { student: Row["students"]; items: Row[] }>();
    for (const r of scopedRows) {
      if (!r.students) continue;
      const key = r.students.id;
      if (!map.has(key)) map.set(key, { student: r.students, items: [] });
      map.get(key)!.items.push(r);
    }
    return Array.from(map.values()).sort((a, b) =>
      (a.student?.full_name ?? "").localeCompare(b.student?.full_name ?? "", "ar"),
    );
  }, [scopedRows]);

  const battalionName = (id: string | null) => battalions.find((b) => b.id === id)?.name ?? "";
  const companyName = (id: string | null) => companies.find((c) => c.id === id)?.name ?? "";

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <header className="border-b bg-card/60 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Button asChild variant="ghost" size="sm" className="gap-2">
            <Link to="/settings">
              <ArrowRight className="h-4 w-4" />
              <span>العودة</span>
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <BrandLogo size="sm" />
            <h1 className="font-bold text-sm sm:text-base text-primary">البحث بالسورة</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <section className="bg-card border rounded-2xl shadow-soft p-4 sm:p-5">
          <label className="text-sm font-semibold mb-2 block">اكتب اسم السورة</label>
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelected(null);
              }}
              placeholder="مثال: الملك"
              className="pr-9"
            />
          </div>
          {query && suggestions.length > 0 && selected !== query && (
            <ul className="mt-2 border rounded-lg divide-y max-h-56 overflow-auto">
              {suggestions.map((s) => (
                <li key={s.number}>
                  <button
                    type="button"
                    className="w-full text-right px-3 py-2 hover:bg-accent/50 text-sm flex items-center gap-2"
                    onClick={() => {
                      setSelected(s.name);
                      setQuery(s.name);
                    }}
                  >
                    <BookOpen className="h-4 w-4 text-primary" />
                    <span>{s.name}</span>
                    <span className="text-xs text-muted-foreground mr-auto">جزء {s.juz}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {activeSurah && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-base">
                من سمّع «{activeSurah}»
                <span className="text-xs text-muted-foreground mr-2">
                  ({grouped.length} طالب / {scopedRows.length} سجل)
                </span>
              </h2>
              {isFetching && <span className="text-xs text-muted-foreground">جاري البحث…</span>}
            </div>

            {grouped.length === 0 && !isFetching && (
              <p className="text-center text-muted-foreground text-sm py-8 border rounded-xl bg-card">
                لا يوجد طلاب سمّعوا هذه السورة.
              </p>
            )}

            <ul className="space-y-3">
              {grouped.map(({ student, items }) => (
                <li key={student!.id} className="bg-card border rounded-2xl shadow-soft p-4">
                  <Link
                    to="/students/$studentId"
                    params={{ studentId: student!.id }}
                    className="flex items-center gap-3 hover:text-primary transition-colors"
                  >
                    <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <User className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-sm truncate">{student!.full_name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {[battalionName(student!.battalion_id), companyName(student!.company_id)]
                          .filter(Boolean)
                          .join(" — ")}
                      </div>
                    </div>
                    <span className="text-xs bg-primary/10 text-primary rounded-full px-2 py-1">
                      {items.length} مرة
                    </span>
                  </Link>
                  <ul className="mt-3 pt-3 border-t space-y-1.5">
                    {items.slice(0, 5).map((r) => (
                      <li key={r.id} className="text-xs flex items-center justify-between gap-2">
                        <span className="text-muted-foreground">
                          {r.recited_on} · آية {r.from_ayah}–{r.to_ayah}
                          {r.is_review && <span className="mr-1 text-amber-600">(مراجعة)</span>}
                        </span>
                        {r.rating && (
                          <span className="text-primary font-semibold">
                            {r.rating === "repeat" ? "يعيد" : r.rating}
                          </span>
                        )}
                      </li>
                    ))}
                    {items.length > 5 && (
                      <li className="text-xs text-muted-foreground text-center">
                        …و {items.length - 5} سجل آخر
                      </li>
                    )}
                  </ul>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}

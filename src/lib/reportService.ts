import type { Tables } from "@/integrations/supabase/types";

type Recitation = Tables<"recitations">;
type Student = Tables<"students">;

export function parseReportDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;

  const dmy = dateStr.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (dmy) {
    let [, d, m, y] = dmy;
    let yearNum = Number(y);
    if (yearNum < 100) yearNum += 2000;
    const dayNum = Number(d);
    const monthNum = Number(m);
    if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) return null;
    const result = new Date(Date.UTC(yearNum, monthNum - 1, dayNum));
    if (result.getUTCDate() !== dayNum || result.getUTCMonth() !== monthNum - 1) return null;
    return result;
  }

  const iso = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const result = new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
    if (result.getUTCDate() !== Number(iso[3]) || result.getUTCMonth() !== Number(iso[2]) - 1) return null;
    return result;
  }

  return null;
}

export function formatReportDate(dateStr: string | null | undefined, fallback = "—"): string {
  const d = parseReportDate(dateStr);
  if (!d) return dateStr || fallback;
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

export function formatArabicReportDate(dateStr: string | null | undefined): string {
  const d = parseReportDate(dateStr);
  if (!d) return dateStr || "—";
  return new Intl.DateTimeFormat("ar-EG", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(d);
}

export function compareReportDates(a: string | null | undefined, b: string | null | undefined): number {
  const da = parseReportDate(a)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  const db = parseReportDate(b)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  if (da !== db) return da - db;
  return String(a ?? "").localeCompare(String(b ?? ""), "ar");
}

export function sortRecitationsByDateAsc<T extends Pick<Recitation, "recited_on"> & { created_at?: string | null }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const byDate = compareReportDates(a.recited_on, b.recited_on);
    if (byDate !== 0) return byDate;
    return String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""));
  });
}

export function formatRecitationRating(r: Pick<Recitation, "rating" | "is_review">): string {
  if (r.is_review) return "مراجعة";
  if (r.rating === "repeat") return "إعادة";
  if (r.rating) return `${r.rating}/10`;
  return "—";
}

export function buildRecitationDetail(r: Recitation): string {
  const notes = r.notes?.trim() ? ` (${r.notes.trim()})` : "";
  return `${formatReportDate(r.recited_on)}: ${r.surah} ${r.from_ayah}-${r.to_ayah} [${formatRecitationRating(r)}]${notes}`;
}

export function validateStudentReportData(student: Student | null | undefined, recitations: Recitation[]): string[] {
  const errors: string[] = [];
  if (!student?.full_name?.trim()) errors.push("اسم الطالب مفقود");
  if (recitations.length === 0) errors.push("لا توجد سور/تسميعات لتوليد التقرير");

  recitations.forEach((r, i) => {
    const label = `السجل رقم ${i + 1}${r.recited_on ? ` بتاريخ ${formatReportDate(r.recited_on)}` : ""}`;
    if (!parseReportDate(r.recited_on)) errors.push(`${label}: التاريخ غير صحيح`);
    if (!r.surah?.trim()) errors.push(`${label}: اسم السورة مفقود`);
    if (!Number.isFinite(r.from_ayah) || !Number.isFinite(r.to_ayah)) errors.push(`${label}: أرقام الآيات غير صحيحة`);
    if (!r.is_review && !r.rating) errors.push(`${label}: التقييم مفقود`);
  });

  return errors;
}
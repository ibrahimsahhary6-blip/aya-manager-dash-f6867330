import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SearchSchema = z.object({
  name: z.string().trim().max(120).optional().default(""),
  code: z.string().trim().max(40).optional().default(""),
});

function normalizeAr(s: string): string {
  if (!s) return "";
  const map: Record<string, string> = {
    "أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا",
    "ى": "ي", "ة": "ه", "ؤ": "و", "ئ": "ي", "ـ": "",
    "ً": "", "ٌ": "", "ٍ": "", "َ": "", "ُ": "", "ِ": "", "ّ": "", "ْ": "",
  };
  let out = "";
  for (const ch of s) out += map[ch] ?? ch;
  return out.toLowerCase().trim().replace(/\s+/g, " ");
}

export const publicSearchStudents = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => SearchSchema.parse(d))
  .handler(async ({ data }) => {
    const name = (data.name ?? "").trim();
    const code = (data.code ?? "").trim();
    if (!name && !code) {
      return { results: [] as Array<{ id: string; full_name: string; student_code: string }> };
    }

    let query = supabaseAdmin
      .from("students")
      .select("id, full_name, student_code")
      .is("deleted_at", null)
      .limit(200);

    if (code) query = query.ilike("student_code", `%${code}%`);
    if (name) {
      // Try DB-level fuzzy match on first token to narrow results before JS normalization
      const firstToken = name.split(/\s+/)[0] ?? name;
      if (firstToken) query = query.ilike("full_name", `%${firstToken}%`);
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const nNeedle = normalizeAr(name);
    const filtered = (rows ?? []).filter((r) => {
      if (!name) return true;
      return normalizeAr(r.full_name).includes(nNeedle);
    });

    return {
      results: filtered.slice(0, 20).map((r) => ({
        id: r.id,
        full_name: r.full_name,
        student_code: r.student_code,
      })),
    };
  });

const HistorySchema = z.object({ studentId: z.string().uuid() });

export const publicGetStudentHistory = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => HistorySchema.parse(d))
  .handler(async ({ data }) => {
    const { data: student, error } = await supabaseAdmin
      .from("students")
      .select("id, full_name, student_code")
      .eq("id", data.studentId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!student) throw new Error("لم يتم العثور على الطالب");

    const [{ data: recitations }, { data: attendance }] = await Promise.all([
      supabaseAdmin
        .from("recitations")
        .select("id, recited_on, surah, from_ayah, to_ayah, is_review, rating, notes")
        .eq("student_id", student.id)
        .order("recited_on", { ascending: false })
        .limit(500),
      supabaseAdmin
        .from("attendance")
        .select("id, attended_on, present, rating")
        .eq("student_id", student.id)
        .order("attended_on", { ascending: false })
        .limit(500),
    ]);

    return {
      student: { id: student.id, full_name: student.full_name, student_code: student.student_code },
      recitations: recitations ?? [],
      attendance: attendance ?? [],
    };
  });

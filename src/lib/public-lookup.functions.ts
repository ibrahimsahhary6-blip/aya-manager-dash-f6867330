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

function maskCode(code: string): string {
  if (!code) return "";
  if (code.length <= 4) return "***";
  return code.slice(0, 3) + "***" + code.slice(-2);
}

function maskName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts
    .map((p) => (p.length <= 2 ? p : p[0] + "•".repeat(Math.max(1, p.length - 2)) + p[p.length - 1]))
    .join(" ");
}

export const publicSearchStudents = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => SearchSchema.parse(d))
  .handler(async ({ data }) => {
    const name = (data.name ?? "").trim();
    const code = (data.code ?? "").trim();
    if (!name && !code) {
      return { results: [] as Array<{ id: string; maskedName: string; maskedCode: string }> };
    }

    let query = supabaseAdmin
      .from("students")
      .select("id, full_name, student_code")
      .is("deleted_at", null)
      .limit(20);

    if (code) query = query.ilike("student_code", `%${code}%`);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const nNeedle = normalizeAr(name);
    const filtered = (rows ?? []).filter((r) => {
      if (!name) return true;
      return normalizeAr(r.full_name).includes(nNeedle);
    });

    return {
      results: filtered.slice(0, 15).map((r) => ({
        id: r.id,
        maskedName: maskName(r.full_name),
        maskedCode: maskCode(r.student_code),
      })),
    };
  });

const VerifySchema = z.object({
  studentId: z.string().uuid(),
  verification: z.string().trim().min(1).max(120),
});

export const publicGetStudentHistory = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => VerifySchema.parse(d))
  .handler(async ({ data }) => {
    const { data: student, error } = await supabaseAdmin
      .from("students")
      .select("id, full_name, student_code")
      .eq("id", data.studentId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!student) throw new Error("لم يتم العثور على الطالب");

    const v = data.verification.trim();
    const ok =
      v.toLowerCase() === student.student_code.toLowerCase() ||
      normalizeAr(v) === normalizeAr(student.full_name);

    if (!ok) {
      throw new Error("فشل التحقق: الرجاء إدخال رقم الطالب الكامل أو الاسم الكامل بدقة");
    }

    const [{ data: recitations }, { data: attendance }] = await Promise.all([
      supabaseAdmin
        .from("recitations")
        .select("id, recited_on, surah, from_ayah, to_ayah, is_review, rating, notes")
        .eq("student_id", student.id)
        .order("recited_on", { ascending: false })
        .limit(200),
      supabaseAdmin
        .from("attendance")
        .select("id, attended_on, present, rating")
        .eq("student_id", student.id)
        .order("attended_on", { ascending: false })
        .limit(200),
    ]);

    return {
      student: { id: student.id, full_name: student.full_name, student_code: student.student_code },
      recitations: recitations ?? [],
      attendance: attendance ?? [],
    };
  });

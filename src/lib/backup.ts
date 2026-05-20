import { supabase } from "@/integrations/supabase/client";

export const BACKUP_TABLES = [
  "battalions",
  "companies",
  "students",
  "recitations",
  "attendance",
] as const;

export type BackupKind = "manual" | "daily" | "pre_delete";

export type BackupPayload = Record<string, unknown[]>;

export async function snapshotAll(): Promise<BackupPayload> {
  const payload: BackupPayload = {};
  for (const t of BACKUP_TABLES) {
    const { data, error } = await supabase.from(t).select("*");
    if (error) throw error;
    payload[t] = data ?? [];
  }
  return payload;
}

export async function createBackup(kind: BackupKind, note?: string) {
  const payload = await snapshotAll();
  const { data, error } = await supabase
    .from("backups")
    .insert({ kind, note: note ?? null, payload })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return (
    "\uFEFF" +
    [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n")
  );
}

export function downloadBlob(filename: string, content: string, mime = "text/csv;charset=utf-8;") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

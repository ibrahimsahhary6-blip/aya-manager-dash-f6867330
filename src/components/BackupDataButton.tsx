import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(",")];
  for (const r of rows) lines.push(headers.map((h) => escape(r[h])).join(","));
  return "\uFEFF" + lines.join("\n");
}

function download(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function BackupDataButton() {
  const [loading, setLoading] = useState(false);

  const handleBackup = async () => {
    setLoading(true);
    try {
      const date = new Date().toISOString().slice(0, 10);
      const tables = ["battalions", "companies", "students", "recitations", "attendance"] as const;

      for (const t of tables) {
        const { data, error } = await supabase.from(t).select("*");
        if (error) throw error;
        download(`${t}_${date}.csv`, toCSV(data ?? []));
      }
      toast.success("تم تصدير جميع البيانات بنجاح");
    } catch (e) {
      console.error(e);
      toast.error("فشل تصدير البيانات");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleBackup}
      disabled={loading}
      variant="outline"
      size="sm"
      className="gap-2"
      title="نسخة احتياطية: تصدير الطلاب والكتائب والسرايا والتسميع والحضور"
    >
      <Download className="h-4 w-4" />
      <span className="hidden sm:inline">{loading ? "جاري التصدير..." : "نسخة احتياطية"}</span>
    </Button>
  );
}

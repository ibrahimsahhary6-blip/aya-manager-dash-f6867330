import { useEffect, useState } from "react";
import { Database, Download, Upload, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getErrorMessage } from "@/lib/errors";
import { Button } from "@/components/ui/button";
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
import { useQueryClient } from "@tanstack/react-query";

type BackupRow = {
  id: string;
  kind: string;
  note: string | null;
  created_at: string;
  payload: BackupPayload;
};

type BackupPayload = {
  battalions: any[];
  companies: any[];
  students: any[];
  attendance: any[];
  recitations: any[];
};

const TABLES = ["battalions", "companies", "students", "attendance", "recitations"] as const;

async function snapshot(): Promise<BackupPayload> {
  const result: any = {};
  for (const t of TABLES) {
    const { data, error } = await supabase.from(t).select("*");
    if (error) throw error;
    result[t] = data ?? [];
  }
  return result as BackupPayload;
}

export function BackupRestore() {
  const qc = useQueryClient();
  const [backups, setBackups] = useState<BackupRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState<BackupRow | null>(null);
  const [deleting, setDeleting] = useState<BackupRow | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("backups")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) toast.error(getErrorMessage(error));
    else setBackups((data ?? []) as BackupRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    setBusy(true);
    try {
      const payload = await snapshot();
      const note = `يدوي - ${new Date().toLocaleString("ar")}`;
      const { error } = await supabase
        .from("backups")
        .insert({ kind: "manual", note, payload: payload as any });
      if (error) throw error;
      toast.success("تم إنشاء النسخة الاحتياطية");
      await load();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = async (b: BackupRow) => {
    const blob = new Blob([JSON.stringify(b.payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backup-${b.created_at.slice(0, 10)}-${b.id.slice(0, 8)}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      a.remove();
      URL.revokeObjectURL(url);
    }, 1000);
  };

  const handleUpload = async (file: File) => {
    setBusy(true);
    try {
      const text = await file.text();
      const payload = JSON.parse(text) as BackupPayload;
      for (const t of TABLES) {
        if (!Array.isArray((payload as any)[t])) {
          throw new Error(`ملف غير صالح: ${t} مفقود`);
        }
      }
      const note = `مرفوع - ${file.name}`;
      const { error } = await supabase
        .from("backups")
        .insert({ kind: "uploaded", note, payload: payload as any });
      if (error) throw error;
      toast.success("تم رفع النسخة، يمكنك الاسترجاع منها");
      await load();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async (b: BackupRow) => {
    setBusy(true);
    try {
      // Safety: create a snapshot before restoring
      const current = await snapshot();
      await supabase.from("backups").insert({
        kind: "pre-restore",
        note: `قبل الاسترجاع من ${b.created_at}`,
        payload: current as any,
      });

      const p = b.payload;
      // Delete in reverse dependency order
      await supabase.from("recitations").delete().not("id", "is", null);
      await supabase.from("attendance").delete().not("id", "is", null);
      await supabase.from("students").delete().not("id", "is", null);
      await supabase.from("companies").delete().not("id", "is", null);
      await supabase.from("battalions").delete().not("id", "is", null);

      // Insert in dependency order
      const insertChunked = async (table: string, rows: any[]) => {
        if (!rows.length) return;
        for (let i = 0; i < rows.length; i += 500) {
          const chunk = rows.slice(i, i + 500);
          const { error } = await supabase.from(table as any).insert(chunk);
          if (error) throw new Error(`${table}: ${error.message}`);
        }
      };
      await insertChunked("battalions", p.battalions);
      await insertChunked("companies", p.companies);
      await insertChunked("students", p.students);
      await insertChunked("attendance", p.attendance);
      await insertChunked("recitations", p.recitations);

      toast.success("تم الاسترجاع بنجاح");
      setRestoring(null);
      qc.invalidateQueries();
      await load();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (b: BackupRow) => {
    setBusy(true);
    try {
      const { error } = await supabase.from("backups").delete().eq("id", b.id);
      if (error) throw error;
      toast.success("تم حذف النسخة");
      setDeleting(null);
      await load();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bg-card rounded-2xl border shadow-soft overflow-hidden lg:col-span-2">
      <div className="p-4 sm:p-6 border-b flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          <Database className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h2 className="font-bold">النسخ الاحتياطي والاسترجاع</h2>
          <p className="text-xs text-muted-foreground">
            احفظ نسخة كاملة من بياناتك واسترجعها متى احتجت
          </p>
        </div>
      </div>

      <div className="p-4 flex flex-wrap gap-2 border-b bg-muted/20">
        <Button onClick={handleCreate} disabled={busy} className="gap-2">
          <Database className="h-4 w-4" />
          إنشاء نسخة احتياطية الآن
        </Button>
        <Button asChild variant="outline" disabled={busy} className="gap-2">
          <label className="cursor-pointer">
            <Upload className="h-4 w-4" />
            رفع نسخة من ملف
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
                e.target.value = "";
              }}
            />
          </label>
        </Button>
      </div>

      <ul className="divide-y max-h-[420px] overflow-y-auto">
        {loading && (
          <li className="p-6 text-center text-muted-foreground text-sm">
            جارٍ التحميل...
          </li>
        )}
        {!loading && backups.length === 0 && (
          <li className="p-6 text-center text-muted-foreground text-sm">
            لا توجد نسخ احتياطية بعد
          </li>
        )}
        {backups.map((b) => {
          const counts = b.payload
            ? {
                bat: b.payload.battalions?.length ?? 0,
                co: b.payload.companies?.length ?? 0,
                st: b.payload.students?.length ?? 0,
                at: b.payload.attendance?.length ?? 0,
                re: b.payload.recitations?.length ?? 0,
              }
            : null;
          return (
            <li key={b.id} className="p-3 sm:p-4 flex flex-wrap items-center gap-2">
              <div className="flex-1 min-w-[200px]">
                <div className="text-sm font-medium">
                  {b.note ?? b.kind}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(b.created_at).toLocaleString("ar")}
                  {counts && (
                    <>
                      {" • "}
                      كتائب {counts.bat} • سرايا {counts.co} • طلاب {counts.st} • حضور {counts.at} • تسميعات {counts.re}
                    </>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={() => handleDownload(b)}
              >
                <Download className="h-4 w-4" />
                تحميل
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                disabled={busy}
                onClick={() => setRestoring(b)}
              >
                <RotateCcw className="h-4 w-4" />
                استرجاع
              </Button>
              <Button
                size="icon"
                variant="ghost"
                disabled={busy}
                onClick={() => setDeleting(b)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </li>
          );
        })}
      </ul>

      <AlertDialog open={!!restoring} onOpenChange={(o) => !o && setRestoring(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الاسترجاع</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم استبدال جميع البيانات الحالية (الكتائب، السرايا، الطلاب، الحضور، التسميعات) ببيانات النسخة المختارة. سيتم إنشاء نسخة احتياطية تلقائية من البيانات الحالية قبل الاسترجاع. هل تريد المتابعة؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={() => restoring && handleRestore(restoring)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy ? "جارٍ الاسترجاع..." : "استرجاع"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف النسخة الاحتياطية</AlertDialogTitle>
            <AlertDialogDescription>
              لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={() => deleting && handleDelete(deleting)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

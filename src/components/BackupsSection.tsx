import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Archive, Download, FileText, Loader2, Trash2 } from "lucide-react";
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
import { createBackup, downloadBlob, toCSV, BACKUP_TABLES, type BackupPayload } from "@/lib/backup";
import { BackupDataButton } from "@/components/BackupDataButton";
import { getErrorMessage } from "@/lib/errors";

const KIND_LABEL: Record<string, string> = {
  manual: "يدوية",
  daily: "تلقائية يومية",
  pre_delete: "قبل حذف",
};

export function BackupsSection({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: backups = [], isLoading } = useQuery({
    queryKey: ["backups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("backups")
        .select("id, kind, note, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const createNow = useMutation({
    mutationFn: () => createBackup("manual", "نسخة يدوية من الإعدادات"),
    onSuccess: () => {
      toast.success("تم إنشاء نسخة احتياطية");
      qc.invalidateQueries({ queryKey: ["backups"] });
    },
    onError: (e: Error) => toast.error(getErrorMessage(e)),
  });

  const downloadBackup = async (id: string, kind: string, createdAt: string) => {
    try {
      const { data, error } = await supabase
        .from("backups")
        .select("payload")
        .eq("id", id)
        .single();
      if (error) throw error;
      const payload = data.payload as unknown as BackupPayload;
      const date = new Date(createdAt).toISOString().slice(0, 19).replace(/[:T]/g, "-");
      // JSON full
      downloadBlob(
        `backup_${kind}_${date}.json`,
        JSON.stringify(payload, null, 2),
        "application/json"
      );
      // CSVs
      for (const t of BACKUP_TABLES) {
        downloadBlob(`${t}_${date}.csv`, toCSV((payload[t] ?? []) as Record<string, unknown>[]));
      }
      toast.success("تم تنزيل النسخة");
    } catch (e) {
      toast.error(getErrorMessage(e as Error));
    }
  };

  const deleteBackup = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("backups").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم الحذف");
      setDeletingId(null);
      qc.invalidateQueries({ queryKey: ["backups"] });
    },
    onError: (e: Error) => toast.error(getErrorMessage(e)),
  });

  return (
    <div className="rounded-xl border bg-card p-4 sm:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <Archive className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 className="font-bold text-base sm:text-lg">النسخ الاحتياطي والأمان</h2>
          <p className="text-xs text-muted-foreground">
            نسخة كاملة من الكتائب والسرايا والطلاب والتسميع والحضور — تلقائياً كل 24 ساعة وقبل أي حذف
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => createNow.mutate()} disabled={createNow.isPending} className="gap-2">
          {createNow.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Archive className="h-4 w-4" />
          )}
          إنشاء نسخة الآن
        </Button>
        <BackupDataButton />
      </div>

      <div className="border-t pt-4">
        <h3 className="text-sm font-semibold mb-2">آخر النسخ المحفوظة ({backups.length})</h3>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">جاري التحميل...</p>
        ) : backups.length === 0 ? (
          <p className="text-sm text-muted-foreground">لا توجد نسخ بعد. أنشئ أول نسخة الآن.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {backups.map((b) => (
              <li
                key={b.id}
                className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 text-sm"
              >
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">
                    {new Date(b.created_at).toLocaleString("ar-EG")}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {KIND_LABEL[b.kind] ?? b.kind}
                    {b.note ? ` — ${b.note}` : ""}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 shrink-0"
                  onClick={() => downloadBackup(b.id, b.kind, b.created_at)}
                >
                  <Download className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">تنزيل</span>
                </Button>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive shrink-0"
                    onClick={() => setDeletingId(b.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف هذه النسخة الاحتياطية؟</AlertDialogTitle>
            <AlertDialogDescription>لا يمكن التراجع عن هذا الإجراء.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingId && deleteBackup.mutate(deletingId)}
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

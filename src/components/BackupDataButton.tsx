import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { snapshotAll, toCSV, downloadBlob, BACKUP_TABLES } from "@/lib/backup";

export function BackupDataButton() {
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    setLoading(true);
    try {
      const payload = await snapshotAll();
      const date = new Date().toISOString().slice(0, 10);
      for (const t of BACKUP_TABLES) {
        downloadBlob(`${t}_${date}.csv`, toCSV((payload[t] ?? []) as Record<string, unknown>[]));
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
      onClick={handle}
      disabled={loading}
      variant="outline"
      size="sm"
      className="gap-2"
      title="تصدير الكتائب والسرايا والطلاب والتسميع والحضور كملفات CSV"
    >
      <Download className="h-4 w-4" />
      <span className="hidden sm:inline">{loading ? "جاري التصدير..." : "تصدير CSV"}</span>
    </Button>
  );
}

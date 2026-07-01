import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Cloud, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  getOfflineSyncState,
  subscribeOfflineSync,
  syncAllOfflineData,
  type OfflineSyncState,
} from "@/lib/offline-sync";
import { getErrorMessage } from "@/lib/errors";

export function OfflineSyncButton({ compact = false }: { compact?: boolean }) {
  const qc = useQueryClient();
  const [syncState, setSyncState] = useState<OfflineSyncState>(() => getOfflineSyncState());

  useEffect(() => subscribeOfflineSync(setSyncState), []);

  const syncing = syncState.status === "syncing";
  const value = syncState.total > 0 ? Math.round((syncState.progress / syncState.total) * 100) : 0;

  const handleSync = async () => {
    try {
      const result = await syncAllOfflineData({ force: true });
      if (!result.skipped) {
        await Promise.all([
          qc.invalidateQueries({ queryKey: ["students"] }),
          qc.invalidateQueries({ queryKey: ["departments"] }),
          qc.invalidateQueries({ queryKey: ["battalions"] }),
          qc.invalidateQueries({ queryKey: ["companies"] }),
        ]);
      }
      toast.success("تمت المزامنة وتجهيز بيانات الطلاب بدون إنترنت");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <div className={cn("flex items-center gap-2", compact && "min-w-0")} dir="rtl">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={handleSync}
        disabled={syncing}
        title="مزامنة كل بيانات الطلاب للعمل بدون إنترنت"
      >
        {syncing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Cloud className="h-4 w-4" />}
        <span className={compact ? "hidden sm:inline" : "inline"}>{syncing ? "مزامنة" : "مزامنة الآن"}</span>
      </Button>
      {syncing && !compact && (
        <div className="hidden w-36 sm:block">
          <Progress value={value} className="h-1.5" />
        </div>
      )}
    </div>
  );
}

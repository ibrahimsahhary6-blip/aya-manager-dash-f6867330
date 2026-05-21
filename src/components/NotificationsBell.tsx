import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsSuperAdmin } from "@/lib/roles";
import { Bell } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

const ACTION_LABEL: Record<string, string> = {
  student_created: "إضافة طالب",
  student_updated: "تعديل طالب",
  student_deleted: "حذف طالب",
  student_restored: "استرجاع طالب",
  student_purged: "حذف نهائي لطالب",
  battalion_created: "إضافة كتيبة",
  battalion_updated: "تعديل كتيبة",
  battalion_deleted: "حذف كتيبة",
  company_created: "إضافة سرية",
  company_updated: "تعديل سرية",
  company_deleted: "حذف سرية",
  attendance_created: "تسجيل حضور",
  attendance_updated: "تعديل حضور",
  attendance_deleted: "حذف حضور",
  recitation_created: "إضافة تسميع",
  recitation_updated: "تعديل تسميع",
  recitation_deleted: "حذف تسميع",
  user_approved: "تمت الموافقة على مستخدم",
  user_unapproved: "إلغاء موافقة مستخدم",
  email_invited: "دعوة إيميل",
  email_removed: "إزالة إيميل",
  role_granted: "منح صلاحية",
  role_revoked: "سحب صلاحية",
};

const LAST_SEEN_KEY = "notifications-last-seen-v1";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "الآن";
  if (m < 60) return `قبل ${m} د`;
  const h = Math.floor(m / 60);
  if (h < 24) return `قبل ${h} س`;
  const d = Math.floor(h / 24);
  return `قبل ${d} ي`;
}

export function NotificationsBell() {
  const canSee = useIsSuperAdmin();
  const [open, setOpen] = useState(false);
  const [lastSeen, setLastSeen] = useState<string>(() => {
    if (typeof window === "undefined") return new Date(0).toISOString();
    return localStorage.getItem(LAST_SEEN_KEY) ?? new Date(0).toISOString();
  });

  const { data: rows = [] } = useQuery({
    queryKey: ["notifications"],
    enabled: canSee,
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("id, created_at, actor_email, action, target_email, metadata")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const unread = useMemo(
    () => rows.filter((r) => new Date(r.created_at) > new Date(lastSeen)).length,
    [rows, lastSeen],
  );

  useEffect(() => {
    if (open && rows.length > 0) {
      const newest = rows[0].created_at;
      localStorage.setItem(LAST_SEEN_KEY, newest);
      setLastSeen(newest);
    }
  }, [open, rows]);

  if (!canSee) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="relative gap-1 px-2">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0" dir="rtl">
        <div className="px-4 py-3 border-b">
          <h3 className="font-bold text-sm">الإشعارات</h3>
          <p className="text-[11px] text-muted-foreground">آخر 50 عملية على المنصة</p>
        </div>
        <div className="max-h-[420px] overflow-y-auto divide-y">
          {rows.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">لا توجد إشعارات.</p>
          ) : (
            rows.map((r) => {
              const meta = (r.metadata ?? {}) as Record<string, unknown>;
              const label = typeof meta.label === "string" ? meta.label : null;
              const isNew = new Date(r.created_at) > new Date(lastSeen);
              return (
                <div key={r.id} className={`px-4 py-2.5 text-sm ${isNew ? "bg-primary/5" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium">
                      {ACTION_LABEL[r.action] ?? r.action}
                      {label && <span className="text-muted-foreground"> — {label}</span>}
                    </span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {timeAgo(r.created_at)}
                    </span>
                  </div>
                  {r.actor_email && (
                    <div className="text-[11px] text-muted-foreground mt-0.5" dir="ltr">
                      {r.actor_email}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

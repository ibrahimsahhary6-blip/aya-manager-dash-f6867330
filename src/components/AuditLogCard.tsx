import { useIsSuperAdmin } from "@/lib/roles";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { History } from "lucide-react";

const ACTION_LABEL: Record<string, string> = {
  user_approved: "تمت الموافقة على المستخدم",
  user_unapproved: "تم إلغاء الموافقة",
  email_invited: "دعوة إيميل جديد",
  email_removed: "إزالة إيميل من القائمة",
  role_granted: "منح صلاحية",
  role_revoked: "سحب صلاحية",
  user_removed_auth_error: "تعذّر حذف حساب المصادقة",
};

const ROLE_LABEL: Record<string, string> = {
  super_admin: "مدير عام",
  admin: "مدير",
  moderator: "مشرف",
  viewer: "قراءة فقط",
  user: "مستخدم",
};

export function AuditLogCard() {
  const isSuperAdmin = useIsSuperAdmin();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["audit_log"],
    enabled: isSuperAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("id, created_at, actor_email, action, target_email, metadata")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!isSuperAdmin) return null;

  return (
    <section className="bg-card rounded-2xl border shadow-soft p-4 sm:p-6 lg:col-span-2">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-10 w-10 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center">
          <History className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-bold">سجل التدقيق</h2>
          <p className="text-xs text-muted-foreground">
            آخر 200 عملية على الموافقات والصلاحيات والدعوات
          </p>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">جارٍ التحميل...</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">لا توجد سجلات بعد.</p>
      ) : (
        <ul className="divide-y border rounded-xl overflow-hidden max-h-[480px] overflow-y-auto">
          {rows.map((r) => {
            const meta = (r.metadata ?? {}) as Record<string, unknown>;
            const role = typeof meta.role === "string" ? ROLE_LABEL[meta.role] ?? meta.role : null;
            return (
              <li key={r.id} className="px-4 py-3 bg-background">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-sm font-semibold">
                    {ACTION_LABEL[r.action] ?? r.action}
                    {role && <span className="text-muted-foreground"> — {role}</span>}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(r.created_at).toLocaleString("ar-EG")}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3" dir="ltr">
                  {r.target_email && <span>الهدف: {r.target_email}</span>}
                  {r.actor_email && <span>بواسطة: {r.actor_email}</span>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, X, Mail, Clock } from "lucide-react";
import {
  approveAccessRequest,
  listPendingAccessRequests,
  rejectAccessRequest,
} from "@/lib/access-requests.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useIsAdmin, useIsSuperAdmin } from "@/lib/roles";
import { getErrorMessage } from "@/lib/errors";

export function AccessRequestsCard() {
  const isAdmin = useIsAdmin();
  const isSuper = useIsSuperAdmin();
  const allowed = isAdmin || isSuper;

  const list = useServerFn(listPendingAccessRequests);
  const approve = useServerFn(approveAccessRequest);
  const reject = useServerFn(rejectAccessRequest);
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["access-requests-pending"],
    enabled: allowed,
    queryFn: () => list({ data: undefined }),
  });

  const approveM = useMutation({
    mutationFn: async (id: string) => {
      const redirectTo = typeof window !== "undefined" ? window.location.origin : undefined;
      return approve({ data: { id, redirectTo } });
    },
    onSuccess: () => {
      toast.success("تمت الموافقة وإرسال رابط الدخول");
      qc.invalidateQueries({ queryKey: ["access-requests-pending"] });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const rejectM = useMutation({
    mutationFn: async (id: string) => reject({ data: { id } }),
    onSuccess: () => {
      toast.success("تم رفض الطلب");
      qc.invalidateQueries({ queryKey: ["access-requests-pending"] });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  if (!allowed) return null;

  const requests = q.data?.requests ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          طلبات الدخول الجديدة
          {requests.length > 0 && (
            <span className="ml-2 rounded-full bg-primary text-primary-foreground text-xs px-2 py-0.5">
              {requests.length}
            </span>
          )}
        </CardTitle>
        <CardDescription>
          عند الموافقة يصل المستخدم رابط دخول مباشر إلى بريده.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {q.isLoading && <p className="text-sm text-muted-foreground">جاري التحميل...</p>}
        {!q.isLoading && requests.length === 0 && (
          <p className="text-sm text-muted-foreground">لا توجد طلبات قيد الانتظار.</p>
        )}
        {requests.map((r) => (
          <div
            key={r.id}
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border p-3"
          >
            <div className="min-w-0">
              <div className="font-medium truncate">{r.full_name}</div>
              <div className="text-xs text-muted-foreground truncate" dir="ltr">
                {r.email}
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <Clock className="h-3 w-3" />
                {new Date(r.requested_at).toLocaleString("ar")}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                size="sm"
                variant="default"
                className="gap-1"
                disabled={approveM.isPending}
                onClick={() => approveM.mutate(r.id)}
              >
                <Check className="h-4 w-4" />
                موافقة
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1 text-destructive"
                disabled={rejectM.isPending}
                onClick={() => rejectM.mutate(r.id)}
              >
                <X className="h-4 w-4" />
                رفض
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

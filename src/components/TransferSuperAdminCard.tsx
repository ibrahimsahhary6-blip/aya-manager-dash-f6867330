import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useIsSuperAdmin } from "@/lib/roles";
import { transferSuperAdmin } from "@/lib/admin-users.functions";
import { getErrorMessage } from "@/lib/errors";

export function TransferSuperAdminCard() {
  const isSuper = useIsSuperAdmin();
  const qc = useQueryClient();
  const fn = useServerFn(transferSuperAdmin);
  const [email, setEmail] = useState("");
  const [confirm, setConfirm] = useState("");
  const [open, setOpen] = useState(false);

  const mut = useMutation({
    mutationFn: async () =>
      fn({ data: { targetEmail: email, confirmEmail: confirm } }),
    onSuccess: (res) => {
      toast.success(`تم نقل صلاحية المدير العام إلى ${res.newSuperAdminEmail}`);
      setEmail("");
      setConfirm("");
      setOpen(false);
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(getErrorMessage(e)),
  });

  if (!isSuper) return null;

  const canSubmit =
    email.trim().length > 0 &&
    confirm.trim().length > 0 &&
    email.trim().toLowerCase() === confirm.trim().toLowerCase();

  return (
    <section className="bg-card rounded-2xl border border-destructive/30 shadow-soft p-4 sm:p-6 lg:col-span-2">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-10 w-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center">
          <ShieldAlert className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-bold">نقل صلاحية المدير العام</h2>
          <p className="text-xs text-muted-foreground">
            عملية حساسة: ستفقد صلاحية المدير العام وتنتقل إلى المستخدم المحدد. ستتحوّل أنت إلى "مدير" عادي.
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          type="email"
          placeholder="إيميل المدير العام الجديد"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          dir="ltr"
        />
        <Input
          type="email"
          placeholder="أعد كتابة الإيميل للتأكيد"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          dir="ltr"
        />
      </div>

      <div className="mt-3 flex justify-end">
        <Button
          variant="destructive"
          disabled={!canSubmit || mut.isPending}
          onClick={() => setOpen(true)}
        >
          نقل الصلاحية
        </Button>
      </div>

      <p className="text-xs text-muted-foreground mt-3">
        ملاحظة: يجب أن يكون المستخدم الجديد قد سجّل دخول إلى المنصة مرة واحدة على الأقل.
      </p>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد نقل صلاحية المدير العام</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم منح صلاحية <span className="font-bold">super_admin</span> للإيميل{" "}
              <span className="font-mono text-foreground">{email}</span> وستفقد أنت هذه الصلاحية فوراً.
              هل أنت متأكد؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => mut.mutate()}
            >
              نعم، انقل الصلاحية
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

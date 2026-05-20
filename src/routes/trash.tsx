import { getErrorMessage } from "@/lib/errors";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { ArrowRight, RotateCcw, Trash2, ShieldAlert, Trash } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { useBattalions } from "@/lib/orgs";
import { useIsAdmin } from "@/lib/roles";

type Student = Tables<"students">;

export const Route = createFileRoute("/trash")({
  component: TrashPage,
});

function TrashPage() {
  const qc = useQueryClient();
  const isAdmin = useIsAdmin();
  const { data: battalions = [] } = useBattalions();
  const battalionName = (id: string | null) =>
    battalions.find((b) => b.id === id)?.name ?? "—";

  const [purging, setPurging] = useState<Student | null>(null);
  const [emptying, setEmptying] = useState(false);

  const { data: deleted = [], isLoading } = useQuery({
    queryKey: ["students", "trash"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });
      if (error) throw error;
      return data as Student[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["students"] });
    qc.invalidateQueries({ queryKey: ["students", "trash"] });
  };

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("students")
        .update({ deleted_at: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم استرجاع الطالب");
      invalidate();
    },
    onError: (e: Error) => toast.error(getErrorMessage(e)),
  });

  const purgeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { createBackup } = await import("@/lib/backup");
      await createBackup("pre_delete", `قبل حذف نهائي لطالب ${id}`).catch(() => null);
      const { error } = await supabase.from("students").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم الحذف النهائي");
      setPurging(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(getErrorMessage(e)),
  });

  const emptyMutation = useMutation({
    mutationFn: async () => {
      const { createBackup } = await import("@/lib/backup");
      await createBackup("pre_delete", "قبل إفراغ سلة المحذوفات").catch(() => null);
      const { error } = await supabase
        .from("students")
        .delete()
        .not("deleted_at", "is", null);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم إفراغ السلة");
      setEmptying(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(getErrorMessage(e)),
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/60 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
          <Button asChild variant="ghost" size="sm" className="gap-2">
            <Link to="/">
              <ArrowRight className="h-4 w-4" />
              <span>العودة</span>
            </Link>
          </Button>
          <h1 className="font-bold text-sm sm:text-base flex items-center gap-2">
            <Trash className="h-4 w-4" />
            سلة المحذوفات
          </h1>
          {isAdmin && deleted.length > 0 ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setEmptying(true)}
              className="gap-1"
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">إفراغ السلة</span>
            </Button>
          ) : (
            <span className="w-16" />
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-4">
        {!isAdmin && (
          <div className="rounded-xl border border-amber-300/40 bg-amber-50/40 dark:bg-amber-950/20 p-4 flex items-start gap-3 text-sm">
            <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">صلاحيات محدودة</p>
              <p className="text-muted-foreground">
                يمكنك استرجاع الطلاب فقط. الحذف النهائي وإفراغ السلة متاحان للمالك (Admin) فقط.
              </p>
            </div>
          </div>
        )}

        <section className="bg-card rounded-2xl border shadow-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-right text-xs font-semibold">الرقم</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold">الاسم</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold hidden sm:table-cell">الكتيبة</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold hidden md:table-cell">تاريخ الحذف</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-muted-foreground">
                      جارٍ التحميل...
                    </td>
                  </tr>
                ) : deleted.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-16 text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <Trash className="h-10 w-10 opacity-40" />
                        <p>السلة فارغة</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  deleted.map((s) => (
                    <tr key={s.id} className="border-t hover:bg-accent/40 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-primary font-semibold">
                        {s.student_code}
                      </td>
                      <td className="px-4 py-3 font-medium">{s.full_name}</td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <Badge variant="secondary" className="font-normal">
                          {battalionName(s.battalion_id)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-muted-foreground text-xs">
                        {s.deleted_at
                          ? new Date(s.deleted_at).toLocaleDateString("ar-EG")
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-left">
                        <div className="flex gap-1 justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => restoreMutation.mutate(s.id)}
                            disabled={restoreMutation.isPending}
                            className="gap-1"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            استرجاع
                          </Button>
                          {isAdmin && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setPurging(s)}
                              title="حذف نهائي"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <AlertDialog open={!!purging} onOpenChange={(o) => !o && setPurging(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف نهائي</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف الطالب{" "}
              <span className="font-semibold text-foreground">{purging?.full_name}</span>
              {" "}نهائياً مع كل سجلات الحضور والتلاوة الخاصة به. لا يمكن التراجع.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => purging && purgeMutation.mutate(purging.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              حذف نهائي
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={emptying} onOpenChange={setEmptying}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>إفراغ السلة بالكامل</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف <span className="font-semibold text-foreground">{deleted.length}</span> طالباً
              نهائياً مع كل سجلاتهم. لا يمكن التراجع عن هذه العملية.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => emptyMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              إفراغ السلة
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

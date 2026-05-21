import { getErrorMessage } from "@/lib/errors";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowRight,
  Plus,
  Pencil,
  Trash2,
  Layers,
  Users,
  Check,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useBattalions, useCompanies, type Battalion, type Company } from "@/lib/orgs";
import { BackupRestore } from "@/components/BackupRestore";
import { ExportReportDialog } from "@/components/ExportReportDialog";

import { PlatformUsersCard } from "@/components/PlatformUsersCard";
import { AuditLogCard } from "@/components/AuditLogCard";
import { TransferSuperAdminCard } from "@/components/TransferSuperAdminCard";
import { AccountCard } from "@/components/AccountCard";
import { CreateUserCard } from "@/components/CreateUserCard";
import { Download, Trash } from "lucide-react";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const { data: battalions = [] } = useBattalions();
  const { data: companies = [] } = useCompanies();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["battalions"] });
    qc.invalidateQueries({ queryKey: ["companies"] });
    qc.invalidateQueries({ queryKey: ["students"] });
  };

  // -------- Battalions
  const [newBat, setNewBat] = useState("");
  const [editingBat, setEditingBat] = useState<Battalion | null>(null);
  const [editBatName, setEditBatName] = useState("");
  const [deletingBat, setDeletingBat] = useState<Battalion | null>(null);

  const addBat = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase
        .from("battalions")
        .insert({ name: name.trim().slice(0, 100), sort_order: battalions.length + 1 });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم إضافة الكتيبة");
      setNewBat("");
      invalidate();
    },
    onError: (e: Error) => toast.error(getErrorMessage(e)),
  });

  const updateBat = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase
        .from("battalions")
        .update({ name: name.trim().slice(0, 100) })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم التحديث");
      setEditingBat(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(getErrorMessage(e)),
  });

  const deleteBat = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("battalions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم الحذف");
      setDeletingBat(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(getErrorMessage(e)),
  });

  // -------- Companies
  const [newCoName, setNewCoName] = useState("");
  const [newCoBat, setNewCoBat] = useState<string>("");
  const [editingCo, setEditingCo] = useState<Company | null>(null);
  const [editCoName, setEditCoName] = useState("");
  const [editCoBat, setEditCoBat] = useState<string>("");
  const [deletingCo, setDeletingCo] = useState<Company | null>(null);

  const addCo = useMutation({
    mutationFn: async () => {
      if (!newCoBat) throw new Error("اختر الكتيبة");
      if (!newCoName.trim()) throw new Error("أدخل اسم السرية");
      const count = companies.filter((c) => c.battalion_id === newCoBat).length;
      const { error } = await supabase.from("companies").insert({
        battalion_id: newCoBat,
        name: newCoName.trim().slice(0, 100),
        sort_order: count + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم إضافة السرية");
      setNewCoName("");
      invalidate();
    },
    onError: (e: Error) => toast.error(getErrorMessage(e)),
  });

  const updateCo = useMutation({
    mutationFn: async ({
      id,
      name,
      battalion_id,
    }: {
      id: string;
      name: string;
      battalion_id: string;
    }) => {
      const { error } = await supabase
        .from("companies")
        .update({ name: name.trim().slice(0, 100), battalion_id })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم التحديث");
      setEditingCo(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(getErrorMessage(e)),
  });

  const deleteCo = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("companies").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم الحذف");
      setDeletingCo(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(getErrorMessage(e)),
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/60 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Button asChild variant="ghost" size="sm" className="gap-2">
            <Link to="/">
              <ArrowRight className="h-4 w-4" />
              <span>العودة</span>
            </Link>
          </Button>
          <h1 className="font-bold text-sm sm:text-base">إعدادات الهيكلية التنظيمية</h1>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 grid gap-6 lg:grid-cols-2">
        {/* Battalions */}
        <section className="bg-card rounded-2xl border shadow-soft overflow-hidden">
          <div className="p-4 sm:p-6 border-b flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-bold">الكتائب</h2>
              <p className="text-xs text-muted-foreground">
                إجمالي: {battalions.length}
              </p>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (newBat.trim()) addBat.mutate(newBat);
            }}
            className="p-4 flex gap-2 border-b bg-muted/20"
          >
            <Input
              value={newBat}
              onChange={(e) => setNewBat(e.target.value)}
              placeholder="اسم الكتيبة الجديدة..."
              maxLength={100}
            />
            <Button type="submit" disabled={!newBat.trim() || addBat.isPending} className="gap-1">
              <Plus className="h-4 w-4" /> إضافة
            </Button>
          </form>

          <ul className="divide-y">
            {battalions.length === 0 && (
              <li className="p-6 text-center text-muted-foreground text-sm">
                لا توجد كتائب
              </li>
            )}
            {battalions.map((b) => (
              <li key={b.id} className="p-3 sm:p-4 flex items-center gap-2">
                {editingBat?.id === b.id ? (
                  <>
                    <Input
                      value={editBatName}
                      onChange={(e) => setEditBatName(e.target.value)}
                      autoFocus
                      maxLength={100}
                      className="flex-1"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() =>
                        updateBat.mutate({ id: b.id, name: editBatName })
                      }
                      disabled={!editBatName.trim()}
                    >
                      <Check className="h-4 w-4 text-primary" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setEditingBat(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 font-medium">{b.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {companies.filter((c) => c.battalion_id === b.id).length} سرية
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setEditingBat(b);
                        setEditBatName(b.name);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setDeletingBat(b)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>

        {/* Companies */}
        <section className="bg-card rounded-2xl border shadow-soft overflow-hidden">
          <div className="p-4 sm:p-6 border-b flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-bold">السرايا</h2>
              <p className="text-xs text-muted-foreground">
                إجمالي: {companies.length}
              </p>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              addCo.mutate();
            }}
            className="p-4 grid gap-2 border-b bg-muted/20"
          >
            <Select value={newCoBat} onValueChange={setNewCoBat}>
              <SelectTrigger>
                <SelectValue placeholder="اختر الكتيبة" />
              </SelectTrigger>
              <SelectContent>
                {battalions.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Input
                value={newCoName}
                onChange={(e) => setNewCoName(e.target.value)}
                placeholder="اسم السرية الجديدة..."
                maxLength={100}
              />
              <Button
                type="submit"
                disabled={!newCoBat || !newCoName.trim() || addCo.isPending}
                className="gap-1"
              >
                <Plus className="h-4 w-4" /> إضافة
              </Button>
            </div>
          </form>

          <ul className="divide-y max-h-[500px] overflow-y-auto">
            {companies.length === 0 && (
              <li className="p-6 text-center text-muted-foreground text-sm">
                لا توجد سرايا
              </li>
            )}
            {battalions.map((b) => {
              const list = companies.filter((c) => c.battalion_id === b.id);
              if (list.length === 0) return null;
              return (
                <li key={b.id} className="p-0">
                  <div className="px-4 py-2 bg-muted/30 text-xs font-semibold text-muted-foreground">
                    {b.name}
                  </div>
                  <ul className="divide-y">
                    {list.map((c) => (
                      <li
                        key={c.id}
                        className="px-4 py-2.5 flex items-center gap-2"
                      >
                        {editingCo?.id === c.id ? (
                          <>
                            <Select value={editCoBat} onValueChange={setEditCoBat}>
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {battalions.map((bb) => (
                                  <SelectItem key={bb.id} value={bb.id}>
                                    {bb.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              value={editCoName}
                              onChange={(e) => setEditCoName(e.target.value)}
                              maxLength={100}
                              className="flex-1"
                              autoFocus
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() =>
                                updateCo.mutate({
                                  id: c.id,
                                  name: editCoName,
                                  battalion_id: editCoBat,
                                })
                              }
                              disabled={!editCoName.trim() || !editCoBat}
                            >
                              <Check className="h-4 w-4 text-primary" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setEditingCo(null)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <span className="flex-1 text-sm">{c.name}</span>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                setEditingCo(c);
                                setEditCoName(c.name);
                                setEditCoBat(c.battalion_id);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setDeletingCo(c)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="bg-card rounded-2xl border shadow-soft p-4 sm:p-6 lg:col-span-2">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Download className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-bold">التقارير وسلة المحذوفات</h2>
              <p className="text-xs text-muted-foreground">تصدير بيانات السرايا وإدارة المحذوفات</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <ExportReportDialog />
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link to="/trash">
                <Trash className="h-4 w-4" />
                <span>سلة المحذوفات</span>
              </Link>
            </Button>
          </div>
        </section>

        <CreateUserCard />
        <InviteUserCard />
        <PendingApprovalsCard />
        <PlatformUsersCard />
        <AuditLogCard />
        <AccountCard />
        <NotificationEmailCard />
        <TransferSuperAdminCard />
        <BackupRestore />
      </main>

      <AlertDialog
        open={!!deletingBat}
        onOpenChange={(o) => !o && setDeletingBat(null)}
      >
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الكتيبة</AlertDialogTitle>
            <AlertDialogDescription>
              عند حذف الكتيبة <span className="font-semibold text-foreground">{deletingBat?.name}</span> سيتم حذف جميع السرايا التابعة لها، وسيُزال الانتماء عن الطلاب المرتبطين بها.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingBat && deleteBat.mutate(deletingBat.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!deletingCo}
        onOpenChange={(o) => !o && setDeletingCo(null)}
      >
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف السرية</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف السرية <span className="font-semibold text-foreground">{deletingCo?.name}</span> وإزالة الانتماء عن الطلاب المرتبطين بها.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingCo && deleteCo.mutate(deletingCo.id)}
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

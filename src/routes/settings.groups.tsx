import { getErrorMessage } from "@/lib/errors";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowRight, Plus, Pencil, Trash2, Layers, Users, Check, X, Building2 } from "lucide-react";

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
import {
  useBattalions,
  useCompanies,
  useDepartments,
  type Battalion,
  type Company,
  type Department,
} from "@/lib/orgs";
import { useCanManageStudents, useIsAdmin, useIsSuperAdmin, useUserDepartmentAccess } from "@/lib/roles";

export const Route = createFileRoute("/settings/groups")({
  component: GroupsPage,
});

function GroupsPage() {
  const qc = useQueryClient();
  const canManage = useCanManageStudents();
  const isAdmin = useIsAdmin();
  const isSuper = useIsSuperAdmin();
  const { allowedIds, all } = useUserDepartmentAccess();
  const isManager = isAdmin || isSuper || all;
  const { data: allDepartments = [] } = useDepartments();
  const departments =
    isManager || allowedIds.length === 0
      ? allDepartments
      : allDepartments.filter((d) => allowedIds.includes(d.id));
  const hideDeptPicker = !isManager && allowedIds.length === 1;
  const autoDeptId = !isManager && allowedIds.length === 1 ? allowedIds[0] : "";

  const { data: allBattalions = [] } = useBattalions();
  const { data: allCompanies = [] } = useCompanies();
  // Restrict battalions/companies to the user's allowed departments
  const battalions =
    isManager || allowedIds.length === 0
      ? allBattalions
      : allBattalions.filter((b) => b.department_id && allowedIds.includes(b.department_id));
  const allowedBatIds = new Set(battalions.map((b) => b.id));
  const companies =
    isManager || allowedIds.length === 0
      ? allCompanies
      : allCompanies.filter((c) => c.battalion_id && allowedBatIds.has(c.battalion_id));


  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["departments"] });
    qc.invalidateQueries({ queryKey: ["battalions"] });
    qc.invalidateQueries({ queryKey: ["companies"] });
    qc.invalidateQueries({ queryKey: ["students"] });
  };

  // ===== Departments =====
  const [newDept, setNewDept] = useState("");
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [editDeptName, setEditDeptName] = useState("");
  const [deletingDept, setDeletingDept] = useState<Department | null>(null);

  const addDept = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase
        .from("departments")
        .insert({ name: name.trim().slice(0, 100), sort_order: departments.length + 1 });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم إضافة القسم");
      setNewDept("");
      invalidate();
    },
    onError: (e: Error) => toast.error(getErrorMessage(e)),
  });

  const updateDept = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase
        .from("departments")
        .update({ name: name.trim().slice(0, 100) })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم التحديث");
      setEditingDept(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(getErrorMessage(e)),
  });

  const deleteDept = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("departments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم الحذف");
      setDeletingDept(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(getErrorMessage(e)),
  });

  // ===== Battalions =====
  const [newBat, setNewBat] = useState("");
  const [newBatDept, setNewBatDept] = useState<string>("");
  useEffect(() => {
    if (autoDeptId && newBatDept !== autoDeptId) setNewBatDept(autoDeptId);
  }, [autoDeptId, newBatDept]);


  const [editingBat, setEditingBat] = useState<Battalion | null>(null);
  const [editBatName, setEditBatName] = useState("");
  const [editBatDept, setEditBatDept] = useState<string>("");
  const [deletingBat, setDeletingBat] = useState<Battalion | null>(null);

  const addBat = useMutation({
    mutationFn: async () => {
      if (!newBatDept) throw new Error("اختر القسم");
      if (!newBat.trim()) throw new Error("أدخل اسم الكتيبة");
      const { error } = await supabase.from("battalions").insert({
        name: newBat.trim().slice(0, 100),
        sort_order: battalions.length + 1,
        department_id: newBatDept,
      });
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
    mutationFn: async ({ id, name, department_id }: { id: string; name: string; department_id: string }) => {
      const { error } = await supabase
        .from("battalions")
        .update({ name: name.trim().slice(0, 100), department_id })
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

  // ===== Companies =====
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

  const deptName = (id: string | null) =>
    departments.find((d) => d.id === id)?.name ?? "—";

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <header className="border-b bg-card/60 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Button asChild variant="ghost" size="sm" className="gap-2">
            <Link to="/settings">
              <ArrowRight className="h-4 w-4" />
              <span>رجوع إلى الضبط</span>
            </Link>
          </Button>
          <h1 className="font-bold text-sm sm:text-base">إدارة المجموعات</h1>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 grid gap-6 lg:grid-cols-2">
        {/* Departments */}
        <section className="bg-card rounded-2xl border shadow-soft overflow-hidden lg:col-span-2">
          <div className="p-4 sm:p-6 border-b flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-bold">الأقسام</h2>
              <p className="text-xs text-muted-foreground">
                إجمالي: {departments.length} — كل كتيبة تتبع لقسم واحد
              </p>
            </div>
          </div>

          {(isAdmin || isSuper) && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (newDept.trim()) addDept.mutate(newDept);
              }}
              className="p-4 flex gap-2 border-b bg-muted/20"
            >
              <Input
                value={newDept}
                onChange={(e) => setNewDept(e.target.value)}
                placeholder="اسم القسم الجديد (مثلاً: 642)..."
                maxLength={100}
              />
              <Button type="submit" disabled={!newDept.trim() || addDept.isPending} className="gap-1">
                <Plus className="h-4 w-4" /> إضافة
              </Button>
            </form>
          )}

          <ul className="divide-y">
            {departments.length === 0 && (
              <li className="p-6 text-center text-muted-foreground text-sm">لا توجد أقسام</li>
            )}
            {departments.map((d) => {
              const batCount = battalions.filter((b) => b.department_id === d.id).length;
              return (
                <li key={d.id} className="p-3 sm:p-4 flex items-center gap-2">
                  {editingDept?.id === d.id ? (
                    <>
                      <Input
                        value={editDeptName}
                        onChange={(e) => setEditDeptName(e.target.value)}
                        autoFocus
                        maxLength={100}
                        className="flex-1"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => updateDept.mutate({ id: d.id, name: editDeptName })}
                        disabled={!editDeptName.trim()}
                      >
                        <Check className="h-4 w-4 text-primary" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setEditingDept(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 font-medium">{d.name}</span>
                      <span className="text-xs text-muted-foreground">{batCount} كتيبة</span>
                      {(isAdmin || isSuper) && (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setEditingDept(d);
                              setEditDeptName(d.name);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setDeletingDept(d)}
                            disabled={batCount > 0}
                            title={batCount > 0 ? "انقل الكتائب إلى قسم آخر قبل الحذف" : "حذف"}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        {/* Battalions */}
        <section className="bg-card rounded-2xl border shadow-soft overflow-hidden">
          <div className="p-4 sm:p-6 border-b flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-bold">الكتائب</h2>
              <p className="text-xs text-muted-foreground">إجمالي: {battalions.length}</p>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              addBat.mutate();
            }}
            className="p-4 grid gap-2 border-b bg-muted/20"
          >
            {!hideDeptPicker && (
              <Select value={newBatDept} onValueChange={setNewBatDept}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر القسم" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div className="flex gap-2">
              <Input
                value={newBat}
                onChange={(e) => setNewBat(e.target.value)}
                placeholder="اسم الكتيبة الجديدة..."
                maxLength={100}
              />
              <Button
                type="submit"
                disabled={!newBat.trim() || !newBatDept || addBat.isPending}
                className="gap-1"
              >
                <Plus className="h-4 w-4" /> إضافة
              </Button>
            </div>
          </form>

          <ul className="divide-y">
            {battalions.length === 0 && (
              <li className="p-6 text-center text-muted-foreground text-sm">لا توجد كتائب</li>
            )}
            {battalions.map((b) => (
              <li key={b.id} className="p-3 sm:p-4 flex items-center gap-2">
                {editingBat?.id === b.id ? (
                  <>
                    <Select value={editBatDept} onValueChange={setEditBatDept}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                        updateBat.mutate({ id: b.id, name: editBatName, department_id: editBatDept })
                      }
                      disabled={!editBatName.trim() || !editBatDept}
                    >
                      <Check className="h-4 w-4 text-primary" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setEditingBat(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 font-medium">{b.name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {deptName(b.department_id)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {companies.filter((c) => c.battalion_id === b.id).length} سرية
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setEditingBat(b);
                        setEditBatName(b.name);
                        setEditBatDept(b.department_id);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setDeletingBat(b)}>
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
              <p className="text-xs text-muted-foreground">إجمالي: {companies.length}</p>
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
                    {b.name} — {deptName(b.department_id)}
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
              <li className="p-6 text-center text-muted-foreground text-sm">لا توجد سرايا</li>
            )}
            {battalions.map((b) => {
              const list = companies.filter((c) => c.battalion_id === b.id);
              if (list.length === 0) return null;
              return (
                <li key={b.id} className="p-0">
                  <div className="px-4 py-2 bg-muted/30 text-xs font-semibold text-muted-foreground">
                    {b.name} <span className="opacity-70">— {deptName(b.department_id)}</span>
                  </div>
                  <ul className="divide-y">
                    {list.map((c) => (
                      <li key={c.id} className="px-4 py-2.5 flex items-center gap-2">
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
                            <Button size="icon" variant="ghost" onClick={() => setEditingCo(null)}>
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
                            {canManage && (
                              <Button size="icon" variant="ghost" onClick={() => setDeletingCo(c)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
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
      </main>

      <AlertDialog open={!!deletingDept} onOpenChange={(o) => !o && setDeletingDept(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف القسم</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف القسم{" "}
              <span className="font-semibold text-foreground">{deletingDept?.name}</span>. لا يمكن
              حذف قسم يحتوي على كتائب.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingDept && deleteDept.mutate(deletingDept.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletingBat} onOpenChange={(o) => !o && setDeletingBat(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الكتيبة</AlertDialogTitle>
            <AlertDialogDescription>
              عند حذف الكتيبة{" "}
              <span className="font-semibold text-foreground">{deletingBat?.name}</span> سيتم حذف
              جميع السرايا التابعة لها، وسيُزال الانتماء عن الطلاب المرتبطين بها.
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

      <AlertDialog open={!!deletingCo} onOpenChange={(o) => !o && setDeletingCo(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف السرية</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف السرية{" "}
              <span className="font-semibold text-foreground">{deletingCo?.name}</span> وإزالة
              الانتماء عن الطلاب المرتبطين بها.
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

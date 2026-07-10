import { getErrorMessage } from "@/lib/errors";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
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
import { useCanManageStudentsResolver, useIsAdmin, useIsSuperAdmin, useUserDepartmentAccess } from "@/lib/roles";

export const Route = createFileRoute("/settings/groups")({
  component: GroupsPage,
});

function GroupsPage() {
  const qc = useQueryClient();
  const canManageFor = useCanManageStudentsResolver();
  const isAdmin = useIsAdmin();
  const isSuper = useIsSuperAdmin();
  const { allowedIds, all } = useUserDepartmentAccess();
  const isManager = isAdmin || isSuper || all;
  const { data: allDepartments = [] } = useDepartments();
  const departments =
    isManager || allowedIds.length === 0
      ? allDepartments
      : allDepartments.filter((d) => allowedIds.includes(d.id));



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



  const [editingBat, setEditingBat] = useState<Battalion | null>(null);
  const [editBatName, setEditBatName] = useState("");
  const [editBatDept, setEditBatDept] = useState<string>("");
  const [deletingBat, setDeletingBat] = useState<Battalion | null>(null);




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
  const [editingCo, setEditingCo] = useState<Company | null>(null);
  const [editCoName, setEditCoName] = useState("");
  const [editCoBat, setEditCoBat] = useState<string>("");
  const [deletingCo, setDeletingCo] = useState<Company | null>(null);


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

  // Per-department inline "add battalion" inputs
  const [batNameByDept, setBatNameByDept] = useState<Record<string, string>>({});
  // Per-battalion inline "add company" inputs
  const [coNameByBat, setCoNameByBat] = useState<Record<string, string>>({});
  // Which battalions are expanded to reveal their companies
  const [openBat, setOpenBat] = useState<Record<string, boolean>>({});

  const addBatInline = useMutation({
    mutationFn: async ({ department_id, name }: { department_id: string; name: string }) => {
      const trimmed = name.trim().slice(0, 100);
      if (!trimmed) throw new Error("أدخل اسم الكتيبة");
      // Uniqueness is now per-department; block only when the same dept already has it.
      const dup = battalions.some(
        (b) => b.department_id === department_id && b.name.trim() === trimmed,
      );
      if (dup) throw new Error("يوجد كتيبة بنفس الاسم في هذا القسم");
      const count = battalions.filter((b) => b.department_id === department_id).length;
      const { error } = await supabase.from("battalions").insert({
        name: trimmed,
        sort_order: count + 1,
        department_id,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success("تم إضافة الكتيبة");
      setBatNameByDept((s) => ({ ...s, [vars.department_id]: "" }));
      invalidate();
    },
    onError: (e: Error) => toast.error(getErrorMessage(e)),
  });

  const addCoInline = useMutation({
    mutationFn: async ({ battalion_id, name }: { battalion_id: string; name: string }) => {
      const trimmed = name.trim().slice(0, 100);
      if (!trimmed) throw new Error("أدخل اسم السرية");
      const count = companies.filter((c) => c.battalion_id === battalion_id).length;
      const { error } = await supabase.from("companies").insert({
        battalion_id,
        name: trimmed,
        sort_order: count + 1,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success("تم إضافة السرية");
      setCoNameByBat((s) => ({ ...s, [vars.battalion_id]: "" }));
      invalidate();
    },
    onError: (e: Error) => toast.error(getErrorMessage(e)),
  });

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

      <main className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 grid gap-6">
        {/* Add new department */}
        {(isAdmin || isSuper) && (
          <section className="bg-card rounded-2xl border shadow-soft overflow-hidden">
            <div className="p-4 sm:p-5 border-b flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Building2 className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h2 className="font-bold">الأقسام</h2>
                <p className="text-xs text-muted-foreground">
                  إجمالي: {departments.length} — كل قسم يحتوي كتائبه وسراياه
                </p>
              </div>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (newDept.trim()) addDept.mutate(newDept);
              }}
              className="p-4 flex gap-2 bg-muted/20"
            >
              <Input
                value={newDept}
                onChange={(e) => setNewDept(e.target.value)}
                placeholder="اسم القسم الجديد (مثلاً: 64)..."
                maxLength={100}
              />
              <Button type="submit" disabled={!newDept.trim() || addDept.isPending} className="gap-1">
                <Plus className="h-4 w-4" /> إضافة
              </Button>
            </form>
          </section>
        )}

        {/* Departments tree */}
        {departments.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground rounded-2xl border bg-card">
            لا توجد أقسام بعد
          </div>
        )}
        {departments.map((d) => {
          const deptBats = battalions.filter((b) => b.department_id === d.id);
          return (
            <section key={d.id} className="bg-card rounded-2xl border shadow-soft overflow-hidden">
              {/* Department header */}
              <div className="p-4 border-b bg-primary/5 flex items-center gap-2">
                <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Building2 className="h-4 w-4" />
                </div>
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
                    <div className="flex-1 min-w-0">
                      <div className="font-bold truncate">قسم {d.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {deptBats.length} كتيبة
                      </div>
                    </div>
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
                          disabled={deptBats.length > 0}
                          title={deptBats.length > 0 ? "انقل الكتائب إلى قسم آخر قبل الحذف" : "حذف"}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </>
                )}
              </div>

              {/* Add battalion under this department */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  addBatInline.mutate({ department_id: d.id, name: batNameByDept[d.id] ?? "" });
                }}
                className="px-4 py-3 border-b bg-muted/20 flex gap-2"
              >
                <div className="h-8 w-8 shrink-0 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                  <Layers className="h-4 w-4" />
                </div>
                <Input
                  value={batNameByDept[d.id] ?? ""}
                  onChange={(e) => setBatNameByDept((s) => ({ ...s, [d.id]: e.target.value }))}
                  placeholder="اسم الكتيبة الجديدة..."
                  maxLength={100}
                  className="flex-1"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={!(batNameByDept[d.id]?.trim()) || addBatInline.isPending}
                  className="gap-1"
                >
                  <Plus className="h-4 w-4" /> إضافة
                </Button>
              </form>

              {/* Battalions list */}
              <ul className="divide-y">
                {deptBats.length === 0 && (
                  <li className="p-4 text-center text-xs text-muted-foreground">
                    لا توجد كتائب في هذا القسم
                  </li>
                )}
                {deptBats.map((b) => {
                  const list = companies.filter((c) => c.battalion_id === b.id);
                  const isOpen = openBat[b.id] ?? false;
                  return (
                    <li key={b.id} className="p-0">
                      {/* Battalion row */}
                      <div className="px-4 py-3 flex items-center gap-2">
                        {editingBat?.id === b.id ? (
                          <>
                            <Select value={editBatDept} onValueChange={setEditBatDept}>
                              <SelectTrigger className="w-28">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {departments.map((dd) => (
                                  <SelectItem key={dd.id} value={dd.id}>
                                    {dd.name}
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
                            <button
                              type="button"
                              onClick={() => setOpenBat((s) => ({ ...s, [b.id]: !isOpen }))}
                              className="flex-1 text-right flex items-center gap-2 min-w-0"
                            >
                              <Layers className="h-4 w-4 text-primary shrink-0" />
                              <span className="font-semibold truncate">{b.name}</span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                                {list.length} سرية
                              </span>
                            </button>
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
                      </div>

                      {/* Companies under this battalion */}
                      {isOpen && (
                        <div className="bg-muted/20 border-t">
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              addCoInline.mutate({
                                battalion_id: b.id,
                                name: coNameByBat[b.id] ?? "",
                              });
                            }}
                            className="px-4 py-2.5 flex gap-2"
                          >
                            <div className="h-7 w-7 shrink-0 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                              <Users className="h-3.5 w-3.5" />
                            </div>
                            <Input
                              value={coNameByBat[b.id] ?? ""}
                              onChange={(e) =>
                                setCoNameByBat((s) => ({ ...s, [b.id]: e.target.value }))
                              }
                              placeholder="اسم السرية الجديدة..."
                              maxLength={100}
                              className="flex-1 h-9"
                            />
                            <Button
                              type="submit"
                              size="sm"
                              disabled={!(coNameByBat[b.id]?.trim()) || addCoInline.isPending}
                              className="gap-1"
                            >
                              <Plus className="h-4 w-4" /> إضافة
                            </Button>
                          </form>
                          <ul className="divide-y border-t">
                            {list.length === 0 && (
                              <li className="px-4 py-3 text-center text-xs text-muted-foreground">
                                لا توجد سرايا
                              </li>
                            )}
                            {list.map((c) => (
                              <li key={c.id} className="px-4 py-2.5 flex items-center gap-2">
                                {editingCo?.id === c.id ? (
                                  <>
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
                                          battalion_id: editCoBat || b.id,
                                        })
                                      }
                                      disabled={!editCoName.trim()}
                                    >
                                      <Check className="h-4 w-4 text-primary" />
                                    </Button>
                                    <Button size="icon" variant="ghost" onClick={() => setEditingCo(null)}>
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                    <span className="flex-1 text-sm truncate">{c.name}</span>
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
                                    {canManageFor(d.id) && (
                                      <Button size="icon" variant="ghost" onClick={() => setDeletingCo(c)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                      </Button>
                                    )}
                                  </>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
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

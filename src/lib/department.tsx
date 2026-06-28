import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useDepartments, useBattalions, type Department } from "@/lib/orgs";
import { useUserDepartmentAccess, useIsSuperAdmin } from "@/lib/roles";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2 } from "lucide-react";

const STORAGE_KEY = "current-department-id-v1";
const ALL = "all";

type Ctx = {
  currentDepartmentId: string;
  setCurrentDepartmentId: (id: string) => void;
  scopedBattalionIds: string[] | null;
};

const DepartmentContext = createContext<Ctx | null>(null);

export function DepartmentProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { allowedIds, all } = useUserDepartmentAccess();
  const [currentDepartmentId, setCurrentDepartmentIdState] = useState<string>(() => {
    if (typeof window === "undefined") return ALL;
    try {
      return window.localStorage.getItem(STORAGE_KEY) || ALL;
    } catch {
      return ALL;
    }
  });

  const { data: battalions = [] } = useBattalions();
  const { data: departments = [] } = useDepartments();

  // Effective department id after applying the user's access restrictions.
  const effectiveDepartmentId = useMemo(() => {
    if (all) return currentDepartmentId; // super_admin / global admin → free choice
    if (allowedIds.length === 0) return ALL; // no scope info → no filter (regular user)
    if (allowedIds.length === 1) return allowedIds[0]; // force locked single dept
    // Multiple scoped depts: ensure current is one of them
    if (currentDepartmentId !== ALL && allowedIds.includes(currentDepartmentId)) {
      return currentDepartmentId;
    }
    return allowedIds[0];
  }, [all, allowedIds, currentDepartmentId]);

  const setCurrentDepartmentId = (id: string) => {
    setCurrentDepartmentIdState(id);
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // ignore
    }
    qc.invalidateQueries({ queryKey: ["students"] });
    qc.invalidateQueries({ queryKey: ["attendance"] });
    qc.invalidateQueries({ queryKey: ["recitations"] });
  };

  const scopedBattalionIds = useMemo(() => {
    // Build the dept filter from effective access:
    // - all + ALL → no filter
    // - all + specific dept → that dept
    // - scoped user with no dept rows → no battalions (empty list)
    // - scoped user → intersect with allowed depts
    if (all) {
      if (effectiveDepartmentId === ALL) return null;
      return battalions
        .filter((b) => b.department_id === effectiveDepartmentId)
        .map((b) => b.id);
    }
    if (allowedIds.length === 0) return null; // no scope yet → see nothing restricted
    const targetIds =
      effectiveDepartmentId === ALL ? allowedIds : [effectiveDepartmentId];
    const set = new Set(targetIds);
    return battalions.filter((b) => b.department_id && set.has(b.department_id)).map((b) => b.id);
  }, [battalions, effectiveDepartmentId, all, allowedIds]);

  return (
    <DepartmentContext.Provider
      value={{
        currentDepartmentId: effectiveDepartmentId,
        setCurrentDepartmentId,
        scopedBattalionIds,
      }}
    >
      {children}
    </DepartmentContext.Provider>
  );
}

export function useDepartmentContext(): Ctx {
  const ctx = useContext(DepartmentContext);
  if (!ctx) {
    return {
      currentDepartmentId: ALL,
      setCurrentDepartmentId: () => undefined,
      scopedBattalionIds: null,
    };
  }
  return ctx;
}

export function useScopedBattalions<T extends { department_id?: string | null }>(items: T[]): T[] {
  const { currentDepartmentId, scopedBattalionIds } = useDepartmentContext();
  return useMemo(() => {
    if (currentDepartmentId !== ALL) {
      return items.filter((b) => b.department_id === currentDepartmentId);
    }
    if (scopedBattalionIds === null) return items;
    const set = new Set(scopedBattalionIds);
    return items.filter((b) => set.has((b as unknown as { id: string }).id));
  }, [items, currentDepartmentId, scopedBattalionIds]);
}

export function useScopedByBattalion<T extends { battalion_id: string | null }>(items: T[]): T[] {
  const { scopedBattalionIds } = useDepartmentContext();
  return useMemo(() => {
    if (scopedBattalionIds === null) return items;
    const set = new Set(scopedBattalionIds);
    return items.filter((x) => x.battalion_id !== null && set.has(x.battalion_id));
  }, [items, scopedBattalionIds]);
}

export function DepartmentSwitcher({ className }: { className?: string }) {
  const { data: departments = [] } = useDepartments();
  const { currentDepartmentId, setCurrentDepartmentId } = useDepartmentContext();
  const isSuper = useIsSuperAdmin();
  const { allowedIds, all } = useUserDepartmentAccess();

  // Visible options: super_admin sees all departments; scoped user only their allowed
  const visible = useMemo(() => {
    if (all) return departments;
    return departments.filter((d) => allowedIds.includes(d.id));
  }, [departments, allowedIds, all]);

  // Only super_admin (or a user with access to >1 departments) can switch.
  useEffect(() => {
    if (visible.length === 1 && currentDepartmentId !== visible[0].id) {
      setCurrentDepartmentId(visible[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible.length]);

  if (!isSuper) return null;
  if (visible.length <= 1) return null;

  return (
    <div className={`flex items-center gap-1.5 ${className ?? ""}`}>
      <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
      <Select value={currentDepartmentId} onValueChange={setCurrentDepartmentId}>
        <SelectTrigger className="h-9 w-[140px] sm:w-[160px] text-xs sm:text-sm">
          <SelectValue placeholder="القسم" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>كل الأقسام</SelectItem>
          {visible.map((d: Department) => (
            <SelectItem key={d.id} value={d.id}>
              {d.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

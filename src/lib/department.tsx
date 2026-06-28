import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useDepartments, useBattalions, type Department } from "@/lib/orgs";
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
  /** "all" or a real department id */
  currentDepartmentId: string;
  setCurrentDepartmentId: (id: string) => void;
  /** ids of battalions in current department (null = no filter) */
  scopedBattalionIds: string[] | null;
};

const DepartmentContext = createContext<Ctx | null>(null);

export function DepartmentProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [currentDepartmentId, setCurrentDepartmentIdState] = useState<string>(() => {
    if (typeof window === "undefined") return ALL;
    try {
      return window.localStorage.getItem(STORAGE_KEY) || ALL;
    } catch {
      return ALL;
    }
  });

  const { data: battalions = [] } = useBattalions();

  const setCurrentDepartmentId = (id: string) => {
    setCurrentDepartmentIdState(id);
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // ignore
    }
    // Invalidate downstream queries so tables/reports refresh
    qc.invalidateQueries({ queryKey: ["students"] });
    qc.invalidateQueries({ queryKey: ["attendance"] });
    qc.invalidateQueries({ queryKey: ["recitations"] });
  };

  const scopedBattalionIds = useMemo(() => {
    if (currentDepartmentId === ALL) return null;
    return battalions
      .filter((b) => b.department_id === currentDepartmentId)
      .map((b) => b.id);
  }, [battalions, currentDepartmentId]);

  return (
    <DepartmentContext.Provider value={{ currentDepartmentId, setCurrentDepartmentId, scopedBattalionIds }}>
      {children}
    </DepartmentContext.Provider>
  );
}

export function useDepartmentContext(): Ctx {
  const ctx = useContext(DepartmentContext);
  if (!ctx) {
    // Safe defaults when used outside provider (e.g. public lookup)
    return {
      currentDepartmentId: ALL,
      setCurrentDepartmentId: () => undefined,
      scopedBattalionIds: null,
    };
  }
  return ctx;
}

/** Filter a list of battalions to the current department */
export function useScopedBattalions<T extends { department_id?: string | null }>(items: T[]): T[] {
  const { currentDepartmentId } = useDepartmentContext();
  return useMemo(() => {
    if (currentDepartmentId === ALL) return items;
    return items.filter((b) => b.department_id === currentDepartmentId);
  }, [items, currentDepartmentId]);
}

/** Filter a list (companies, students, ...) by battalion_id in the current department */
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

  // Auto-pick the only available department on first load if user has "all"
  useEffect(() => {
    if (departments.length === 1 && currentDepartmentId === ALL) {
      setCurrentDepartmentId(departments[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departments.length]);

  if (departments.length <= 1) return null;

  return (
    <div className={`flex items-center gap-1.5 ${className ?? ""}`}>
      <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
      <Select value={currentDepartmentId} onValueChange={setCurrentDepartmentId}>
        <SelectTrigger className="h-9 w-[140px] sm:w-[160px] text-xs sm:text-sm">
          <SelectValue placeholder="القسم" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>كل الأقسام</SelectItem>
          {departments.map((d: Department) => (
            <SelectItem key={d.id} value={d.id}>
              {d.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

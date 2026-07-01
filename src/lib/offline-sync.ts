import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { writeCache } from "@/lib/local-cache";
import { flushQueue } from "@/lib/offline-queue";

type Student = Tables<"students">;
type Recitation = Tables<"recitations">;
type Attendance = Tables<"attendance">;
type Battalion = Tables<"battalions">;
type Company = Tables<"companies">;
type Department = Tables<"departments">;

type SyncStatus = "idle" | "syncing" | "success" | "error";

export type OfflineSyncState = {
  status: SyncStatus;
  message: string;
  progress: number;
  total: number;
  lastSyncedAt: number | null;
  error?: string;
};

const LAST_SYNC_KEY = "offline-full-sync-last-v2";
const PAGE_SIZE = 1000;
const AUTO_SYNC_INTERVAL = 5 * 60 * 1000;

let state: OfflineSyncState = {
  status: "idle",
  message: "",
  progress: 0,
  total: 0,
  lastSyncedAt: readLastSyncAt(),
};
let activeSync: Promise<{ skipped: boolean }> | null = null;
const listeners = new Set<(next: OfflineSyncState) => void>();

function readLastSyncAt(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LAST_SYNC_KEY);
    return raw ? Number(raw) : null;
  } catch {
    return null;
  }
}

function writeLastSyncAt(value: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAST_SYNC_KEY, String(value));
  } catch {
    // ignore quota errors
  }
}

function setState(patch: Partial<OfflineSyncState>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener(state));
}

export function getOfflineSyncState() {
  return state;
}

export function subscribeOfflineSync(listener: (next: OfflineSyncState) => void) {
  listeners.add(listener);
  listener(state);
  return () => listeners.delete(listener);
}

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function uniqueByStudent(rows: Array<{ student_id: string }>) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.student_id)) return false;
    seen.add(row.student_id);
    return true;
  });
}

async function fetchDepartments(): Promise<Department[]> {
  const { data, error } = await supabase
    .from("departments")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Department[];
}

async function fetchBattalions(): Promise<Battalion[]> {
  const { data, error } = await supabase
    .from("battalions")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Battalion[];
}

async function fetchCompanies(): Promise<Company[]> {
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Company[];
}

async function fetchStudents(): Promise<Student[]> {
  const rows: Student[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("students")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(((data ?? []) as Student[]) ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

async function fetchRecitations(studentIds: string[]): Promise<Recitation[]> {
  const rows: Recitation[] = [];
  for (const ids of chunks(studentIds, 80)) {
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from("recitations")
        .select("*")
        .in("student_id", ids)
        .order("recited_on", { ascending: false })
        .order("created_at", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      rows.push(...(((data ?? []) as Recitation[]) ?? []));
      if (!data || data.length < PAGE_SIZE) break;
    }
  }
  return rows;
}

async function fetchAttendance(studentIds: string[]): Promise<Attendance[]> {
  const rows: Attendance[] = [];
  for (const ids of chunks(studentIds, 80)) {
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .in("student_id", ids)
        .order("attended_on", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      rows.push(...(((data ?? []) as Attendance[]) ?? []));
      if (!data || data.length < PAGE_SIZE) break;
    }
  }
  return rows;
}

async function writeStudentRecitationCaches(students: Student[], recitations: Recitation[]) {
  const byStudent = new Map<string, Recitation[]>();
  const byDay = new Map<string, Array<{ student_id: string }>>();

  for (const row of recitations) {
    const studentRows = byStudent.get(row.student_id) ?? [];
    studentRows.push(row);
    byStudent.set(row.student_id, studentRows);

    const dayRows = byDay.get(row.recited_on) ?? [];
    dayRows.push({ student_id: row.student_id });
    byDay.set(row.recited_on, dayRows);
  }

  await Promise.all([
    ...students.map((student) => writeCache(["recitations", student.id], byStudent.get(student.id) ?? [])),
    ...Array.from(byDay.entries()).map(([day, rows]) =>
      writeCache(["recitations-by-day", day], uniqueByStudent(rows)),
    ),
  ]);
}

async function writeAttendanceCaches(attendance: Attendance[]) {
  const byDay = new Map<string, Attendance[]>();
  for (const row of attendance) {
    const rows = byDay.get(row.attended_on) ?? [];
    rows.push(row);
    byDay.set(row.attended_on, rows);
  }
  await Promise.all(
    Array.from(byDay.entries()).map(([day, rows]) => writeCache(["attendance", day], rows)),
  );
}

async function runFullSync(): Promise<{ skipped: boolean }> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new Error("الجهاز غير متصل بالإنترنت");
  }

  setState({ status: "syncing", message: "رفع السجلات المحفوظة محلياً", progress: 0, total: 6, error: undefined });
  await flushQueue();

  setState({ message: "تحميل الأقسام والكتائب والسرايا", progress: 1 });
  const [departments, battalions, companies] = await Promise.all([
    fetchDepartments(),
    fetchBattalions(),
    fetchCompanies(),
  ]);
  await Promise.all([
    writeCache(["departments"], departments),
    writeCache(["battalions"], battalions),
    writeCache(["companies"], companies),
  ]);

  setState({ message: "تحميل قائمة الطلاب", progress: 2 });
  const students = await fetchStudents();
  await Promise.all([
    writeCache(["students"], students),
    ...students.map((student) => writeCache(["student", student.id], student)),
  ]);

  const studentIds = students.map((student) => student.id);
  setState({ message: "تحميل إنجازات الطلاب", progress: 3 });
  const recitations = studentIds.length > 0 ? await fetchRecitations(studentIds) : [];
  await writeStudentRecitationCaches(students, recitations);

  setState({ message: "تحميل الحضور والغياب", progress: 4 });
  const attendance = studentIds.length > 0 ? await fetchAttendance(studentIds) : [];
  await writeAttendanceCaches(attendance);

  const finishedAt = Date.now();
  writeLastSyncAt(finishedAt);
  setState({
    status: "success",
    message: `تم تجهيز ${students.length} طالب للعمل بدون إنترنت`,
    progress: 6,
    total: 6,
    lastSyncedAt: finishedAt,
    error: undefined,
  });
  return { skipped: false };
}

export function syncAllOfflineData(opts: { force?: boolean } = {}) {
  if (activeSync) return activeSync;

  const lastSyncedAt = readLastSyncAt();
  if (!opts.force && lastSyncedAt && Date.now() - lastSyncedAt < AUTO_SYNC_INTERVAL) {
    setState({ lastSyncedAt });
    return Promise.resolve({ skipped: true });
  }

  activeSync = runFullSync()
    .catch((error) => {
      const message = error instanceof Error ? error.message : "تعذرت المزامنة";
      setState({ status: "error", message, error: message });
      throw error;
    })
    .finally(() => {
      activeSync = null;
    });
  return activeSync;
}

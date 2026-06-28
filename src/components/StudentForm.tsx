import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBattalions, useCompanies, useDepartments } from "@/lib/orgs";
import { useDepartmentContext } from "@/lib/department";

export type StudentFormValues = {
  full_name: string;
  battalion_id: string;
  company_id: string;
  notes: string;
};

interface Props {
  initial?: Partial<StudentFormValues>;
  submitLabel?: string;
  onSubmit: (values: StudentFormValues) => Promise<void> | void;
  onCancel?: () => void;
  loading?: boolean;
  lockName?: boolean;
}

export function StudentForm({ initial, submitLabel = "حفظ", onSubmit, onCancel, loading, lockName }: Props) {
  const [fullName, setFullName] = useState(initial?.full_name ?? "");
  const [battalionId, setBattalionId] = useState(initial?.battalion_id ?? "");
  const [companyId, setCompanyId] = useState(initial?.company_id ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const { data: departments = [] } = useDepartments();
  const { data: battalions = [] } = useBattalions();
  const { data: companies = [] } = useCompanies();
  const { currentDepartmentId } = useDepartmentContext();

  // Initial department: from the initial battalion's department, or current
  // global department, or first department available.
  const initialBattalion = useMemo(
    () => battalions.find((b) => b.id === initial?.battalion_id),
    [battalions, initial?.battalion_id],
  );
  const [departmentId, setDepartmentId] = useState<string>(
    initialBattalion?.department_id
      ?? (currentDepartmentId !== "all" ? currentDepartmentId : "")
      ?? "",
  );

  useEffect(() => {
    setFullName(initial?.full_name ?? "");
    setBattalionId(initial?.battalion_id ?? "");
    setCompanyId(initial?.company_id ?? "");
    setNotes(initial?.notes ?? "");
    const initBat = battalions.find((b) => b.id === initial?.battalion_id);
    if (initBat) setDepartmentId(initBat.department_id);
    else if (currentDepartmentId !== "all") setDepartmentId(currentDepartmentId);
  }, [initial, battalions, currentDepartmentId]);

  // Default to first department if none picked and only one exists
  useEffect(() => {
    if (!departmentId && departments.length === 1) {
      setDepartmentId(departments[0].id);
    }
  }, [departmentId, departments]);

  const filteredBattalions = useMemo(
    () => (departmentId ? battalions.filter((b) => b.department_id === departmentId) : battalions),
    [battalions, departmentId],
  );

  const filteredCompanies = useMemo(
    () => companies.filter((c) => c.battalion_id === battalionId),
    [companies, battalionId],
  );

  // Reset battalion if its department doesn't match selected department
  useEffect(() => {
    if (battalionId && !filteredBattalions.some((b) => b.id === battalionId)) {
      setBattalionId("");
      setCompanyId("");
    }
  }, [departmentId, filteredBattalions, battalionId]);

  // Reset company if battalion changes and current company no longer valid
  useEffect(() => {
    if (companyId && !filteredCompanies.some((c) => c.id === companyId)) {
      setCompanyId("");
    }
  }, [battalionId, filteredCompanies, companyId]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!fullName.trim() || !departmentId || !battalionId || !companyId) return;
        onSubmit({
          full_name: fullName.trim().slice(0, 200),
          battalion_id: battalionId,
          company_id: companyId,
          notes: notes.trim().slice(0, 2000),
        });
      }}
      className="space-y-5"
    >
      <div className="space-y-2">
        <Label htmlFor="full_name">الاسم الكامل</Label>
        <Input
          id="full_name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="أدخل الاسم الكامل للطالب"
          maxLength={200}
          required
          readOnly={lockName}
          disabled={lockName}
        />
        {lockName && (
          <p className="text-xs text-muted-foreground">
            تعديل الاسم متاح للمدير فقط.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="department">القسم</Label>
        <Select value={departmentId} onValueChange={setDepartmentId}>
          <SelectTrigger id="department">
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
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="battalion">الكتيبة</Label>
          <Select value={battalionId} onValueChange={setBattalionId} disabled={!departmentId}>
            <SelectTrigger id="battalion">
              <SelectValue placeholder={departmentId ? "اختر الكتيبة" : "اختر القسم أولاً"} />
            </SelectTrigger>
            <SelectContent>
              {filteredBattalions.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
              {departmentId && filteredBattalions.length === 0 && (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  لا توجد كتائب في هذا القسم
                </div>
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="company">السرية</Label>
          <Select
            value={companyId}
            onValueChange={setCompanyId}
            disabled={!battalionId}
          >
            <SelectTrigger id="company">
              <SelectValue
                placeholder={battalionId ? "اختر السرية" : "اختر الكتيبة أولاً"}
              />
            </SelectTrigger>
            <SelectContent>
              {filteredCompanies.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
              {battalionId && filteredCompanies.length === 0 && (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  لا توجد سرايا — أضفها من الإعدادات
                </div>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">معلومات إضافية</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="العمر، رقم التواصل، مستوى الحفظ، تاريخ البدء..."
          rows={5}
          maxLength={2000}
        />
      </div>

      <div className="flex gap-2 justify-end pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            إلغاء
          </Button>
        )}
        <Button
          type="submit"
          disabled={loading || !fullName.trim() || !departmentId || !battalionId || !companyId}
        >
          {loading ? "جارٍ الحفظ..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}

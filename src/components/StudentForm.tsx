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
import { useBattalions, useCompanies } from "@/lib/orgs";

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

  const { data: battalions = [] } = useBattalions();
  const { data: companies = [] } = useCompanies();

  useEffect(() => {
    setFullName(initial?.full_name ?? "");
    setBattalionId(initial?.battalion_id ?? "");
    setCompanyId(initial?.company_id ?? "");
    setNotes(initial?.notes ?? "");
  }, [initial]);

  const filteredCompanies = useMemo(
    () => companies.filter((c) => c.battalion_id === battalionId),
    [companies, battalionId],
  );

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
        if (!fullName.trim() || !battalionId || !companyId) return;
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="battalion">الكتيبة</Label>
          <Select value={battalionId} onValueChange={setBattalionId}>
            <SelectTrigger id="battalion">
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
          disabled={loading || !fullName.trim() || !battalionId || !companyId}
        >
          {loading ? "جارٍ الحفظ..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}

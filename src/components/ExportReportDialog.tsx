import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useBattalions, useCompanies } from "@/lib/orgs";
import { getErrorMessage } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Format = "csv" | "xlsx";

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildCsv(rows: (string | number | null)[][]): string {
  return rows.map((r) => r.map(csvEscape).join(",")).join("\r\n");
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 2000);
}

function downloadXlsx(sheetName: string, rows: (string | number | null)[][], filename: string) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [
    { wch: 14 }, { wch: 28 }, { wch: 12 }, { wch: 12 },
    { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 12 }, { wch: 14 }, { wch: 60 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31) || "Report");
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  saveBlob(
    new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    filename,
  );
}

function downloadCsv(content: string, filename: string) {
  // Prepend UTF-8 BOM so Excel reads Arabic correctly
  saveBlob(new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8" }), filename);
}

export function ExportReportDialog() {
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [companyId, setCompanyId] = useState<string>("");
  const [format, setFormat] = useState<Format>("xlsx");
  const [loading, setLoading] = useState(false);

  const { data: battalions = [] } = useBattalions();
  const { data: companies = [] } = useCompanies();

  const companyOptions = useMemo(
    () =>
      companies.map((c) => {
        const b = battalions.find((x) => x.id === c.battalion_id);
        return { id: c.id, label: `${c.name}${b ? ` — ${b.name}` : ""}` };
      }),
    [companies, battalions],
  );

  const handleExport = async () => {
    if (!companyId) return toast.error("اختر سرية");
    if (!from || !to) return toast.error("حدد الفترة الزمنية");
    if (from > to) return toast.error("تاريخ البداية بعد تاريخ النهاية");

    setLoading(true);
    try {
      const company = companies.find((c) => c.id === companyId);
      const battalion = battalions.find((b) => b.id === company?.battalion_id);

      const { data: students, error: sErr } = await supabase
        .from("students")
        .select("*")
        .eq("company_id", companyId)
        .order("full_name");
      if (sErr) throw sErr;
      const studentIds = (students ?? []).map((s) => s.id);

      if (studentIds.length === 0) {
        toast.warning("لا يوجد طلاب في هذه السرية");
        setLoading(false);
        return;
      }

      const [attRes, recRes] = await Promise.all([
        supabase
          .from("attendance")
          .select("*")
          .in("student_id", studentIds)
          .gte("attended_on", from)
          .lte("attended_on", to),
        supabase
          .from("recitations")
          .select("*")
          .in("student_id", studentIds)
          .gte("recited_on", from)
          .lte("recited_on", to),
      ]);
      if (attRes.error) throw attRes.error;
      if (recRes.error) throw recRes.error;

      const attByStudent = new Map<
        string,
        { present: number; absent: number; ratedSum: number; ratedCount: number; repeats: number }
      >();
      (attRes.data ?? []).forEach((a) => {
        const cur =
          attByStudent.get(a.student_id) ?? {
            present: 0,
            absent: 0,
            ratedSum: 0,
            ratedCount: 0,
            repeats: 0,
          };
        if (a.present) cur.present++;
        else cur.absent++;
        const r = (a as { rating?: string | null }).rating;
        if (r === "8" || r === "9" || r === "10") {
          cur.ratedSum += Number(r);
          cur.ratedCount++;
        } else if (r === "repeat") {
          cur.repeats++;
        }
        attByStudent.set(a.student_id, cur);
      });

      const recByStudent = new Map<string, typeof recRes.data>();
      (recRes.data ?? []).forEach((r) => {
        const list = recByStudent.get(r.student_id) ?? [];
        list.push(r);
        recByStudent.set(r.student_id, list);
      });

      const rows: (string | number | null)[][] = [];
      rows.push([
        `تقرير سرية: ${company?.name ?? ""}${battalion ? ` — كتيبة: ${battalion.name}` : ""}`,
      ]);
      rows.push([`الفترة: من ${from} إلى ${to}`]);
      rows.push([]);
      rows.push([
        "الرقم التعريفي",
        "الاسم الكامل",
        "أيام الحضور",
        "أيام الغياب",
        "نسبة الحضور %",
        "معدل التسميع التراكمي",
        "عدد التسميعات المُقيَّمة",
        "مرات الإعادة",
        "عدد التسميعات",
        "تفاصيل التسميعات",
      ]);

      (students ?? []).forEach((s) => {
        const a =
          attByStudent.get(s.id) ?? {
            present: 0,
            absent: 0,
            ratedSum: 0,
            ratedCount: 0,
            repeats: 0,
          };
        const total = a.present + a.absent;
        const pct = total ? Math.round((a.present / total) * 100) : 0;
        const avg = a.ratedCount ? +(a.ratedSum / a.ratedCount).toFixed(2) : "";
        const recs = recByStudent.get(s.id) ?? [];
        const recDetails = recs
          .map(
            (r) =>
              `${r.recited_on}: ${r.surah} ${r.from_ayah}-${r.to_ayah}${r.notes ? ` (${r.notes})` : ""}`,
          )
          .join(" | ");
        rows.push([
          s.student_code,
          s.full_name,
          a.present,
          a.absent,
          pct,
          avg,
          a.ratedCount,
          a.repeats,
          recs.length,
          recDetails,
        ]);
      });

      const stamp = `${company?.name ?? "company"}_${from}_${to}`.replace(/\s+/g, "_");
      if (format === "csv") {
        downloadCsv(buildCsv(rows), `${stamp}.csv`);
      } else {
        downloadXlsx(company?.name ?? "Report", rows, `${stamp}.xlsx`);
      }

      toast.success("تم تحميل التقرير");
      setOpen(false);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">تصدير التقارير</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>تصدير تقرير سرية</DialogTitle>
          <DialogDescription>
            اختر السرية والفترة الزمنية لتحميل بيانات الحضور والتسميعات.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>السرية</Label>
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger>
                <SelectValue placeholder="اختر سرية" />
              </SelectTrigger>
              <SelectContent>
                {companyOptions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>من تاريخ</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>إلى تاريخ</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>صيغة الملف</Label>
            <Select value={format} onValueChange={(v) => setFormat(v as Format)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
                <SelectItem value="csv">CSV (.csv)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            إلغاء
          </Button>
          <Button onClick={handleExport} disabled={loading} className="gap-2">
            <Download className="h-4 w-4" />
            {loading ? "جارٍ التحضير..." : "تحميل"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

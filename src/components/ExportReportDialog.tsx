import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { supabase } from "@/integrations/supabase/client";
import { useBattalions, useCompanies } from "@/lib/orgs";
import { getErrorMessage } from "@/lib/errors";
import {
  buildRecitationDetail,
  formatReportDate,
  sortRecitationsByDateAsc,
} from "@/lib/reportService";
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

type Format = "csv" | "xlsx" | "pdf";

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

type PdfRow = {
  code: string;
  name: string;
  present: number;
  absent: number;
  pct: number;
  avg: string;
  rated: number;
  repeats: number;
  total: number;
  details: string;
};

async function downloadPdf(
  title: string,
  subtitle: string,
  rows: PdfRow[],
  filename: string,
) {
  const container = document.createElement("div");
  container.setAttribute("dir", "rtl");
  container.style.cssText =
    "position:fixed;top:0;left:-9999px;width:1100px;background:#fff;color:#111;padding:24px;font-family:Tajawal,system-ui,sans-serif;";
  container.innerHTML = `
    <div style="border-bottom:2px solid #0f5132;padding-bottom:8px;margin-bottom:14px;">
      <h1 style="margin:0;font-size:20px;font-weight:700;color:#0f5132;">${title}</h1>
      <div style="font-size:12px;color:#555;margin-top:4px;">${subtitle}</div>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:11px;">
      <thead>
        <tr style="background:#0f5132;color:#fff;">
          <th style="border:1px solid #0f5132;padding:6px;text-align:right;">الرقم</th>
          <th style="border:1px solid #0f5132;padding:6px;text-align:right;">الاسم</th>
          <th style="border:1px solid #0f5132;padding:6px;text-align:center;">حضور</th>
          <th style="border:1px solid #0f5132;padding:6px;text-align:center;">غياب</th>
          <th style="border:1px solid #0f5132;padding:6px;text-align:center;">% الحضور</th>
          <th style="border:1px solid #0f5132;padding:6px;text-align:center;">المعدل</th>
          <th style="border:1px solid #0f5132;padding:6px;text-align:center;">مُقيَّمة</th>
          <th style="border:1px solid #0f5132;padding:6px;text-align:center;">إعادة</th>
          <th style="border:1px solid #0f5132;padding:6px;text-align:center;">إجمالي</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (r, i) => `
          <tr style="background:${i % 2 ? "#f7faf8" : "#fff"};">
            <td style="border:1px solid #d6d6d6;padding:5px;text-align:right;font-family:monospace;">${r.code}</td>
            <td style="border:1px solid #d6d6d6;padding:5px;text-align:right;font-weight:600;">${r.name}</td>
            <td style="border:1px solid #d6d6d6;padding:5px;text-align:center;color:#0f5132;font-weight:600;">${r.present}</td>
            <td style="border:1px solid #d6d6d6;padding:5px;text-align:center;color:#b91c1c;">${r.absent}</td>
            <td style="border:1px solid #d6d6d6;padding:5px;text-align:center;">${r.pct}%</td>
            <td style="border:1px solid #d6d6d6;padding:5px;text-align:center;font-weight:700;">${r.avg || "—"}</td>
            <td style="border:1px solid #d6d6d6;padding:5px;text-align:center;">${r.rated}</td>
            <td style="border:1px solid #d6d6d6;padding:5px;text-align:center;color:#b45309;">${r.repeats}</td>
            <td style="border:1px solid #d6d6d6;padding:5px;text-align:center;">${r.total}</td>
          </tr>
          ${
            r.details
              ? `<tr style="background:${i % 2 ? "#f7faf8" : "#fff"};">
                  <td colspan="9" style="border:1px solid #d6d6d6;padding:5px 8px;font-size:10px;color:#444;text-align:right;">
                    <strong>تفاصيل:</strong> ${r.details.replace(/</g, "&lt;")}
                  </td>
                </tr>`
              : ""
          }
        `,
          )
          .join("")}
      </tbody>
    </table>
    <div style="margin-top:12px;font-size:10px;color:#666;text-align:left;">
      تاريخ التوليد: ${new Date().toLocaleString("ar-EG")}
    </div>
  `;
  document.body.appendChild(container);
  try {
    await new Promise((r) => setTimeout(r, 50));
    const canvas = await html2canvas(container, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
    });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("l", "mm", "a4");
    const pageW = 297;
    const pageH = 210;
    const imgH = (canvas.height * pageW) / canvas.width;
    let heightLeft = imgH;
    let position = 0;
    pdf.addImage(imgData, "PNG", 0, position, pageW, imgH);
    heightLeft -= pageH;
    while (heightLeft > 0) {
      position = heightLeft - imgH;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, pageW, imgH);
      heightLeft -= pageH;
    }
    pdf.save(filename);
  } finally {
    container.remove();
  }
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
          .lte("attended_on", to)
          .order("attended_on", { ascending: true }),
        supabase
          .from("recitations")
          .select("*")
          .in("student_id", studentIds)
          .gte("recited_on", from)
          .lte("recited_on", to)
          .order("recited_on", { ascending: true })
          .order("created_at", { ascending: true }),
      ]);
      if (attRes.error) throw attRes.error;
      if (recRes.error) throw recRes.error;
      const filteredRecitations = sortRecitationsByDateAsc(
        (recRes.data ?? []).filter((r) => studentIds.includes(r.student_id)),
      );

      const attByStudent = new Map<
        string,
        { present: number; absent: number }
      >();
      (attRes.data ?? []).forEach((a) => {
        const cur =
          attByStudent.get(a.student_id) ?? { present: 0, absent: 0 };
        if (a.present) cur.present++;
        else cur.absent++;
        attByStudent.set(a.student_id, cur);
      });

      const recByStudent = new Map<string, typeof recRes.data>();
      const ratingByStudent = new Map<
        string,
        { ratedSum: number; ratedCount: number; repeats: number }
      >();
      filteredRecitations.forEach((r) => {
        const list = recByStudent.get(r.student_id) ?? [];
        list.push(r);
        recByStudent.set(r.student_id, list);

        const cur =
          ratingByStudent.get(r.student_id) ?? {
            ratedSum: 0,
            ratedCount: 0,
            repeats: 0,
          };
        const rr = (r as { rating?: string | null }).rating;
        if (rr === "8" || rr === "9" || rr === "10") {
          cur.ratedSum += Number(rr);
          cur.ratedCount++;
        } else if (rr === "repeat") {
          cur.repeats++;
        }
        ratingByStudent.set(r.student_id, cur);
      });

      const rows: (string | number | null)[][] = [];
      rows.push([
        `تقرير سرية: ${company?.name ?? ""}${battalion ? ` — كتيبة: ${battalion.name}` : ""}`,
      ]);
      rows.push([`الفترة: من ${formatReportDate(from)} إلى ${formatReportDate(to)}`]);
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

      const pdfRows: PdfRow[] = [];
      (students ?? []).forEach((s) => {
        const a = attByStudent.get(s.id) ?? { present: 0, absent: 0 };
        const rt =
          ratingByStudent.get(s.id) ?? { ratedSum: 0, ratedCount: 0, repeats: 0 };
        const total = a.present + a.absent;
        const pct = total ? Math.round((a.present / total) * 100) : 0;
        const avg = rt.ratedCount ? +(rt.ratedSum / rt.ratedCount).toFixed(2) : "";
        const recs = sortRecitationsByDateAsc(recByStudent.get(s.id) ?? []);
        const recDetails = recs
          .map((r) => buildRecitationDetail(r))
          .join(" | ");
        rows.push([
          s.student_code,
          s.full_name,
          a.present,
          a.absent,
          pct,
          avg,
          rt.ratedCount,
          rt.repeats,
          recs.length,
          recDetails,
        ]);
        pdfRows.push({
          code: s.student_code,
          name: s.full_name,
          present: a.present,
          absent: a.absent,
          pct,
          avg: avg === "" ? "" : String(avg),
          rated: rt.ratedCount,
          repeats: rt.repeats,
          total: recs.length,
          details: recDetails,
        });
      });

      const stamp = `${company?.name ?? "company"}_${from}_${to}`.replace(/\s+/g, "_");
      if (format === "csv") {
        downloadCsv(buildCsv(rows), `${stamp}.csv`);
      } else if (format === "pdf") {
        await downloadPdf(
          `تقرير سرية: ${company?.name ?? ""}${battalion ? ` — كتيبة: ${battalion.name}` : ""}`,
          `الفترة: من ${formatReportDate(from)} إلى ${formatReportDate(to)}`,
          pdfRows,
          `${stamp}.pdf`,
        );
      } else {
        downloadXlsx(company?.name ?? "Report", rows, `${stamp}.xlsx`);
      }

      toast.success("تم تحميل التقرير");
      setOpen(false);
    } catch (e) {
      console.error("Comprehensive Export Error:", e);
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
                <SelectItem value="pdf">PDF (.pdf)</SelectItem>
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

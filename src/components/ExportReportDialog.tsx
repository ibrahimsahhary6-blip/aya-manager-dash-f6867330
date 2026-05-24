import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import ExcelJS from "exceljs";
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

async function downloadXlsx(
  sheetName: string,
  titleRows: string[],
  headers: string[],
  dataRows: (string | number | null)[][],
  filename: string,
) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "نظام إدارة التسميع";
  wb.created = new Date();
  const ws = wb.addWorksheet(sheetName.slice(0, 31) || "Report", {
    views: [{ rightToLeft: true, state: "frozen", ySplit: titleRows.length + 1 }],
    pageSetup: { orientation: "landscape", paperSize: 9, fitToPage: true },
  });

  ws.columns = [
    { width: 16 }, { width: 32 }, { width: 12 }, { width: 12 },
    { width: 14 }, { width: 18 }, { width: 18 }, { width: 12 }, { width: 14 }, { width: 70 },
  ];

  const colCount = headers.length;
  const lastColLetter = String.fromCharCode(64 + colCount); // A..Z

  // Title rows (merged across all columns)
  titleRows.forEach((t, idx) => {
    const row = ws.addRow([t]);
    ws.mergeCells(`A${idx + 1}:${lastColLetter}${idx + 1}`);
    const cell = row.getCell(1);
    cell.value = t;
    cell.alignment = { horizontal: "right", vertical: "middle", readingOrder: "rtl", wrapText: true };
    cell.font = { name: "Tajawal", size: idx === 0 ? 16 : 12, bold: idx === 0, color: { argb: "FF0F5132" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: idx === 0 ? "FFE8F1EC" : "FFF3F7F5" } };
    row.height = idx === 0 ? 28 : 20;
  });

  // Spacer
  ws.addRow([]);

  // Header row
  const headerRow = ws.addRow(headers);
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.font = { name: "Tajawal", bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F5132" } };
    cell.alignment = { horizontal: "center", vertical: "middle", readingOrder: "rtl", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: "FF0F5132" } },
      bottom: { style: "thin", color: { argb: "FF0F5132" } },
      left: { style: "thin", color: { argb: "FF0F5132" } },
      right: { style: "thin", color: { argb: "FF0F5132" } },
    };
  });

  // Data rows with alternating colors + per-column accents
  dataRows.forEach((r, i) => {
    const row = ws.addRow(r);
    const zebra = i % 2 === 0 ? "FFFFFFFF" : "FFF5F7F6";
    row.eachCell((cell, colNumber) => {
      cell.font = { name: "Tajawal", size: 11, color: { argb: "FF111111" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: zebra } };
      cell.alignment = {
        horizontal: colNumber === 2 || colNumber === 10 ? "right" : "center",
        vertical: "middle",
        readingOrder: "rtl",
        wrapText: true,
      };
      cell.border = {
        top: { style: "hair", color: { argb: "FFCBD5D1" } },
        bottom: { style: "hair", color: { argb: "FFCBD5D1" } },
        left: { style: "hair", color: { argb: "FFCBD5D1" } },
        right: { style: "hair", color: { argb: "FFCBD5D1" } },
      };
      // Accents: present (col 3) green, absent (col 4) red, repeats (col 8) amber, name (col 2) bold
      if (colNumber === 2) cell.font = { ...cell.font, bold: true };
      if (colNumber === 3) cell.font = { ...cell.font, color: { argb: "FF0F5132" }, bold: true };
      if (colNumber === 4) cell.font = { ...cell.font, color: { argb: "FFB91C1C" }, bold: true };
      if (colNumber === 5) cell.font = { ...cell.font, color: { argb: "FF0F5132" } };
      if (colNumber === 6) cell.font = { ...cell.font, bold: true, color: { argb: "FF1E40AF" } };
      if (colNumber === 8) cell.font = { ...cell.font, color: { argb: "FFB45309" } };
    });
    row.height = 22;
  });

  const buf = await wb.xlsx.writeBuffer();
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

function escHtml(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildPdfHtml(title: string, subtitle: string, rows: PdfRow[]): string {
  return `
    <div style="border-bottom:2px solid #0f5132;padding-bottom:8px;margin-bottom:14px;font-family:'Tajawal','Segoe UI',Tahoma,Arial,sans-serif;letter-spacing:0;">
      <h1 style="margin:0;font-size:20px;font-weight:700;color:#0f5132;">${escHtml(title)}</h1>
      <div style="font-size:12px;color:#555555;margin-top:4px;">${escHtml(subtitle)}</div>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:11px;color:#111111;table-layout:fixed;word-break:break-word;font-family:'Tajawal','Segoe UI',Tahoma,Arial,sans-serif;letter-spacing:0;direction:rtl;unicode-bidi:plaintext;">
      <colgroup>
        <col style="width:7%" />
        <col style="width:18%" />
        <col style="width:6%" />
        <col style="width:6%" />
        <col style="width:8%" />
        <col style="width:7%" />
        <col style="width:7%" />
        <col style="width:6%" />
        <col style="width:7%" />
        <col style="width:28%" />
      </colgroup>
      <thead>
        <tr style="background:#0f5132;color:#ffffff;">
          <th style="border:1.5px solid #0f5132;padding:10px 4px;text-align:center;line-height:1.6;">الرقم</th>
          <th style="border:1.5px solid #0f5132;padding:10px 4px;text-align:center;line-height:1.6;">الاسم</th>
          <th style="border:1.5px solid #0f5132;padding:10px 4px;text-align:center;line-height:1.6;">حضور</th>
          <th style="border:1.5px solid #0f5132;padding:10px 4px;text-align:center;line-height:1.6;">غياب</th>
          <th style="border:1.5px solid #0f5132;padding:10px 4px;text-align:center;line-height:1.6;">% الحضور</th>
          <th style="border:1.5px solid #0f5132;padding:10px 4px;text-align:center;line-height:1.6;">المعدل</th>
          <th style="border:1.5px solid #0f5132;padding:10px 4px;text-align:center;line-height:1.6;">مُقيَّمة</th>
          <th style="border:1.5px solid #0f5132;padding:10px 4px;text-align:center;line-height:1.6;">إعادة</th>
          <th style="border:1.5px solid #0f5132;padding:10px 4px;text-align:center;line-height:1.6;">إجمالي</th>
          <th style="border:1.5px solid #0f5132;padding:10px 4px;text-align:center;line-height:1.6;">تفاصيل الأسبوع</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (r, i) => `
          <tr style="background:${i % 2 ? "#f5f7f6" : "#ffffff"};color:#111111;">
            <td style="border:1px solid #999;padding:10px 4px;text-align:center;font-family:monospace;line-height:1.7;white-space:nowrap;">${escHtml(r.code)}</td>
            <td style="border:1px solid #999;padding:10px 8px;text-align:right;font-family:'Tajawal','Segoe UI',Tahoma,Arial,sans-serif;font-weight:700;line-height:2;letter-spacing:0;word-spacing:4px;word-break:normal;overflow-wrap:anywhere;white-space:normal;direction:rtl;unicode-bidi:plaintext;">${escHtml(r.name)}</td>
            <td style="border:1px solid #999;padding:10px 4px;text-align:center;color:#0f5132;font-weight:600;line-height:1.7;">${r.present}</td>
            <td style="border:1px solid #999;padding:10px 4px;text-align:center;color:#b91c1c;line-height:1.7;">${r.absent}</td>
            <td style="border:1px solid #999;padding:10px 4px;text-align:center;line-height:1.7;">${r.pct}%</td>
            <td style="border:1px solid #999;padding:10px 4px;text-align:center;font-weight:700;line-height:1.7;">${escHtml(r.avg) || "—"}</td>
            <td style="border:1px solid #999;padding:10px 4px;text-align:center;line-height:1.7;">${r.rated}</td>
            <td style="border:1px solid #999;padding:10px 4px;text-align:center;color:#b45309;line-height:1.7;">${r.repeats}</td>
            <td style="border:1px solid #999;padding:10px 4px;text-align:center;line-height:1.7;">${r.total}</td>
            <td style="border:1px solid #999;padding:10px 8px;text-align:right;font-size:10px;color:#374151;line-height:1.9;word-break:break-word;">${
              r.details ? escHtml(r.details) : "—"
            }</td>
          </tr>
        `,
          )
          .join("")}
      </tbody>
    </table>
    <div style="margin-top:12px;font-size:10px;color:#666666;text-align:left;">
      تاريخ التوليد: ${escHtml(new Date().toLocaleString("ar-EG"))}
    </div>
  `;
}

async function downloadPdf(html: string, filename: string) {
  const doc = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8" />
<title>${filename.replace(/\.pdf$/i, "")}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">
<style>
  @page { size: A4 landscape; margin: 12mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #111;
    font-family: 'Tajawal', 'Segoe UI', Tahoma, Arial, sans-serif; }
  body { padding: 16px; direction: rtl; }
  table { width: 100%; border-collapse: collapse; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>${html}
<script>
  window.addEventListener('load', function () {
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function(){ setTimeout(function(){ window.print(); }, 200); });
    } else { setTimeout(function(){ window.print(); }, 400); }
  });
  window.addEventListener('afterprint', function(){ window.close(); });
<\/script>
</body></html>`;
  const w = window.open("", "_blank");
  if (!w) {
    throw new Error("فشل فتح نافذة الطباعة. يرجى السماح بالنوافذ المنبثقة.");
  }
  w.document.open();
  w.document.write(doc);
  w.document.close();
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
  const [preview, setPreview] = useState<{ html: string; filename: string; title: string } | null>(null);

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

      const titleRows = [
        `تقرير سرية: ${company?.name ?? ""}${battalion ? ` — كتيبة: ${battalion.name}` : ""}`,
        `الفترة: من ${formatReportDate(from)} إلى ${formatReportDate(to)}`,
      ];
      const headers = [
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
      ];
      const dataRows: (string | number | null)[][] = [];

      // For CSV we still need a flat rows array
      const csvRows: (string | number | null)[][] = [
        [titleRows[0]],
        [titleRows[1]],
        [],
        headers,
      ];

      const pdfRows: PdfRow[] = [];
      (students ?? []).forEach((s) => {
        const a = attByStudent.get(s.id) ?? { present: 0, absent: 0 };
        const rt =
          ratingByStudent.get(s.id) ?? { ratedSum: 0, ratedCount: 0, repeats: 0 };
        const total = a.present + a.absent;
        const pct = total ? Math.round((a.present / total) * 100) : 0;
        const avg = rt.ratedCount ? +(rt.ratedSum / rt.ratedCount).toFixed(2) : "";
        const recs = sortRecitationsByDateAsc(recByStudent.get(s.id) ?? []);
        const recDetails = recs.map((r) => buildRecitationDetail(r)).join(" | ");
        const row: (string | number | null)[] = [
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
        ];
        dataRows.push(row);
        csvRows.push(row);
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
        downloadCsv(buildCsv(csvRows), `${stamp}.csv`);
        toast.success("تم تحميل التقرير");
        setOpen(false);
      } else if (format === "pdf") {
        if (pdfRows.length === 0) throw new Error("لا توجد بيانات لتصديرها");
        const title = `تقرير سرية: ${company?.name ?? ""}${battalion ? ` — كتيبة: ${battalion.name}` : ""}`;
        const subtitle = `الفترة: من ${formatReportDate(from)} إلى ${formatReportDate(to)}`;
        const html = buildPdfHtml(title, subtitle, pdfRows);
        setOpen(false);
        setPreview({ html, filename: `${stamp}.pdf`, title });
      } else {
        await downloadXlsx(company?.name ?? "Report", titleRows, headers, dataRows, `${stamp}.xlsx`);
        toast.success("تم تحميل التقرير");
        setOpen(false);
      }

    } catch (e) {
      console.error("Comprehensive Export Error:", e);
      toast.error(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
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
                  <SelectItem value="pdf">PDF (.pdf) — مع معاينة</SelectItem>
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
              {loading ? "جارٍ التحضير..." : format === "pdf" ? "معاينة" : "تحميل"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-6xl max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-3 border-b">
            <DialogTitle>معاينة قبل التحميل</DialogTitle>
            <DialogDescription>راجع التقرير قبل تنزيله كملف PDF.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto bg-white p-4" dir="rtl">
            {preview && (
              <div
                className="bg-white text-black mx-auto"
                style={{ width: "100%", maxWidth: 1280 }}
                dangerouslySetInnerHTML={{ __html: preview.html }}
              />
            )}
          </div>
          <DialogFooter className="px-6 py-4 border-t bg-muted/20">
            <Button variant="outline" onClick={() => setPreview(null)} disabled={loading}>
              إغلاق
            </Button>
            <Button
              onClick={async () => {
                if (!preview) return;
                setLoading(true);
                try {
                  await downloadPdf(preview.html, preview.filename);
                  toast.success("تم تحميل التقرير");
                  setPreview(null);
                  setOpen(false);
                } catch (e) {
                  toast.error(getErrorMessage(e));
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              {loading ? "جارٍ التوليد..." : "تحميل PDF"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

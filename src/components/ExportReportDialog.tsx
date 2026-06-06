import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import ExcelJS from "exceljs";
import { BRAND_LOGO_URL, BRAND_NAME } from "@/components/BrandLogo";
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
  // IMPORTANT: do NOT set target="_blank" — it makes some browsers open the
  // blob in a new tab instead of downloading it.
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 4000);
}

type XlsxSheet = {
  sheetName: string;
  titleRows: string[];
  headers: string[];
  dataRows: (string | number | null)[][];
};

async function downloadXlsxMulti(sheets: XlsxSheet[], filename: string) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "نظام إدارة التسميع";
  wb.created = new Date();

  const usedNames = new Set<string>();
  const safeName = (n: string, i: number) => {
    let base = (n || `Report ${i + 1}`).replace(/[\\/?*\[\]:]/g, "").slice(0, 31) || `Sheet ${i + 1}`;
    let candidate = base;
    let suffix = 2;
    while (usedNames.has(candidate)) {
      const tail = `_${suffix++}`;
      candidate = base.slice(0, 31 - tail.length) + tail;
    }
    usedNames.add(candidate);
    return candidate;
  };

  sheets.forEach(({ sheetName, titleRows, headers, dataRows }, sheetIdx) => {
    const ws = wb.addWorksheet(safeName(sheetName, sheetIdx), {
      views: [{ rightToLeft: true, state: "frozen", ySplit: titleRows.length + 1 }],
      pageSetup: { orientation: "landscape", paperSize: 9, fitToPage: true },
    });

    ws.columns = [
      { width: 14 },
      { width: 28 },
      { width: 10 },
      { width: 12 },
      { width: 10 },
      { width: 12 },
      { width: 12 },
      { width: 14 },
      { width: 14 },
      { width: 10 },
      { width: 12 },
      { width: 60 },
    ];

    const colCount = headers.length;
    const lastColLetter = String.fromCharCode(64 + colCount);

    titleRows.forEach((t, idx) => {
      const row = ws.addRow([t]);
      ws.mergeCells(`A${idx + 1}:${lastColLetter}${idx + 1}`);
      const cell = row.getCell(1);
      cell.value = t;
      cell.alignment = {
        horizontal: "right",
        vertical: "middle",
        readingOrder: "rtl",
        wrapText: true,
      };
      cell.font = {
        name: "Tajawal",
        size: idx === 0 ? 16 : 12,
        bold: idx === 0,
        color: { argb: "FF0F5132" },
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: idx === 0 ? "FFE8F1EC" : "FFF3F7F5" },
      };
      row.height = idx === 0 ? 28 : 20;
    });

    ws.addRow([]);

    const headerRow = ws.addRow(headers);
    headerRow.height = 26;
    headerRow.eachCell((cell) => {
      cell.font = { name: "Tajawal", bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F5132" } };
      cell.alignment = {
        horizontal: "center",
        vertical: "middle",
        readingOrder: "rtl",
        wrapText: true,
      };
      cell.border = {
        top: { style: "thin", color: { argb: "FF0F5132" } },
        bottom: { style: "thin", color: { argb: "FF0F5132" } },
        left: { style: "thin", color: { argb: "FF0F5132" } },
        right: { style: "thin", color: { argb: "FF0F5132" } },
      };
    });

    dataRows.forEach((r, i) => {
      const row = ws.addRow(r);
      const zebra = i % 2 === 0 ? "FFFFFFFF" : "FFF5F7F6";
      row.eachCell((cell, colNumber) => {
        cell.font = { name: "Tajawal", size: 11, color: { argb: "FF111111" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: zebra } };
        cell.alignment = {
          horizontal: colNumber === 2 || colNumber === 12 ? "right" : "center",
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
        // 1:code 2:name 3:present 4:absentTotal 5:absentExcused 6:absentUnexcused
        // 7:pct 8:avg 9:rated 10:repeats 11:total 12:details
        if (colNumber === 2) cell.font = { ...cell.font, bold: true };
        if (colNumber === 3) cell.font = { ...cell.font, color: { argb: "FF0F5132" }, bold: true };
        if (colNumber === 4) cell.font = { ...cell.font, color: { argb: "FFB91C1C" }, bold: true };
        if (colNumber === 5) cell.font = { ...cell.font, color: { argb: "FFB45309" } };
        if (colNumber === 6) cell.font = { ...cell.font, color: { argb: "FF991B1B" }, bold: true };
        if (colNumber === 7) cell.font = { ...cell.font, color: { argb: "FF0F5132" } };
        if (colNumber === 8) cell.font = { ...cell.font, bold: true, color: { argb: "FF1E40AF" } };
        if (colNumber === 10) cell.font = { ...cell.font, color: { argb: "FFB45309" } };
      });
      row.height = 22;
    });
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
  absentTotal: number;
  absentExcused: number;
  absentUnexcused: number;
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

function buildPdfHtml(title: string, subtitle: string, rows: PdfRow[], battalionLabel?: string): string {
  const logoSrc = new URL(BRAND_LOGO_URL, window.location.origin).toString();
  const cleanBattalion = battalionLabel ? battalionLabel.replace(/^الكتيبة:\s*/, "") : "";
  const cleanCompany = title.replace(/^السرية:\s*/, "");
  const cleanPeriod = subtitle.replace(/^الفترة:\s*/, "");
  return `
    <div style="box-sizing:border-box;width:1200px;max-width:1200px;background:#ffffff;color:#111111;padding:24px;direction:rtl;font-family:'Tajawal','Segoe UI',Tahoma,Arial,sans-serif;letter-spacing:0;">
    <div style="position:relative;margin-bottom:18px;border:1.5px solid #d6c89a;border-radius:12px;background:linear-gradient(135deg,#f7f4ea 0%,#ffffff 60%);box-shadow:0 2px 0 #ecdfb8 inset;overflow:hidden;font-family:'Tajawal','Segoe UI',Tahoma,Arial,sans-serif;">
      <div style="height:6px;background:linear-gradient(90deg,#c9a84c,#0f5132,#c9a84c);"></div>
      <div style="display:flex;align-items:center;gap:16px;padding:14px 18px;">
        <img src="${escHtml(logoSrc)}" alt="شعار" crossorigin="anonymous" style="height:78px;width:78px;object-fit:cover;border-radius:50%;border:3px solid #c9a84c;background:#fff;flex-shrink:0;box-shadow:0 1px 4px rgba(0,0,0,0.08);" />
        <div style="flex:1;min-width:0;text-align:center;">
          <div style="font-size:20px;font-weight:800;color:#0f5132;line-height:1.2;">${escHtml(BRAND_NAME)}</div>
          <div style="display:inline-block;margin-top:6px;font-size:14px;font-weight:700;color:#0f5132;background:#fff;border:1px solid #c9a84c;padding:4px 14px;border-radius:999px;">تقرير الحضور والتسميع</div>
        </div>
        <div style="flex-shrink:0;width:78px;"></div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;padding:0 18px 14px;">
        ${cleanBattalion ? `<div style="background:#0f5132;color:#fff;padding:6px 14px;border-radius:8px;font-size:12.5px;font-weight:700;"><span style="opacity:0.75;font-weight:500;">الكتيبة:</span> ${escHtml(cleanBattalion)}</div>` : ""}
        <div style="background:#1f6b6b;color:#fff;padding:6px 14px;border-radius:8px;font-size:12.5px;font-weight:700;"><span style="opacity:0.75;font-weight:500;">السرية:</span> ${escHtml(cleanCompany)}</div>
        <div style="background:#fff;color:#0f5132;border:1.5px solid #0f5132;padding:5px 14px;border-radius:8px;font-size:12.5px;font-weight:700;"><span style="opacity:0.7;font-weight:500;">الفترة:</span> ${escHtml(cleanPeriod)}</div>
      </div>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:11px;color:#111111;table-layout:fixed;word-break:break-word;font-family:'Tajawal','Segoe UI',Tahoma,Arial,sans-serif;letter-spacing:0;direction:rtl;unicode-bidi:plaintext;">
      <colgroup>
        <col style="width:6%" />
        <col style="width:16%" />
        <col style="width:5%" />
        <col style="width:6%" />
        <col style="width:6%" />
        <col style="width:6%" />
        <col style="width:6%" />
        <col style="width:6%" />
        <col style="width:6%" />
        <col style="width:5%" />
        <col style="width:6%" />
        <col style="width:26%" />
      </colgroup>
      <thead>
        <tr style="background:#0f5132;color:#ffffff;">
          <th style="border:1.5px solid #0f5132;padding:10px 4px;text-align:center;line-height:1.6;">الرقم</th>
          <th style="border:1.5px solid #0f5132;padding:10px 4px;text-align:center;line-height:1.6;">الاسم</th>
          <th style="border:1.5px solid #0f5132;padding:10px 4px;text-align:center;line-height:1.6;">حضور</th>
          <th style="border:1.5px solid #0f5132;padding:10px 4px;text-align:center;line-height:1.6;">إجمالي الغياب</th>
          <th style="border:1.5px solid #0f5132;padding:10px 4px;text-align:center;line-height:1.6;">بعذر</th>
          <th style="border:1.5px solid #0f5132;padding:10px 4px;text-align:center;line-height:1.6;">بدون عذر</th>
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
            <td style="border:1px solid #999;padding:8px 4px;text-align:center;font-family:monospace;line-height:1.6;white-space:nowrap;">${escHtml(r.code)}</td>
            <td style="border:1px solid #999;padding:9px 8px;text-align:right;font-family:'Tajawal','Segoe UI',Tahoma,Arial,sans-serif;font-size:13px;font-weight:700;line-height:1.8;letter-spacing:0;word-spacing:4px;word-break:normal;overflow-wrap:anywhere;white-space:normal;direction:rtl;unicode-bidi:plaintext;">${escHtml(r.name)}</td>
            <td style="border:1px solid #999;padding:8px 4px;text-align:center;color:#0f5132;font-weight:700;line-height:1.6;">${r.present}</td>
            <td style="border:1px solid #999;padding:8px 4px;text-align:center;color:#b91c1c;font-weight:700;line-height:1.6;">${r.absentTotal}</td>
            <td style="border:1px solid #999;padding:8px 4px;text-align:center;color:#b45309;line-height:1.6;">${r.absentExcused}</td>
            <td style="border:1px solid #999;padding:8px 4px;text-align:center;color:#991b1b;font-weight:700;line-height:1.6;">${r.absentUnexcused}</td>
            <td style="border:1px solid #999;padding:8px 4px;text-align:center;line-height:1.6;">${r.pct}%</td>
            <td style="border:1px solid #999;padding:8px 4px;text-align:center;font-weight:700;line-height:1.6;">${escHtml(r.avg) || "—"}</td>
            <td style="border:1px solid #999;padding:8px 4px;text-align:center;line-height:1.6;">${r.rated}</td>
            <td style="border:1px solid #999;padding:8px 4px;text-align:center;color:#b45309;line-height:1.6;">${r.repeats}</td>
            <td style="border:1px solid #999;padding:8px 4px;text-align:center;line-height:1.6;">${r.total}</td>
            <td style="border:1px solid #999;padding:8px;text-align:right;font-size:10px;color:#374151;line-height:1.8;word-break:break-word;">${
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
    </div>
  `;
}

async function downloadPdf(sections: { html: string }[], filename: string) {
  const frame = document.createElement("iframe");
  frame.style.cssText =
    "position:fixed;top:0;left:-10000px;width:1240px;height:1800px;border:0;opacity:0;pointer-events:none;";
  document.body.appendChild(frame);

  try {
    const [{ default: html2canvas }, { default: JsPDF }] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);

    const pdf = new JsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();

    for (let s = 0; s < sections.length; s++) {
      const section = sections[s];
      const doc = frame.contentDocument;
      if (!doc) throw new Error("تعذر تجهيز ملف PDF");
      doc.open();
      doc.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8" />
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">
        <style>
          *{box-sizing:border-box;letter-spacing:0!important}
          html,body{margin:0;padding:0;background:#fff;color:#111;direction:rtl;font-family:'Tajawal','Segoe UI',Tahoma,Arial,sans-serif}
          body{width:1240px;min-height:100%;padding:0}
        </style></head><body>${section.html}</body></html>`);
      doc.close();

      if (doc.fonts && doc.fonts.ready) {
        try {
          await doc.fonts.ready;
        } catch {
          /* ignore */
        }
      }
      const imgs = Array.from(doc.images);
      await Promise.all(
        imgs.map(
          (img) =>
            img.complete && img.naturalWidth > 0
              ? Promise.resolve()
              : new Promise<void>((res) => {
                  img.addEventListener("load", () => res(), { once: true });
                  img.addEventListener("error", () => res(), { once: true });
                }),
        ),
      );
      await new Promise((r) => setTimeout(r, 150));

      const target = doc.body.firstElementChild as HTMLElement | null;
      if (!target) throw new Error("تعذر تجهيز محتوى PDF");
      const canvas = await html2canvas(target, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
        windowWidth: 1200,
        width: 1200,
      });

      const imgW = pageW;
      const imgH = (canvas.height * imgW) / canvas.width;
      const imgData = canvas.toDataURL("image/jpeg", 0.95);

      if (s > 0) pdf.addPage();

      if (imgH <= pageH) {
        pdf.addImage(imgData, "JPEG", 0, 0, imgW, imgH);
      } else {
        let position = 0;
        let remaining = imgH;
        let isFirst = true;
        while (remaining > 0) {
          if (!isFirst) pdf.addPage();
          pdf.addImage(imgData, "JPEG", 0, position, imgW, imgH);
          remaining -= pageH;
          position -= pageH;
          isFirst = false;
        }
      }
    }

    const blob = pdf.output("blob");
    saveBlob(blob, filename);
  } finally {
    frame.remove();
  }
}

export function ExportReportDialog() {
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [companyIds, setCompanyIds] = useState<string[]>([]);
  const [format, setFormat] = useState<Format>("xlsx");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{
    sections: { html: string; title: string }[];
    filename: string;
  } | null>(null);

  const { data: battalions = [] } = useBattalions();
  const { data: companies = [] } = useCompanies();

  const companyOptions = useMemo(() => {
    const sorted = [...companies].sort((a, b) => {
      const ba = battalions.find((x) => x.id === a.battalion_id);
      const bb = battalions.find((x) => x.id === b.battalion_id);
      const baOrder = ba ? battalions.indexOf(ba) : 999;
      const bbOrder = bb ? battalions.indexOf(bb) : 999;
      if (baOrder !== bbOrder) return baOrder - bbOrder;
      return companies.indexOf(a) - companies.indexOf(b);
    });
    return sorted.map((c) => {
      const b = battalions.find((x) => x.id === c.battalion_id);
      return { id: c.id, label: `${b ? `${b.name} — ` : ""}${c.name}` };
    });
  }, [companies, battalions]);

  const toggleCompany = (id: string) => {
    setCompanyIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };
  const allSelected = companyOptions.length > 0 && companyIds.length === companyOptions.length;
  const toggleAll = () => {
    setCompanyIds(allSelected ? [] : companyOptions.map((c) => c.id));
  };

  const handleExport = async () => {
    if (companyIds.length === 0) return toast.error("اختر سرية واحدة على الأقل");
    if (!from || !to) return toast.error("حدد الفترة الزمنية");
    if (from > to) return toast.error("تاريخ البداية بعد تاريخ النهاية");

    setLoading(true);
    try {
      const xlsxSheets: XlsxSheet[] = [];
      const csvBlocks: string[] = [];
      const pdfSections: { html: string; title: string }[] = [];
      let totalStudents = 0;

      // Sort selected company IDs by battalion order → company order, so the
      // report is naturally grouped: كتيبة → سرية → طلاب
      const sortedCompanyIds = [...companyIds].sort((a, b) => {
        const ca = companies.find((c) => c.id === a);
        const cb = companies.find((c) => c.id === b);
        const ba = battalions.find((x) => x.id === ca?.battalion_id);
        const bb = battalions.find((x) => x.id === cb?.battalion_id);
        const baOrder = ba ? battalions.indexOf(ba) : 999;
        const bbOrder = bb ? battalions.indexOf(bb) : 999;
        if (baOrder !== bbOrder) return baOrder - bbOrder;
        const caOrder = ca ? companies.indexOf(ca) : 999;
        const cbOrder = cb ? companies.indexOf(cb) : 999;
        return caOrder - cbOrder;
      });

      for (const cid of sortedCompanyIds) {
        const company = companies.find((c) => c.id === cid);
        const battalion = battalions.find((b) => b.id === company?.battalion_id);


        const { data: students, error: sErr } = await supabase
          .from("students")
          .select("*")
          .eq("company_id", cid)
          .order("full_name");
        if (sErr) throw sErr;
        const studentIds = (students ?? []).map((s) => s.id);
        if (studentIds.length === 0) continue;
        totalStudents += studentIds.length;

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
          { present: number; absentExcused: number; absentUnexcused: number }
        >();
        (attRes.data ?? []).forEach((a) => {
          const cur =
            attByStudent.get(a.student_id) ?? {
              present: 0,
              absentExcused: 0,
              absentUnexcused: 0,
            };
          if (a.present) {
            cur.present++;
          } else if ((a as { excused?: boolean }).excused) {
            cur.absentExcused++;
          } else {
            cur.absentUnexcused++;
          }
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
          const cur = ratingByStudent.get(r.student_id) ?? {
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

        const battalionLabel = battalion ? `الكتيبة: ${battalion.name}` : "بدون كتيبة";
        const companyOnlyLabel = `السرية: ${company?.name ?? ""}`;
        const titleRows = [
          `${BRAND_NAME} — وشؤون المساجد`,
          battalionLabel,
          companyOnlyLabel,
          `الفترة: من ${formatReportDate(from)} إلى ${formatReportDate(to)}`,
        ];
        const headers = [
          "الرقم التعريفي",
          "الاسم الكامل",
          "أيام الحضور",
          "إجمالي الغياب",
          "غياب بعذر",
          "غياب بدون عذر",
          "نسبة الحضور %",
          "معدل التسميع التراكمي",
          "عدد التسميعات المُقيَّمة",
          "مرات الإعادة",
          "عدد التسميعات",
          "تفاصيل التسميعات",
        ];
        const dataRows: (string | number | null)[][] = [];
        const pdfRows: PdfRow[] = [];

        (students ?? []).forEach((s) => {
          const a =
            attByStudent.get(s.id) ?? {
              present: 0,
              absentExcused: 0,
              absentUnexcused: 0,
            };
          const absentTotal = a.absentExcused + a.absentUnexcused;
          const rt = ratingByStudent.get(s.id) ?? { ratedSum: 0, ratedCount: 0, repeats: 0 };
          const total = a.present + absentTotal;
          const pct = total ? Math.round((a.present / total) * 100) : 0;
          const avg = rt.ratedCount ? +(rt.ratedSum / rt.ratedCount).toFixed(2) : "";
          const recs = sortRecitationsByDateAsc(recByStudent.get(s.id) ?? []);
          const recDetails = recs.map((r) => buildRecitationDetail(r)).join(" | ");
          const row: (string | number | null)[] = [
            s.student_code,
            s.full_name,
            a.present,
            absentTotal,
            a.absentExcused,
            a.absentUnexcused,
            pct,
            avg,
            rt.ratedCount,
            rt.repeats,
            recs.length,
            recDetails,
          ];
          dataRows.push(row);
          pdfRows.push({
            code: s.student_code,
            name: s.full_name,
            present: a.present,
            absentTotal,
            absentExcused: a.absentExcused,
            absentUnexcused: a.absentUnexcused,
            pct,
            avg: avg === "" ? "" : String(avg),
            rated: rt.ratedCount,
            repeats: rt.repeats,
            total: recs.length,
            details: recDetails,
          });
        });

        const sheetName = `${battalion?.name ? battalion.name + " - " : ""}${company?.name ?? "Report"}`;
        xlsxSheets.push({
          sheetName,
          titleRows,
          headers,
          dataRows,
        });

        const csvHead: (string | number | null)[][] = [
          [titleRows[0]],
          [titleRows[1]],
          [titleRows[2]],
          [titleRows[3]],
          [],
          headers,
        ];
        csvBlocks.push(buildCsv([...csvHead, ...dataRows]));

        const title = companyOnlyLabel;
        const subtitle = `الفترة: من ${formatReportDate(from)} إلى ${formatReportDate(to)}`;
        pdfSections.push({
          html: buildPdfHtml(title, subtitle, pdfRows, battalionLabel),
          title,
        });
      }

      if (totalStudents === 0) {
        toast.warning("لا يوجد طلاب في السرايا المختارة");
        return;
      }

      const stamp = `companies_${companyIds.length}_${from}_${to}`.replace(/\s+/g, "_");

      if (format === "csv") {
        downloadCsv(csvBlocks.join("\r\n\r\n"), `${stamp}.csv`);
        toast.success("تم تحميل التقرير");
        setOpen(false);
      } else if (format === "pdf") {
        if (pdfSections.length === 0) throw new Error("لا توجد بيانات لتصديرها");
        setOpen(false);
        setPreview({ sections: pdfSections, filename: `${stamp}.pdf` });
      } else {
        await downloadXlsxMulti(xlsxSheets, `${stamp}.xlsx`);
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
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>تصدير تقرير سرية</DialogTitle>
            <DialogDescription>
              اختر السرايا والفترة الزمنية لتحميل بيانات الحضور والتسميعات.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>السرايا (يمكن اختيار أكثر من سرية)</Label>
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={toggleAll}
                >
                  {allSelected ? "إلغاء تحديد الكل" : "تحديد الكل"}
                </button>
              </div>
              <div className="max-h-52 overflow-auto rounded-md border p-2 space-y-1 bg-background">
                {companyOptions.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2 text-center">لا توجد سرايا</p>
                ) : (
                  companyOptions.map((c) => {
                    const checked = companyIds.includes(c.id);
                    return (
                      <label
                        key={c.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent/40 cursor-pointer text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCompany(c.id)}
                          className="h-4 w-4 accent-primary cursor-pointer"
                        />
                        <span className="flex-1">{c.label}</span>
                      </label>
                    );
                  })
                )}
              </div>
              {companyIds.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  تم اختيار {companyIds.length} سرية
                </p>
              )}
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
                  <SelectItem value="xlsx">Excel (.xlsx) — ورقة لكل سرية</SelectItem>
                  <SelectItem value="pdf">PDF (.pdf) — صفحة لكل سرية</SelectItem>
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
            <DialogDescription>
              {preview ? `راجع ${preview.sections.length} تقرير قبل التنزيل (صفحة لكل سرية).` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto bg-white p-4" dir="rtl">
            {preview &&
              preview.sections.map((sec, i) => (
                <div key={i} className="mb-8 last:mb-0">
                  {i > 0 && (
                    <div className="text-xs text-center text-muted-foreground my-3 border-t pt-3">
                      — فاصل صفحة —
                    </div>
                  )}
                  <div
                    className="bg-white text-black mx-auto"
                    style={{ width: "100%", maxWidth: 1280 }}
                    dangerouslySetInnerHTML={{ __html: sec.html }}
                  />
                </div>
              ))}
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
                  await downloadPdf(preview.sections, preview.filename);
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

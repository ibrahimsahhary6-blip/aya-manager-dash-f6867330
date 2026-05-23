import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  publicSearchStudents,
  publicGetStudentHistory,
} from "@/lib/public-lookup.functions";
import { getErrorMessage } from "@/lib/errors";

export const Route = createFileRoute("/lookup")({
  head: () => ({
    meta: [
      { title: "البحث عن سجل طالب — منصة حلقات القرآن" },
      { name: "description", content: "ابحث عن سجلك الخاص بالاسم أو رقم الطالب." },
    ],
  }),
  component: LookupPage,
});

type Match = { id: string; full_name: string; student_code: string };
type History = Awaited<ReturnType<typeof publicGetStudentHistory>>;

function LookupPage() {
  const search = useServerFn(publicSearchStudents);
  const getHistory = useServerFn(publicGetStudentHistory);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Match[] | null>(null);
  const [history, setHistory] = useState<History | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loadHistory = async (id: string) => {
    setSelectedId(id);
    setHistory(null);
    setBusy(true);
    try {
      const res = await getHistory({ data: { studentId: id } });
      setHistory(res);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const onSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() && !code.trim()) {
      toast.error("الرجاء إدخال الاسم أو رقم الطالب");
      return;
    }
    setBusy(true);
    setResults(null);
    setHistory(null);
    setSelectedId(null);
    try {
      const res = await search({ data: { name: name.trim(), code: code.trim() } });
      setResults(res.results);
      if (res.results.length === 0) {
        toast.info("لا توجد نتائج مطابقة");
      } else if (res.results.length === 1) {
        await loadHistory(res.results[0].id);
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div dir="rtl" className="min-h-screen bg-background px-4 py-6">
      <div className="mx-auto max-w-3xl space-y-4 print:max-w-full">
        <header className="text-center print:hidden">
          <h1 className="text-2xl font-bold">بوابة الطالب — عرض السجل</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            ابحث بالاسم أو برقم الطالب ليظهر سجلك مباشرة
          </p>
        </header>

        <Card className="print:hidden">
          <CardHeader>
            <CardTitle className="text-base">حقول البحث</CardTitle>
            <CardDescription>يكفي إدخال أحد الحقلين</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSearch} className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="q-name">الاسم</Label>
                <Input
                  id="q-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: محمد أحمد علي"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="q-code">رقم الطالب</Label>
                <Input
                  id="q-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="ST-000123"
                  dir="ltr"
                />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "جاري البحث..." : "بحث"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {results && results.length > 1 && (
          <Card className="print:hidden">
            <CardHeader>
              <CardTitle className="text-base">النتائج ({results.length})</CardTitle>
              <CardDescription>اختر الطالب لعرض السجل</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {results.map((m) => (
                <button
                  key={m.id}
                  onClick={() => loadHistory(m.id)}
                  className={`w-full rounded-md border p-3 text-right transition hover:bg-accent ${
                    selectedId === m.id ? "border-primary bg-accent" : ""
                  }`}
                >
                  <div className="font-medium">{m.full_name}</div>
                  <div className="text-xs text-muted-foreground" dir="ltr">
                    {m.student_code}
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>
        )}

        {history && <HistoryView data={history} />}
      </div>

      <style>{`
        @media print {
          @page { size: A4; margin: 14mm; }
          body { background: white !important; }
        }
      `}</style>
    </div>
  );
}

function HistoryView({ data }: { data: History }) {
  const printedAt = new Date().toLocaleDateString("ar-EG", {
    year: "numeric", month: "long", day: "numeric",
  });
  const [downloading, setDownloading] = useState(false);

  const onDownload = () => {
    setDownloading(true);
    try {
      const esc = (s: unknown) =>
        String(s ?? "—")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");

      const recRows = data.recitations
        .map(
          (r) => `<tr>
            <td dir="ltr">${esc(r.recited_on)}</td>
            <td>${esc(r.surah)}</td>
            <td dir="ltr">${esc(r.from_ayah)} - ${esc(r.to_ayah)}</td>
            <td>${r.is_review ? "مراجعة" : "حفظ"}</td>
            <td>${esc(r.rating)}</td>
            <td>${esc(r.notes)}</td>
          </tr>`,
        )
        .join("");

      const attRows = data.attendance
        .map(
          (a) => `<tr>
            <td dir="ltr">${esc(a.attended_on)}</td>
            <td>${a.present ? "حاضر" : "غائب"}</td>
            <td>${esc(a.rating)}</td>
          </tr>`,
        )
        .join("");

      const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<title>${esc(data.student.full_name)} - ${esc(data.student.student_code)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Tahoma, Arial, sans-serif; color: #111; margin: 0; padding: 16px; background: #fff; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .muted { color: #666; font-size: 12px; }
  .code { direction: ltr; font-family: monospace; }
  .section { margin-top: 18px; }
  .section h2 { font-size: 15px; margin: 0 0 8px; padding-bottom: 4px; border-bottom: 1px solid #ddd; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: right; vertical-align: top; }
  th { background: #f3f4f6; }
  .empty { color: #666; font-size: 12px; }
  @media print { button { display: none; } }
</style>
</head>
<body>
  <header>
    <h1>${esc(data.student.full_name)}</h1>
    <div class="muted code">${esc(data.student.student_code)}</div>
    <div class="muted">تاريخ الطباعة: ${esc(printedAt)}</div>
  </header>

  <div class="section">
    <h2>سجل التسميع (${data.recitations.length})</h2>
    ${
      data.recitations.length === 0
        ? '<p class="empty">لا يوجد تسميع مسجل</p>'
        : `<table><thead><tr>
            <th>التاريخ</th><th>السورة</th><th>الآيات</th><th>النوع</th><th>التقييم</th><th>ملاحظات</th>
          </tr></thead><tbody>${recRows}</tbody></table>`
    }
  </div>

  <div class="section">
    <h2>سجل الحضور (${data.attendance.length})</h2>
    ${
      data.attendance.length === 0
        ? '<p class="empty">لا يوجد سجل حضور</p>'
        : `<table><thead><tr>
            <th>التاريخ</th><th>الحضور</th><th>التقييم</th>
          </tr></thead><tbody>${attRows}</tbody></table>`
    }
  </div>

  <script>
    window.addEventListener("load", function () {
      setTimeout(function () { window.focus(); window.print(); }, 250);
    });
  </script>
</body>
</html>`;

      const w = window.open("", "_blank");
      if (!w) {
        toast.error("الرجاء السماح بفتح النوافذ المنبثقة");
        return;
      }
      w.document.open();
      w.document.write(html);
      w.document.close();
    } catch (err) {
      toast.error(getErrorMessage(err) || "تعذر إنشاء الملف");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-4" dir="rtl">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">{data.student.full_name}</CardTitle>
            <CardDescription dir="ltr">{data.student.student_code}</CardDescription>
            <p className="mt-1 text-xs text-muted-foreground hidden print:block">
              تاريخ الطباعة: {printedAt}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onDownload}
            disabled={downloading}
            className="print:hidden gap-2"
          >
            <Printer className="h-4 w-4" />
            {downloading ? "جاري الإنشاء..." : "تنزيل PDF"}
          </Button>
        </CardHeader>
      </Card>


      <Card>
        <CardHeader>
          <CardTitle className="text-base">سجل التسميع ({data.recitations.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {data.recitations.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا يوجد تسميع مسجل</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right">السورة</TableHead>
                    <TableHead className="text-right">الآيات</TableHead>
                    <TableHead className="text-right">النوع</TableHead>
                    <TableHead className="text-right">التقييم</TableHead>
                    <TableHead className="text-right">ملاحظات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recitations.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap" dir="ltr">
                        {r.recited_on}
                      </TableCell>
                      <TableCell>{r.surah}</TableCell>
                      <TableCell dir="ltr">
                        {r.from_ayah} - {r.to_ayah}
                      </TableCell>
                      <TableCell>
                        <Badge variant={r.is_review ? "secondary" : "default"}>
                          {r.is_review ? "مراجعة" : "حفظ"}
                        </Badge>
                      </TableCell>
                      <TableCell>{r.rating ?? "—"}</TableCell>
                      <TableCell className="max-w-[200px] whitespace-pre-wrap text-sm">
                        {r.notes ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">سجل الحضور ({data.attendance.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {data.attendance.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا يوجد سجل حضور</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right">الحضور</TableHead>
                    <TableHead className="text-right">التقييم</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.attendance.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="whitespace-nowrap" dir="ltr">
                        {a.attended_on}
                      </TableCell>
                      <TableCell>
                        <Badge variant={a.present ? "default" : "destructive"}>
                          {a.present ? "حاضر" : "غائب"}
                        </Badge>
                      </TableCell>
                      <TableCell>{a.rating ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
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

type Match = { id: string; maskedName: string; maskedCode: string };
type History = Awaited<ReturnType<typeof publicGetStudentHistory>>;

function LookupPage() {
  const search = useServerFn(publicSearchStudents);
  const getHistory = useServerFn(publicGetStudentHistory);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Match[] | null>(null);

  const [selected, setSelected] = useState<Match | null>(null);
  const [verification, setVerification] = useState("");
  const [history, setHistory] = useState<History | null>(null);
  const [historyBusy, setHistoryBusy] = useState(false);

  const onSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() && !code.trim()) {
      toast.error("الرجاء إدخال الاسم أو رقم الطالب");
      return;
    }
    setBusy(true);
    setResults(null);
    setSelected(null);
    setHistory(null);
    try {
      const res = await search({ data: { name: name.trim(), code: code.trim() } });
      setResults(res.results);
      if (res.results.length === 0) {
        toast.info("لا توجد نتائج مطابقة");
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const onSelect = (m: Match) => {
    setSelected(m);
    setVerification("");
    setHistory(null);
  };

  const onVerify = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setHistoryBusy(true);
    try {
      const res = await getHistory({
        data: { studentId: selected.id, verification: verification.trim() },
      });
      setHistory(res);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setHistoryBusy(false);
    }
  };

  return (
    <div dir="rtl" className="min-h-screen bg-background px-4 py-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <header className="text-center">
          <h1 className="text-2xl font-bold">البحث عن سجل الطالب</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            ابحث بالاسم أو برقم الطالب لعرض سجلك التاريخي
          </p>
        </header>

        <Card>
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
                  placeholder="مثال: محمد أحمد"
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

        {results && results.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">النتائج ({results.length})</CardTitle>
              <CardDescription>اختر الطالب للمتابعة</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {results.map((m) => (
                <button
                  key={m.id}
                  onClick={() => onSelect(m)}
                  className={`w-full rounded-md border p-3 text-right transition hover:bg-accent ${
                    selected?.id === m.id ? "border-primary bg-accent" : ""
                  }`}
                >
                  <div className="font-medium">{m.maskedName}</div>
                  <div className="text-xs text-muted-foreground" dir="ltr">
                    {m.maskedCode}
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>
        )}

        {selected && !history && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">خطوة التحقق</CardTitle>
              <CardDescription>
                للمحافظة على الخصوصية، أدخل رقم الطالب الكامل أو الاسم الكامل بدقة
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onVerify} className="space-y-3">
                <Input
                  value={verification}
                  onChange={(e) => setVerification(e.target.value)}
                  placeholder="رقم الطالب الكامل أو الاسم الكامل"
                  required
                />
                <Button type="submit" className="w-full" disabled={historyBusy}>
                  {historyBusy ? "جاري التحقق..." : "عرض السجل"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {history && <HistoryView data={history} />}
      </div>
    </div>
  );
}

function HistoryView({ data }: { data: History }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{data.student.full_name}</CardTitle>
          <CardDescription dir="ltr">{data.student.student_code}</CardDescription>
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

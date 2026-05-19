import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, FileText, AlertCircle, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { useBattalions, useCompanies } from "@/lib/orgs";
import { getErrorMessage } from "@/lib/errors";

type Row = {
  full_name: string;
  battalion: string;
  company: string;
  notes?: string;
};

function parseCSV(text: string): Row[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return [];

  // Detect & skip header if present
  const headerKeywords = ["full_name", "name", "الاسم", "battalion", "كتيبة"];
  const first = lines[0].toLowerCase();
  const hasHeader = headerKeywords.some((k) => first.includes(k.toLowerCase()));
  const dataLines = hasHeader ? lines.slice(1) : lines;

  const rows: Row[] = [];
  for (const line of dataLines) {
    // Support comma or semicolon or tab
    const parts = line.split(/[,;\t]/).map((p) => p.trim().replace(/^"|"$/g, ""));
    const [full_name, battalion, company, notes] = parts;
    if (!full_name) continue;
    rows.push({
      full_name: full_name.slice(0, 200),
      battalion: (battalion ?? "").slice(0, 100),
      company: (company ?? "").slice(0, 100),
      notes: notes?.slice(0, 500) || undefined,
    });
  }
  return rows;
}

export function ImportStudentsDialog() {
  const qc = useQueryClient();
  const { data: battalions = [] } = useBattalions();
  const { data: companies = [] } = useCompanies();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  const rows = useMemo(() => parseCSV(text), [text]);

  const importMutation = useMutation({
    mutationFn: async () => {
      if (rows.length === 0) throw new Error("لا توجد بيانات للاستيراد");

      // Build name -> id maps (case-insensitive)
      const batMap = new Map<string, string>();
      battalions.forEach((b) => batMap.set(b.name.trim().toLowerCase(), b.id));
      const coMap = new Map<string, string>(); // key: `${batId}|${coName}`
      companies.forEach((c) =>
        coMap.set(`${c.battalion_id}|${c.name.trim().toLowerCase()}`, c.id),
      );

      // 1) Create missing battalions
      const neededBats = new Set<string>();
      rows.forEach((r) => {
        if (r.battalion && !batMap.has(r.battalion.toLowerCase()))
          neededBats.add(r.battalion);
      });

      let nextBatOrder = battalions.length + 1;
      for (const name of neededBats) {
        const { data, error } = await supabase
          .from("battalions")
          .insert({ name, sort_order: nextBatOrder++ })
          .select("id, name")
          .single();
        if (error) throw error;
        batMap.set(name.toLowerCase(), data.id);
      }

      // 2) Create missing companies
      const neededCos = new Map<string, { batId: string; name: string }>();
      rows.forEach((r) => {
        if (!r.company || !r.battalion) return;
        const batId = batMap.get(r.battalion.toLowerCase());
        if (!batId) return;
        const key = `${batId}|${r.company.toLowerCase()}`;
        if (!coMap.has(key))
          neededCos.set(key, { batId, name: r.company });
      });

      for (const { batId, name } of neededCos.values()) {
        const count = Array.from(coMap.keys()).filter((k) => k.startsWith(`${batId}|`))
          .length;
        const { data, error } = await supabase
          .from("companies")
          .insert({ battalion_id: batId, name, sort_order: count + 1 })
          .select("id")
          .single();
        if (error) throw error;
        coMap.set(`${batId}|${name.toLowerCase()}`, data.id);
      }

      // 3) Insert students in batches of 100
      const studentPayload = rows.map((r) => {
        const battalion_id = r.battalion
          ? batMap.get(r.battalion.toLowerCase()) ?? null
          : null;
        const company_id =
          battalion_id && r.company
            ? coMap.get(`${battalion_id}|${r.company.toLowerCase()}`) ?? null
            : null;
        return {
          full_name: r.full_name,
          battalion_id,
          company_id,
          notes: r.notes ?? null,
        };
      });

      let inserted = 0;
      for (let i = 0; i < studentPayload.length; i += 100) {
        const chunk = studentPayload.slice(i, i + 100);
        const { error } = await supabase.from("students").insert(chunk);
        if (error) throw error;
        inserted += chunk.length;
      }
      return inserted;
    },
    onSuccess: (count) => {
      toast.success(`تم استيراد ${count} طالباً بنجاح`);
      qc.invalidateQueries({ queryKey: ["students"] });
      qc.invalidateQueries({ queryKey: ["battalions"] });
      qc.invalidateQueries({ queryKey: ["companies"] });
      setText("");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(getErrorMessage(e)),
  });

  const onFile = async (file: File) => {
    const txt = await file.text();
    setText(txt);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Upload className="h-4 w-4" />
          <span className="hidden sm:inline">استيراد</span>
        </Button>
      </DialogTrigger>
      <DialogContent dir="rtl" className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>استيراد الطلاب من ملف CSV</DialogTitle>
          <DialogDescription>
            الأعمدة المطلوبة بالترتيب: <b>الاسم الكامل، الكتيبة، السرية، ملاحظات</b>{" "}
            (اختياري). سيتم إنشاء أي كتيبة أو سرية غير موجودة تلقائياً.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-lg border bg-muted/30 p-3 text-xs font-mono space-y-1">
            <div className="text-muted-foreground">مثال:</div>
            <div>full_name,battalion,company,notes</div>
            <div>أحمد محمد,الكتيبة الأولى,السرية أ,</div>
            <div>عمر خالد,الكتيبة الأولى,السرية ب,حافظ متميز</div>
          </div>

          <div className="flex items-center gap-2">
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".csv,text/csv,text/plain"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onFile(f);
                }}
              />
              <span className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm hover:bg-accent transition-colors">
                <FileText className="h-4 w-4" />
                اختر ملفاً
              </span>
            </label>
            <span className="text-xs text-muted-foreground">
              أو الصق المحتوى أدناه
            </span>
          </div>

          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="full_name,battalion,company,notes&#10;..."
            className="min-h-[200px] font-mono text-xs"
            dir="ltr"
          />

          {text.trim().length > 0 && (
            <div
              className={`flex items-center gap-2 text-sm rounded-md p-2 ${
                rows.length > 0
                  ? "bg-primary/10 text-primary"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {rows.length > 0 ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  جاهز لاستيراد <b>{rows.length}</b> طالب
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4" />
                  لم يتم العثور على بيانات صالحة
                </>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            إلغاء
          </Button>
          <Button
            onClick={() => importMutation.mutate()}
            disabled={rows.length === 0 || importMutation.isPending}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            {importMutation.isPending ? "جارٍ الاستيراد..." : `استيراد ${rows.length || ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { Link2, Copy, Check, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export function StudentLinkCard() {
  const [copied, setCopied] = useState(false);
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/lookup`
      : "/lookup";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("تم نسخ الرابط");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("تعذر النسخ");
    }
  };

  return (
    <section className="bg-card rounded-2xl border shadow-soft p-4 sm:p-6 lg:col-span-2">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          <Link2 className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-bold">رابط الطالب العام</h2>
          <p className="text-xs text-muted-foreground">
            شارك هذا الرابط مع الطلاب للاطلاع على سجلاتهم بدون تسجيل دخول
          </p>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <Input value={url} readOnly dir="ltr" className="font-mono text-xs" />
        <div className="flex gap-2">
          <Button onClick={copy} className="gap-2 flex-1 sm:flex-none">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            <span>{copied ? "تم النسخ" : "نسخ"}</span>
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <a href={url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
              <span>فتح</span>
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}

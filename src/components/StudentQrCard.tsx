import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, QrCode, Copy, Check } from "lucide-react";
import { toast } from "sonner";

export function StudentQrCard() {
  const [origin, setOrigin] = useState("");
  const [dataUrl, setDataUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const url = origin ? `${origin}/lookup` : "";

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (!url) return;
    QRCode.toDataURL(url, {
      width: 512,
      margin: 2,
      errorCorrectionLevel: "H",
      color: { dark: "#000000", light: "#ffffff" },
    })
      .then(setDataUrl)
      .catch(() => toast.error("تعذر توليد رمز QR"));
  }, [url]);

  const onDownload = () => {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = "student-portal-qr.png";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const onCopy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("تم نسخ الرابط");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("تعذر نسخ الرابط");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <QrCode className="h-5 w-5" />
          مولد باركود الطلاب
        </CardTitle>
        <CardDescription>
          حمّل صورة الـ QR Code واطبعها ليقوم الطلاب بمسحها للوصول مباشرة إلى بوابة عرض السجل.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>رابط بوابة الطالب</Label>
          <div className="flex gap-2">
            <Input value={url} readOnly dir="ltr" className="font-mono text-xs" />
            <Button type="button" variant="outline" size="icon" onClick={onCopy}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="flex flex-col items-center gap-3 rounded-lg border bg-muted/30 p-4">
          {dataUrl ? (
            <img
              src={dataUrl}
              alt="QR Code لبوابة الطالب"
              className="h-56 w-56 rounded-md bg-white p-2"
            />
          ) : (
            <div className="flex h-56 w-56 items-center justify-center text-sm text-muted-foreground">
              جاري التوليد...
            </div>
          )}
          <Button type="button" onClick={onDownload} disabled={!dataUrl} className="gap-2">
            <Download className="h-4 w-4" />
            تنزيل الصورة (PNG)
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
